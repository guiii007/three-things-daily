const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, shell, dialog } = require('electron');
const path = require('node:path');
const { Store, dayKey } = require('./store');
const { leftDown } = require('./native-mouse');
const { HoldGesture } = require('./hold-gesture');
const { petWindowDimensions, scaledShape } = require('./pet-geometry');
const testRoot = process.env.CAPSULE_TEST_ROOT;
const nativeUITest = Boolean(testRoot && process.env.CAPSULE_NATIVE_UI_TEST === '1');
if (testRoot) app.setPath('userData', path.join(testRoot, 'data'));
let store, manager, tray, quitting = false, petsVisible = true, rewardWindow;
const pets = new Map(), editors = new Map(), gestures = new Map(), petShapes = new Map(), closingPets = new Set(), rewardQueue = [];
const pagePath = path.join(__dirname, 'app.html');
function createWindow(options, query) {
  const win = new BrowserWindow({ show: false, icon: path.join(__dirname, 'tray.png'), autoHideMenuBar: true, backgroundColor: '#fff9ef', ...options, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.loadFile(pagePath, { query }); return win;
}
function state() { return { ...store.snapshot(), today: dayKey(), recordsDir: store.recordsDir, petsVisible }; }
function broadcast() {
  for (const win of BrowserWindow.getAllWindows()) if (!win.isDestroyed()) win.webContents.send('companion:state', state());
}
function showManager() {
  if (!manager || manager.isDestroyed()) {
    manager = createWindow({ width: 700, height: 650, minWidth: 520, minHeight: 470, title: '三件事 · 像素伙伴' }, { view: 'manager' });
    manager.once('ready-to-show', () => manager.show());
    manager.on('close', event => { if (!quitting) { event.preventDefault(); manager.hide(); } });
  } else { manager.show(); manager.focus(); }
}
function clamp(bounds) {
  const area = screen.getDisplayMatching(bounds).workArea;
  return { x: Math.round(Math.max(area.x, Math.min(area.x + area.width - bounds.width, bounds.x))), y: Math.round(Math.max(area.y, Math.min(area.y + area.height - bounds.height, bounds.y))) };
}
function petPosition(task) {
  const area = screen.getPrimaryDisplay().workArea;
  const dimensions = petWindowDimensions(store.data.petSize);
  return clamp({ ...(task.position || { x: area.x + area.width - dimensions.width - 40 - task.slot * (dimensions.width + 30), y: area.y + area.height - dimensions.height - 43 }), ...dimensions });
}
function applyPetShape(id, win) {
  if (!nativeUITest && petShapes.has(id)) win.setShape(scaledShape(petShapes.get(id), store.data.petSize));
}
function resizePets(percent) {
  for (const id of [...gestures.keys()]) finishGesture(id, true);
  store.setPetSize(percent);
  const dimensions = petWindowDimensions(percent);
  for (const [id, win] of pets) {
    if (win.isDestroyed() || closingPets.has(id)) continue;
    const old = win.getBounds(), position = clamp({ x: old.x, y: old.y, ...dimensions });
    if (!nativeUITest) { win.setShape([]); win.setBounds({ ...position, ...dimensions }); }
    else win.setPosition(position.x, position.y);
    applyPetShape(id, win);
    if (position.x !== old.x || position.y !== old.y) store.move(id, position);
  }
  broadcast();
}
function addPet(task) {
  if (pets.has(task.id) || task.done || closingPets.has(task.id)) return;
  const win = createWindow({ ...petPosition(task), width: nativeUITest ? 320 : petWindowDimensions(store.data.petSize).width, height: nativeUITest ? 240 : petWindowDimensions(store.data.petSize).height, frame: nativeUITest, transparent: !nativeUITest, backgroundColor: nativeUITest ? '#fffaf0' : '#00000000', resizable: false, movable: false, focusable: nativeUITest, skipTaskbar: !nativeUITest, hasShadow: false, alwaysOnTop: true }, { view: 'pet', id: task.id });
  // 隔离的原生输入测试让自动化工具能枚举小窗口，正式角色仍无焦点、无任务栏条目。
  if(nativeUITest){win.on('page-title-updated',event=>event.preventDefault());win.setTitle('长按测试角色');}
  pets.set(task.id, win); win.setAlwaysOnTop(true, 'floating');
  const reveal=()=>{if(petsVisible&&!win.isDestroyed()){win.show();win.setAlwaysOnTop(false);win.setAlwaysOnTop(true,'screen-saver');}};
  win.once('ready-to-show',reveal);win.webContents.once('did-finish-load',reveal);
  win.on('closed', () => { if (pets.get(task.id) === win) pets.delete(task.id); const gesture=gestures.get(task.id);if(gesture)clearInterval(gesture.timer);gestures.delete(task.id);petShapes.delete(task.id); });
}
function syncPets() {
  for (const task of store.data.tasks) if (!task.done) addPet(task);
  for (const [id, win] of pets) if (store.task(id).done && !closingPets.has(id)) win.close();
}
function finishGesture(id, cancelled=false) {
  const gesture=gestures.get(id), win=pets.get(id); if(!gesture)return;
  clearInterval(gesture.timer);gestures.delete(id);
  if(!win||win.isDestroyed())return;
  win.setMovable(false);
  if(gesture.picked) {
    try{store.move(id,win.getBounds());broadcast();}catch(error){dialog.showErrorBox('位置暂时未能保存',error.message);}
    win.webContents.send('companion:gesture',{phase:'released'});
    setTimeout(()=>{if(!nativeUITest&&!win.isDestroyed()&&!gestures.has(id))applyPetShape(id, win);},240);
  }else{
    if(!nativeUITest)applyPetShape(id, win);
    win.webContents.send('companion:gesture',{phase:'idle'});
    if(!cancelled&&!gesture.moved)showEditor(id);
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
  if (editors.has(id)) { const win = editors.get(id); win.show(); win.focus(); return; }
  const pet = pets.get(id), origin = pet ? pet.getBounds() : { ...petPosition(task), ...petWindowDimensions(store.data.petSize) };
  const area = screen.getDisplayMatching(origin).workArea;
  let x = origin.x + origin.width + 16;
  if (x + 430 > area.x + area.width) x = origin.x - 446;
  const pos = clamp({ x, y: origin.y - 360, width: 430, height: 530 });
  const win = createWindow({ ...pos, width: 430, height: 530, minWidth: 400, minHeight: 430, alwaysOnTop: true, title: '任务与心得' }, { view: 'editor', id });
  editors.set(id, win); win.once('ready-to-show', () => win.show()); win.on('closed', () => editors.delete(id));
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
    { label: petsVisible ? '暂时隐藏伙伴' : '显示伙伴', click: () => { petsVisible = !petsVisible; for (const win of pets.values()) { if(petsVisible) { win.show(); win.setAlwaysOnTop(false); win.setAlwaysOnTop(true,'screen-saver'); } else win.hide(); } broadcast(); trayMenu(); } },
    { label: '打开完成记录文件夹', click: () => openRecords() },
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
    const requireTask = () => { if (context.view !== 'manager' && context.id !== id) throw new Error('任务来源无效。'); };
    let result;
    switch (method) {
      case 'state': result = state(); break;
      case 'create': requireManager(); result = store.create(value.text); syncPets(); broadcast(); break;
      case 'editor': requireTask(); showEditor(id); break;
      case 'update': requireTask(); result = store.update(id, value.patch); broadcast(); break;
      case 'complete': {
        requireTask(); const done = store.complete(id, value.patch); result = done.task;
        if (!done.alreadyDone) {
          const pet = pets.get(id), position = pet?.getBounds() || petPosition(done.task);
          closingPets.add(id); if (pet) pet.webContents.send('companion:exit');
          if (editors.has(id)) editors.get(id).close();
          broadcast();
          setTimeout(() => { if (pet && !pet.isDestroyed()) pet.close(); closingPets.delete(id); syncPets(); showReward({ position, phraseIndex: done.phraseIndex, all: store.data.tasks.filter(t => t.day === done.task.day).length === 3 && store.data.tasks.filter(t => t.day === done.task.day).every(t => t.done) }); }, 650);
        } break;
      }
      case 'reopen': requireTask(); result = store.reopen(id); syncPets(); broadcast(); break;
      case 'export': requireTask(); result = store.export(id); broadcast(); break;
      case 'records': result = await openRecords(); if (result) throw new Error(result); break;
      case 'quit': requireManager(); app.quit(); break;
      case 'petSize': requireManager(); resizePets(value); result = store.data.petSize; break;
      case 'shape': {
        if (context.view !== 'pet' || !Array.isArray(value) || value.length > 200 || value.some(r => ![r.x,r.y,r.width,r.height].every(Number.isInteger) || r.x < 0 || r.y < 0 || r.width < 1 || r.height < 1 || r.x+r.width > 40 || r.y+r.height > 24)) throw new Error('角色区域无效。');
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
      case 'close': context.win.close(); break;
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
      const recordsDir = testRoot ? path.join(testRoot, 'records') : app.getPath('desktop');
      store = new Store(path.join(app.getPath('userData'), 'tasks.json'), recordsDir);
      // 原生托盘使用随应用打包的 PNG，避免 SVG 解码差异。
      tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'tray.png')));
      tray.setToolTip('三件事 · 像素伙伴'); tray.on('double-click', showManager); trayMenu(); syncPets(); showManager();
      let date = dayKey(); setInterval(() => { const next = dayKey(); if (date !== next) { date = next; broadcast(); } }, 15000).unref();
      screen.on('display-removed', () => { for (const [id, win] of pets) { const pos = clamp(win.getBounds()); win.setPosition(pos.x,pos.y); store.move(id,pos); } });
    } catch (error) { dialog.showErrorBox('三件事暂时无法启动', error.message + '\n已有记录不会被覆盖。'); app.quit(); }
  });
}
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => {});
