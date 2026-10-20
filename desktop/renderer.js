const params = new URLSearchParams(location.search), view = params.get('view');
let id = params.get('id');
const taskNames=['这件事','这桩事','这档事'];
const $ = selector => document.querySelector(selector);
let state, saveTimer, saveQueue = Promise.resolve(), dirty = false, saving = 0, editingLoaded = false, completing = false;
async function call(method, value) {
  const result = await window.companion.call(method, value);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
function error(error) { $('#message').textContent = error.message; }
function safely(fn) { return (...args) => { try { return Promise.resolve(fn(...args)).catch(error); } catch(e) { error(e); } }; }
function patch() { return { text: $('#title').value.trim(), note: $('#note').value }; }
function saveEditor() {
  clearTimeout(saveTimer); if (!dirty) return saveQueue;
  const value = patch(), taskId=id; dirty = false; saving++;
  saveQueue = saveQueue.catch(() => {}).then(() => call('update', { id:taskId, patch: value })).then(() => { $('#save-status').textContent = dirty ? '正在保存…' : '已自动保存'; }).catch(e => { dirty = true; $('#save-status').textContent = '保存失败，请重试'; error(e); throw e; }).finally(() => saving--);
  return saveQueue;
}
function scheduleSave() { dirty = true; $('#save-status').textContent = '正在保存…'; clearTimeout(saveTimer); saveTimer = setTimeout(() => saveEditor().catch(() => {}), 300); }
function deferredToday(task) { return !task.done && Boolean(task.deferredUntil && task.deferredUntil > state.today); }
function taskStatus(task) { return task.done ? '已完成' : deferredToday(task) ? '今日部分完成 · 明天继续' : '待完成'; }
let switching=false, pendingEditorId;
async function switchEditor(nextId) {
  if(completing)return;
  pendingEditorId=nextId;if(switching)return;
  switching=true;$('#title').disabled=true;$('#note').disabled=true;
  try {
    while(pendingEditorId){
      const targetId=pendingEditorId;pendingEditorId=null;
      if(targetId===id)continue;
      const current=state.tasks.find(t=>t.id===id),target=state.tasks.find(t=>t.id===targetId);
      if(!target||target.day!==current?.day)throw Error('只能切换同一天的事情。');
      await Promise.all([saveEditor(),saveLayout()]);
      id=targetId;editingLoaded=false;renderEditor();$('#save-status').textContent='写下的内容会自动保存';
    }
  }finally{switching=false;$('#title').disabled=false;$('#note').disabled=false;}
}
function renderEditor() {
  const task = state.tasks.find(t => t.id === id); if (!task) return;
  const name=taskNames[task.slot];
  $('#task-tabs').replaceChildren(...state.tasks.filter(t=>t.day===task.day).sort((a,b)=>a.slot-b.slot).map(t=>{
    const tab=document.createElement('button');tab.type='button';tab.textContent=taskNames[t.slot];tab.dataset.id=t.id;
    tab.dataset.status=t.done?'done':deferredToday(t)?'deferred':'pending';tab.setAttribute('aria-pressed',String(t.id===id));
    tab.title=taskStatus(t)+'：'+t.text;tab.addEventListener('click',safely(()=>switchEditor(t.id)));return tab;
  }));
  if (!editingLoaded) { $('#title').value = task.text; $('#note').value = task.note;
    for(const [selector,key] of [['#title','titleHeight'],['#note','noteHeight']])if(state.editorLayout[key]!==null)$(selector).style.height=state.editorLayout[key]+'px';
    editingLoaded = true; }
  drawCompanion($('#editor-art'),{...task,skin:state.selectedSkin},state.companions);
  $('#status').textContent = task.done ? name+'已完成' : deferredToday(task) ? name+'今天的努力已记录，明天继续' : name+'正在进行中';
  $('#time').textContent = `创建 ${new Date(task.createdAt).toLocaleString('zh-CN')}` + (task.completedAt ? ` · 完成 ${new Date(task.completedAt).toLocaleString('zh-CN')}` : '');
  $('#defer').hidden=task.done||task.day!==state.today;$('#defer').textContent=deferredToday(task)?'今天继续干'+name:'今天完成了一部分，明天继续干';
  $('#complete').textContent = task.done ? '重新开启'+name : name+'完成啦 √';
}
let layoutTimer, layoutQueue=Promise.resolve(), layoutDirty=false, layoutSaving=0, savedTextHeights;
function textHeights() { return { titleHeight: Math.round($('#title').getBoundingClientRect().height), noteHeight: Math.round($('#note').getBoundingClientRect().height) }; }
function captureLayout() { const value=textHeights();if(JSON.stringify(value)!==JSON.stringify(savedTextHeights))layoutDirty=true; }
function saveLayout() {
  clearTimeout(layoutTimer);captureLayout();if(!layoutDirty)return layoutQueue;
  const value=textHeights();layoutDirty=false;savedTextHeights=value;layoutSaving++;
  layoutQueue=layoutQueue.catch(()=>{}).then(()=>call('editorLayout',value)).catch(e=>{layoutDirty=true;error(e);throw e;}).finally(()=>layoutSaving--);
  return layoutQueue;
}
function observeTextHeights() {
  savedTextHeights=textHeights();
  const observer=new ResizeObserver(()=>{captureLayout();if(layoutDirty){clearTimeout(layoutTimer);layoutTimer=setTimeout(()=>saveLayout().catch(()=>{}),200);}});
  observer.observe($('#title'));observer.observe($('#note'));
}
function taskRow(task) {
  const row = document.createElement('div'); row.className = 'task-row'; row.dataset.id = task.id;
  const canvas = document.createElement('canvas'); canvas.width=40; canvas.height=24; drawCompanion(canvas,task,state.companions);
  const info = document.createElement('div'); info.className = 'task-info';
  const text = document.createElement('div'); text.textContent = task.text;
  const meta = document.createElement('small'); meta.textContent = `${task.day} · ${taskNames[task.slot]} · ${taskStatus(task)}`;
  info.append(text,meta); const actions = document.createElement('div'); actions.className = 'task-actions';
  const edit = document.createElement('button'); edit.textContent = task.done || task.day!==state.today ? '查看记录' : deferredToday(task) ? '查看今日进度' : '写心得'; edit.addEventListener('click',safely(() => call('editor',{id:task.id}))); actions.append(edit);
  if(task.done) { const txt=document.createElement('button'); txt.textContent='补存 TXT'; txt.addEventListener('click',safely(async()=>{$('#message').textContent='已保存：'+await call('export',{id:task.id});})); actions.append(txt); }
  row.append(canvas,info,actions); return row;
}
let sizePending = null, sizeUpdating = false;
function renderPetSize() {
  const pack=state.companions.find(p=>p.id===state.selectedSkin);
  const width=Math.round(120*state.petSize/100),height=Math.round(120*(pack?.height||24)/(pack?.width||40)*state.petSize/100);
  document.documentElement.style.setProperty('--pet-width',width+'px');
  document.documentElement.style.setProperty('--pet-height',height+'px');
  document.documentElement.style.setProperty('--lift',(-5*state.petSize/100)+'px');
}
function syncSizeControls(percent=state.petSize, force=false) {
  $('#pet-size').value=percent;
  const number=$('#pet-size-number');
  if(force||document.activeElement!==number){number.value=percent;number.setCustomValidity('');}
}
function validSizeNumber() {
  const input=$('#pet-size-number'), value=Number(input.value);
  const valid=/^\d+$/.test(input.value)&&Number.isInteger(value)&&value>=20&&value<=200;
  input.setCustomValidity(valid?'':'请输入 20～200 之间的整数');
  return valid?value:null;
}
async function changePetSize(percent) {
  syncSizeControls(percent);sizePending=percent;
  if(sizeUpdating)return;
  sizeUpdating=true;
  try { while(sizePending!==null) { const requested=sizePending;sizePending=null;state.petSize=await call('petSize',requested); } }
  finally { sizeUpdating=false;syncSizeControls(); }
}
function renderManager() {
  $('#app-version').textContent='v'+state.appVersion;
  const today=state.tasks.filter(t=>t.day===state.today), past=state.tasks.filter(t=>t.day!==state.today).slice().reverse();
  if(!sizeUpdating)syncSizeControls();
  $('#count').textContent=`${state.today} · 已创建 ${today.length} / 3 · 完成 ${today.filter(t=>t.done).length}`;
  $('#create').disabled=today.length>=3; $('#new-task').disabled=today.length>=3;
  $('#today-list').replaceChildren(...today.map(taskRow));
  if(!today.length) { const empty=document.createElement('p'); empty.className='empty'; empty.textContent='写下第一件事，让伙伴来陪你。'; $('#today-list').append(empty); }
  $('#history-list').replaceChildren(...past.map(taskRow));
  $('#history summary').textContent=`过去的任务与记录（${past.length}）`;
  $('#folder').textContent=`完成后 TXT 自动保存到：${state.recordsDir}`;
}
let drawnPetSkin;
async function renderPetCharacter(){
  const task={skin:state.selectedSkin,slot:0},key=(state.companions.find(p=>p.id===task.skin)||state.companions[0]).id;
  if(drawnPetSkin===key)return;
  const {pixels,width,height,alphaThreshold=1}=drawCompanionSVG($('#pet svg'),task,state.companions),rects=[];
  for(let y=0;y<height;y++){let x=0;while(x<width){while(x<width&&pixels[(y*width+x)*4+3]<alphaThreshold)x++;const l=x;while(x<width&&pixels[(y*width+x)*4+3]>=alphaThreshold)x++;if(l<x)rects.push({x:l,y,width:x-l,height:1});}}
  await call('shape',{rects,width,height});drawnPetSkin=key;window.petReady=true;
}
function renderLibrary(){
  $('#companion-list').replaceChildren(...state.companions.map(pack=>{
    const card=document.createElement('article');card.className='companion-card';card.dataset.id=pack.id;
    const canvas=document.createElement('canvas');canvas.width=40;canvas.height=24;drawCompanion(canvas,{skin:pack.id,slot:0},state.companions);
    const title=document.createElement('h2');title.textContent=pack.name;
    const description=document.createElement('p');description.textContent=pack.description;
    const badge=document.createElement('small');badge.textContent=pack.builtin?'内置伙伴':'我的创作';
    const button=document.createElement('button');button.textContent=state.selectedSkin===pack.id?'正在使用':'使用这个伙伴';button.disabled=state.selectedSkin===pack.id;button.addEventListener('click',safely(()=>call('selectCompanion',pack.id)));
    card.append(canvas,title,badge,description,button);return card;
  }));
  $('#companion-warnings').textContent=state.companionWarnings.length?'以下文件未能加载，原文件仍保留：'+state.companionWarnings.join('；'):'';
}
async function initPet() {
  const task=state.tasks.find(t=>t.id===id), pet=$('#pet');renderPetSize();
  await renderPetCharacter();
  let landingTimer;

  pet.title='轻点写心得，按住半秒捏起拖动';
  window.companion.onGesture(gesture=>{
    clearTimeout(landingTimer);
    pet.classList.remove('picked','landing');
    if(gesture.phase==='picked'){pet.classList.add('picked');pet.title='捏起来啦，保持按住鼠标移动，松手放下';}
    if(gesture.phase==='released'){pet.classList.add('landing');landingTimer=setTimeout(()=>pet.classList.remove('landing'),220);}
    if(gesture.phase!=='picked')pet.title='轻点写心得，按住半秒捏起拖动';
  });
  pet.addEventListener('pointerdown',safely(async event=>{if(event.button!==0)return;event.preventDefault();await call('pressStart');}));
  pet.addEventListener('pointerup',safely(async event=>{if(event.button===0)await call('pressEnd');}));
  // 拖出透明窗口后，移动和松手由主进程读取 Windows 状态，避免丢失事件。
  pet.addEventListener('keydown',safely(async event=>{if(event.key==='Escape')await call('pressCancel');if(event.key==='Enter'){const task=state.tasks.find(t=>t.day===state.today&&!t.done&&!deferredToday(t));if(task)await call('editor',{id:task.id});}}));
  window.companion.onExit(()=>{clearTimeout(landingTimer);pet.classList.remove('picked','landing');pet.classList.add('departing');});
}
async function init() {
  document.body.className=view; $(`#${view}`).hidden=false;await loadCompanionArt();state=await call('state');
  window.companion.onState(next=>{state=next;if(view==='manager')renderManager();if(view==='editor')renderEditor();if(view==='pet'){renderPetSize();renderPetCharacter().catch(error);}if(view==='library')renderLibrary();});
  if(view==='manager') {
    renderManager();
    if(state.startupWarning)$('#message').textContent=state.startupWarning;
    $('#pet-size').addEventListener('input',safely(()=>{const percent=Number($('#pet-size').value);syncSizeControls(percent,true);return changePetSize(percent);}));
    $('#pet-size-number').addEventListener('input',safely(()=>{const percent=validSizeNumber();if(percent!==null)return changePetSize(percent);}));
    $('#pet-size-number').addEventListener('blur',()=>{if(validSizeNumber()===null){$('#message').textContent='伙伴大小请输入 20～200 之间的整数，已恢复上次设置。';syncSizeControls(sizePending??state.petSize,true);}});
    $('#pet-size-number').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();if(validSizeNumber()!==null)event.target.blur();else event.target.reportValidity();}});
    $('#reset-size').addEventListener('click',safely(()=>{syncSizeControls(100,true);return changePetSize(100);}));
    $('#create-form').addEventListener('submit',safely(async event=>{event.preventDefault();await call('create',{text:$('#new-task').value});$('#new-task').value='';$('#message').textContent='事情已添加，点击桌面伙伴即可切换记录。';}));
    $('#open-library').addEventListener('click',safely(()=>call('library')));
    $('#records').addEventListener('click',safely(()=>call('records')));$('#quit').addEventListener('click',safely(()=>call('quit')));
  } else if(view==='library') {
    renderLibrary();
    $('#import-companion').addEventListener('click',safely(async()=>{const pack=await call('importCompanion');if(pack)$('#message').textContent='已导入：'+pack.name+'，点击“使用这个伙伴”即可应用。';}));
    $('#export-kit').addEventListener('click',safely(async()=>{const folder=await call('exportCompanionKit');if(folder)$('#message').textContent='创作包已保存到：'+folder+'。把这个文件夹交给你的 AI 即可。';}));
  } else if(view==='editor') {
    window.companion.onSelectTask(nextId=>switchEditor(nextId).catch(error));
    renderEditor();observeTextHeights();$('#title').addEventListener('input',scheduleSave);$('#note').addEventListener('input',scheduleSave);
    $('#complete').addEventListener('click',safely(async()=>{
      if(completing||switching)return;completing=true;$('#complete').disabled=true;$('#defer').disabled=true;
      try{clearTimeout(saveTimer);await Promise.all([saveEditor(),saveLayout()]);const task=state.tasks.find(t=>t.id===id);await call(task.done?'reopen':'complete',{id,patch:patch()});dirty=false;}
      finally{completing=false;$('#complete').disabled=false;$('#defer').disabled=false;}
    }));
    $('#defer').addEventListener('click',safely(async()=>{
      if(completing||switching)return;completing=true;$('#complete').disabled=true;$('#defer').disabled=true;
      try { await Promise.all([saveEditor(),saveLayout()]);const task=state.tasks.find(t=>t.id===id);await call(deferredToday(task)?'resume':'defer',{id,patch:patch()});dirty=false; }
      finally { completing=false;$('#complete').disabled=false;$('#defer').disabled=false; }
    }));
    // 主进程先拦截关闭，保存文字和尺寸成功后再关闭，避免浏览器离开提示。
    let editorClosing=false;
    window.companion.onCloseRequest(async()=>{if(editorClosing)return;editorClosing=true;try{await Promise.all([saveEditor(),saveLayout()]);await call('close');}catch(e){editorClosing=false;error(e);}});
  } else if(view==='pet') await initPet();
  else if(view==='reward') {
    drawSmile($('#reward canvas'));const lines=params.get('all')==='1'?['三件事都完成啦，今天辛苦了！','今天也过得很棒，为你鼓掌！']:['又做好一件事啦，为你开心！','你认真努力的样子，闪闪发光。','一步一步，已经走得很棒啦！','小小的坚持，也有大大的力量。','今天的你，值得一个大大的拥抱。'];
    const text=lines[Number(params.get('phrase'))%lines.length];Array.from(text).forEach(char=>{const span=document.createElement('span');span.textContent=char;$('#reward-copy').append(span);});
    setTimeout(()=>$('#reward').classList.add('fading'),2800);
  }
}
init().catch(error);
