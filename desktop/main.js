const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, shell, dialog } = require('electron');
const path = require('node:path');
const { Store, dayKey, isDeferred } = require('./store');
const { leftDown } = require('./native-mouse');
const { HoldGesture } = require('./hold-gesture');
const { petWindowDimensions, scaledShape } = require('./pet-geometry');
const { createLoginStartup, startupMenuItem } = require('./login-startup');
const { CompanionLibrary } = require('./companions');
const fs = require('node:fs');
const testRoot = process.env.CAPSULE_TEST_ROOT;
const nativeUITest = Boolean(testRoot && process.env.CAPSULE_NATIVE_UI_TEST === '1');
if (testRoot) app.setPath('userData', path.join(testRoot, 'data'));
let startup, companionLibrary, libraryWindow, startupWarning='';
let store, manager, tray, quitting = false, petsVisible = true, rewardWindow;
const pets = new Map(), editors = new Map(), gestures = new Map(), petShapes = new Map(), closingPets = new Set(), rewardQueue = [];
const pagePath = path.join(__dirname, 'app.html');
function createWindow(options, query) {
  const win = new BrowserWindow({ show: false, icon: path.join(__dirname, 'assets', 'app-icon.png'), autoHideMenuBar: true, backgroundColor: '#fff9ef', ...options, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.loadFile(pagePath, { query }); return win;
}
function state() { return { ...store.snapshot(), today: dayKey(), appVersion: app.getVersion(), recordsDir: store.recordsDir, companions: companionLibrary.packs, companionWarnings: companionLibrary.warnings, startupWarning, petsVisible }; }
function broadcast() {
  for (const win of BrowserWindow.getAllWindows()) if (!win.isDestroyed()) win.webContents.send('companion:state', state());
}
function showManager() {
  if (!manager || manager.isDestroyed()) {
    manager = createWindow({ width: 700, height: 650, minWidth: 520, minHeight: 470, title: '三件事 · 像素伙伴' }, { view: 'manager' });
    manager.once('ready-to-show', () => manager.show());
    manager.webContents.once('did-finish-load', () => { if (!manager.isDestroyed()) manager.show(); });
    manager.on('close', event => { if (!quitting) { event.preventDefault(); manager.hide(); } });
  } else { manager.show(); manager.focus(); }
}
function showLibrary() {
  if(libraryWindow&&!libraryWindow.isDestroyed()){libraryWindow.show();libraryWindow.focus();return;}
  libraryWindow=createWindow({width:760,height:720,minWidth:560,minHeight:480,title:'伙伴广场'}, {view:'library'});
  const win=libraryWindow;win.once('ready-to-show',()=>win.show());win.webContents.once('did-finish-load',()=>{if(!win.isDestroyed())win.show();});win.on('closed',()=>{libraryWindow=null;});
}
function clamp(bounds) {
  const area = screen.getDisplayMatching(bounds).workArea;
  return { x: Math.round(Math.max(area.x, Math.min(area.x + area.width - bounds.width, bounds.x))), y: Math.round(Math.max(area.y, Math.min(area.y + area.height - bounds.height, bounds.y))) };
}
function taskDimensions(task,percent=store.data.petSize){const pack=companionLibrary.get(store.data.selectedSkin);return petWindowDimensions(percent,pack?.width||40,pack?.height||24);}
function petPosition(task) {
  const area = screen.getPrimaryDisplay().workArea;
  const dimensions = taskDimensions(task);
  return clamp({ ...(store.data.companionPosition || { x: area.x + area.width - dimensions.width - 40, y: area.y + area.height - dimensions.height - 43 }), ...dimensions });
}
function applyPetShape(id, win) {
  if (!nativeUITest && petShapes.has(id)) {const shape=petShapes.get(id);win.setShape(scaledShape(shape.rects,store.data.petSize,shape.width,shape.height));}
}
function resizePets(percent) {
  for (const id of [...gestures.keys()]) finishGesture(id, true);
  store.setPetSize(percent);

  for (const [id, win] of pets) {
    if (win.isDestroyed() || closingPets.has(id)) continue;
    const dimensions=taskDimensions(store.task(id),percent);
    const old = win.getBounds(), position = clamp({ x: old.x, y: old.y, ...dimensions });
    if (!nativeUITest) { win.setShape([]); win.setBounds({ ...position, ...dimensions }); }
    else win.setPosition(position.x, position.y);
    applyPetShape(id, win);
    if (position.x !== old.x || position.y !== old.y) store.moveCompanion(position);
  }
  broadcast();
}
function belongsToToday(task) { return task.day === dayKey(); }
function addPet(task) {
  if (pets.has(task.id) || !belongsToToday(task) || closingPets.has(task.id)) return;
  const win = createWindow({ ...petPosition(task), width: nativeUITest ? 320 : taskDimensions(task).width, height: nativeUITest ? 240 : taskDimensions(task).height, frame: nativeUITest, transparent: !nativeUITest, backgroundColor: nativeUITest ? '#fffaf0' : '#00000000', resizable: false, movable: false, focusable: nativeUITest, skipTaskbar: !nativeUITest, hasShadow: false, alwaysOnTop: true }, { view: 'pet', id: task.id });
  // 隔离的原生输入测试让自动化工具能枚举小窗口，正式角色仍无焦点、无任务栏条目。
  if(nativeUITest){win.on('page-title-updated',event=>event.preventDefault());win.setTitle('长按测试角色');}
  pets.set(task.id, win); win.setAlwaysOnTop(true, 'floating');
  const reveal=()=>{if(petsVisible&&!win.isDestroyed()){win.show();win.setAlwaysOnTop(false);win.setAlwaysOnTop(true,'screen-saver');}};
  win.once('ready-to-show',reveal);win.webContents.once('did-finish-load',reveal);
  win.on('closed', () => { if (pets.get(task.id) === win) pets.delete(task.id); const gesture=gestures.get(task.id);if(gesture)clearInterval(gesture.timer);gestures.delete(task.id);petShapes.delete(task.id); });
}
function syncPets() {
  const today=store.data.tasks.filter(belongsToToday);
  // 第一个任务仅作为稳定的窗口标识；伙伴由当天所有待办共享。
  const anchor=today.some(t=>!t.done&&!isDeferred(t))?today[0]:null;
  for (const [id,win] of pets) if(id!==anchor?.id&&!closingPets.has(id)){finishGesture(id,true);win.close();}
  if(anchor)addPet(anchor);
}
function finishGesture(id, cancelled=false) {
  const gesture=gestures.get(id), win=pets.get(id); if(!gesture)return;
  clearInterval(gesture.timer);gestures.delete(id);
  if(!win||win.isDestroyed())return;
  win.setMovable(false);
  if(gesture.picked) {
    try{store.moveCompanion(win.getBounds());broadcast();}catch(error){dialog.showErrorBox('位置暂时未能保存',error.message);}
    win.webContents.send('companion:gesture',{phase:'released'});
    setTimeout(()=>{if(!nativeUITest&&!win.isDestroyed()&&!gestures.has(id))applyPetShape(id, win);},240);
  }else{
    if(!nativeUITest)applyPetShape(id, win);
    win.webContents.send('companion:gesture',{phase:'idle'});
    if(!cancelled&&!gesture.moved){const task=store.data.tasks.find(t=>belongsToToday(t)&&!t.done&&!isDeferred(t));if(task)showEditor(task.id);}
  }
}
function sampleGesture(id) {
  const gesture=gestures.get(id), win=pets.get(id);if(!gesture||!win||win.isDestroyed())return;
  const action=gesture.sample(screen.getCursorScreenPoint(),leftDown());
  if(action.phase==='picked'){
    win.setMovable(true);win.setShape([]);
    win.webContents.send('companion:gesture',{phase:'picked'});
  }
  if(action.position){const pos=clamp(action.position);win.setPosition(pos.x,pos.y);}
  if(gesture.ended)finishGesture(id);
}
function showEditor(id) {
  const task = store.task(id);
  for(const [initialId,win] of editors)if(store.task(initialId).day===task.day&&!win.isDestroyed()){
    win.webContents.send('companion:select-task',id);win.show();win.focus();return;
  }
  const pet = [...pets.values()][0], origin = pet ? pet.getBounds() : { ...petPosition(task), ...taskDimensions(task) };
  const area = screen.getDisplayMatching(origin).workArea;
  const width = Math.min(area.width, Math.max(400, store.data.editorLayout.width));
  const height = Math.min(area.height, Math.max(430, store.data.editorLayout.height));
  let x = origin.x + origin.width + 16;
  if (x + width > area.x + area.width) x = origin.x - width - 16;
  const pos = clamp({ x, y: origin.y - Math.min(360, height), width, height });
  const win = createWindow({ ...pos, width, height, minWidth: Math.min(400, area.width), minHeight: Math.min(430, area.height), alwaysOnTop: true, title: '任务与心得' }, { view: 'editor', id });
  let resizeTimer, adjusted = false;
  const saveSize = () => {
    clearTimeout(resizeTimer);
    if (win.isDestroyed()) return;
    const bounds = win.getNormalBounds();
    if (!adjusted && bounds.width === width && bounds.height === height) return;
    try { store.setEditorLayout({ width: bounds.width, height: bounds.height }); }
    catch (error) { dialog.showErrorBox('窗口大小暂时未能保存', error.message); }
  };
  win.on('resize', () => { if (!win.isVisible() || win.isMaximized() || win.isMinimized()) return; adjusted = true; clearTimeout(resizeTimer); resizeTimer = setTimeout(saveSize, 200); });
  win.on('close', event => {
    saveSize();
    if (!win.editorCloseReady) { event.preventDefault(); win.webContents.send('companion:close-request'); }
  });
  editors.set(id, win); win.once('ready-to-show', () => win.show()); win.on('closed', () => { clearTimeout(resizeTimer); editors.delete(id); });
}
function showReward(item) {
  rewardQueue.push(item); playReward();
}
function playReward() {
  if (rewardWindow || !rewardQueue.length) return;
  const item = rewardQueue.shift(), area = screen.getDisplayNearestPoint(item.position).workArea;
  rewardWindow = createWindow({ x: Math.round(area.x + (area.width - 600) / 2), y: Math.round(area.y + (area.height - 370) / 2), width: 600, height: 370, frame: false, transparent: true, backgroundColor: '#00000000', resizable: false, focusable: false, skipTaskbar: true, hasShadow: false, alwaysOnTop: true }, { view: 'reward', phrase: String(item.phraseIndex), all: item.all ? '1' : '0' });
  const win = rewardWindow; win.setIgnoreMouseEvents(true); win.once('ready-to-show', () => { win.show(); win.setAlwaysOnTop(false); win.setAlwaysOnTop(true, 'screen-saver'); });
  win.on('closed', () => { rewardWindow = null; playReward(); });
  setTimeout(() => { if (!win.isDestroyed()) win.close(); }, 5100);
}
function trayMenu() {
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开三件事', click: showManager },
    { label: '当前版本 v'+app.getVersion(), enabled: false },
    { label: petsVisible ? '暂时隐藏伙伴' : '显示伙伴', click: () => { petsVisible = !petsVisible; for (const win of pets.values()) { if(petsVisible) { win.show(); win.setAlwaysOnTop(false); win.setAlwaysOnTop(true,'screen-saver'); } else win.hide(); } broadcast(); trayMenu(); } },
    { label: '打开完成记录文件夹', click: () => openRecords() },
    startupMenuItem(startup, trayMenu, error => dialog.showErrorBox('开机自启动暂时未能设置', error.message)),
    { type: 'separator' }, { label: '退出', click: () => app.quit() }
  ]));
}
function openRecords() { require('node:fs').mkdirSync(store.recordsDir, { recursive: true }); return shell.openPath(store.recordsDir); }
function senderContext(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  const url = new URL(event.sender.getURL());
  if (!win || url.protocol !== 'file:' || require('node:url').fileURLToPath(url).toLowerCase() !== pagePath.toLowerCase()) throw new Error('请求来源无效。');
  return { win, view: url.searchParams.get('view'), id: url.searchParams.get('id') };
}
ipcMain.handle('companion:call', async (event, method, value) => {
  try {
    const context = senderContext(event), id = value?.id;
    const requireManager = () => { if (context.view !== 'manager') throw new Error('此操作需要在管理窗口进行。'); };
    const requireTask = () => {
      if(context.view==='manager')return;
      if(context.view==='editor'&&store.task(context.id).day===store.task(id).day)return;
      if(context.view==='pet'&&id===context.id)return;
      if(context.view==='pet'&&method==='editor'&&belongsToToday(store.task(id)))return;
      throw new Error('任务来源无效。');
    };
    let result;
    switch (method) {
      case 'library': requireManager(); showLibrary(); break;
      case 'selectCompanion': {
        if(context.view!=='library')throw new Error('请在伙伴广场选择。');
        if(!companionLibrary.get(value))throw new Error('没有找到这个伙伴。');
        store.setSelectedCompanion(value);resizePets(store.data.petSize);break;
      }
      case 'importCompanion': {
        if(context.view!=='library')throw new Error('请在伙伴广场导入。');
        const choice=await dialog.showOpenDialog(context.win,{title:'导入伙伴 JSON 文件',properties:['openFile'],filters:[{name:'伙伴文件',extensions:['json']}]});
        if(choice.canceled)return {ok:true,value:null};
        result=companionLibrary.import(choice.filePaths[0]);broadcast();break;
      }
      case 'exportCompanionKit': {
        if(context.view!=='library')throw new Error('请在伙伴广场导出。');
        const choice=await dialog.showOpenDialog(context.win,{title:'选择 AI 创作包的保存位置',properties:['openDirectory','createDirectory']});
        if(choice.canceled)return {ok:true,value:null};
        const folder=path.join(choice.filePaths[0],'三件事-伙伴创作包-'+Date.now());
        if(fs.existsSync(folder))throw new Error('该文件夹已存在，请重新选择。');
        fs.mkdirSync(folder);
        for(const file of ['README.md','AGENTS.md','SPEC.md','cli.js','format.js','example.companion.json'])fs.writeFileSync(path.join(folder,file),fs.readFileSync(path.join(__dirname,'companion-kit',file)));
        result=folder;break;
      }
      case 'state': result = state(); break;
      case 'create': requireManager(); result = store.create(value.text); syncPets(); broadcast(); break;
      case 'editor': requireTask(); showEditor(id); break;
      case 'editorLayout': {
        if (context.view !== 'editor') throw new Error('此操作需要在任务窗口进行。');
        store.setEditorLayout({ titleHeight: value.titleHeight, noteHeight: value.noteHeight }); result = store.data.editorLayout; break;
      }
      case 'update': requireTask(); result = store.update(id, value.patch); broadcast(); break;
      case 'complete': {
        requireTask(); const done = store.complete(id, value.patch); result = done.task;
        if (!done.alreadyDone) {
          const [petId,pet]=[...pets.entries()][0]||[], position = pet?.getBounds() || petPosition(done.task);
          const resting=!store.data.tasks.some(t=>belongsToToday(t)&&!t.done&&!isDeferred(t));
          if(resting&&pet){finishGesture(petId,true);closingPets.add(petId);pet.webContents.send('companion:exit');}
          broadcast();
          setTimeout(() => { if (resting&&pet&&!pet.isDestroyed()) pet.close(); closingPets.delete(petId); syncPets(); showReward({ position, phraseIndex: done.phraseIndex, all: store.data.tasks.filter(t => t.day === done.task.day).length === 3 && store.data.tasks.filter(t => t.day === done.task.day).every(t => t.done) }); }, 650);
        } break;
      }
      case 'defer': {
        requireTask(); const deferred = store.defer(id, value.patch); result = deferred.task;
        if (!deferred.alreadyDeferred) {
          const [petId,pet]=[...pets.entries()][0]||[];
          const resting=!store.data.tasks.some(t=>belongsToToday(t)&&!t.done&&!isDeferred(t));
          if(resting&&pet){finishGesture(petId,true);closingPets.add(petId);pet.webContents.send('companion:exit');}
          broadcast();
          setTimeout(() => { if (resting&&pet&&!pet.isDestroyed()) pet.close(); closingPets.delete(petId); syncPets(); }, 650);
        } break;
      }
      case 'resume': requireTask(); result = store.resume(id); syncPets(); broadcast(); break;
      case 'reopen': requireTask(); result = store.reopen(id); syncPets(); broadcast(); break;
      case 'export': requireTask(); result = store.export(id); broadcast(); break;
      case 'records': result = await openRecords(); if (result) throw new Error(result); break;
      case 'quit': requireManager(); app.quit(); break;
      case 'petSize': requireManager(); resizePets(value); result = store.data.petSize; break;
      case 'shape': {
        if (context.view !== 'pet' || !value || ![value.width,value.height].every(n=>Number.isInteger(n)&&n>=16&&n<=128) || !Array.isArray(value.rects) || value.rects.length > 2048 || value.rects.some(r => ![r.x,r.y,r.width,r.height].every(Number.isInteger) || r.x < 0 || r.y < 0 || r.width < 1 || r.height < 1 || r.x+r.width > value.width || r.y+r.height > value.height)) throw new Error('角色区域无效。');
        petShapes.set(context.id,value);applyPetShape(context.id,context.win); context.win.setAlwaysOnTop(false); context.win.setAlwaysOnTop(true, 'screen-saver'); break;
      }
      case 'pressStart': {
        if (context.view !== 'pet') throw new Error('操作无效。');
        if(gestures.has(context.id))break;
        const gesture=new HoldGesture(screen.getCursorScreenPoint(),context.win.getBounds());
        gestures.set(context.id,gesture);gesture.timer=setInterval(()=>sampleGesture(context.id),16);break;
      }
      case 'pressEnd': {
        if(context.view !== 'pet')throw new Error('操作无效。');
        if(!leftDown())sampleGesture(context.id);break;
      }
      case 'pressCancel': {
        if(context.view !== 'pet')throw new Error('操作无效。');finishGesture(context.id,true);break;
      }
      case 'close':
        if (context.view === 'editor') context.win.editorCloseReady = true;
        context.win.close(); if (quitting) app.quit(); break;
      default: throw new Error('未知操作。');
    }
    return { ok: true, value: result };
  } catch (error) { return { ok: false, error: error.message }; }
});
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (store) showManager(); });
  app.whenReady().then(() => {
    try {
      app.setAppUserModelId('io.threethings.companion');
      startup = createLoginStartup(app, { testFile: testRoot ? path.join(testRoot, 'login-item.json') : undefined });
      try{startup.reconcile();}catch(error){startupWarning='开机启动路径暂未更新：'+error.message+' 请在托盘中重新勾选开机自启动。';}
      const recordsDir = testRoot ? path.join(testRoot, 'records') : app.getPath('desktop');
      companionLibrary = new CompanionLibrary(path.join(app.getPath('userData'),'companions'));
      store = new Store(path.join(app.getPath('userData'), 'tasks.json'), recordsDir);
      // 原生托盘使用随应用打包的 PNG，避免 SVG 解码差异。
      tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'assets', 'app-icon.png')).resize({width:32,height:32}));
      tray.setToolTip('三件事 · 像素伙伴'); tray.on('double-click', showManager); trayMenu(); syncPets(); showManager();
      let date = dayKey(); setInterval(() => { const next = dayKey(); if (date !== next) { date = next; syncPets(); broadcast(); } }, 15000).unref();
      screen.on('display-removed', () => { for (const win of pets.values()) { const pos = clamp(win.getBounds()); win.setPosition(pos.x,pos.y); store.moveCompanion(pos); } });
    } catch (error) { dialog.showErrorBox('三件事暂时无法启动', error.message + '\n已有记录不会被覆盖。'); app.quit(); }
  });
}
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => {});
