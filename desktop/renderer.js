const params = new URLSearchParams(location.search), view = params.get('view'), id = params.get('id');
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
  const value = patch(); dirty = false; saving++;
  saveQueue = saveQueue.catch(() => {}).then(() => call('update', { id, patch: value })).then(() => { $('#save-status').textContent = dirty ? '正在保存…' : '已自动保存'; }).catch(e => { dirty = true; $('#save-status').textContent = '保存失败，请重试'; error(e); throw e; }).finally(() => saving--);
  return saveQueue;
}
function scheduleSave() { dirty = true; $('#save-status').textContent = '正在保存…'; clearTimeout(saveTimer); saveTimer = setTimeout(() => saveEditor().catch(() => {}), 300); }
function renderEditor() {
  const task = state.tasks.find(t => t.id === id); if (!task) return;
  if (!editingLoaded) { $('#title').value = task.text; $('#note').value = task.note; editingLoaded = true; }
  drawCapsule($('#editor-art'), task.slot);
  $('#status').textContent = task.done ? '这件事已完成' : '这件事正在进行中';
  $('#time').textContent = `创建 ${new Date(task.createdAt).toLocaleString('zh-CN')}` + (task.completedAt ? ` · 完成 ${new Date(task.completedAt).toLocaleString('zh-CN')}` : '');
  $('#complete').textContent = task.done ? '重新开启这件事' : '这件事完成啦 √';
}
function taskRow(task) {
  const row = document.createElement('div'); row.className = 'task-row'; row.dataset.id = task.id;
  const canvas = document.createElement('canvas'); canvas.width=40; canvas.height=24; drawCapsule(canvas,task.slot);
  const info = document.createElement('div'); info.className = 'task-info';
  const text = document.createElement('div'); text.textContent = task.text;
  const meta = document.createElement('small'); meta.textContent = `${task.day} · ${['红色胶囊','黄色胶囊','绿色胶囊'][task.slot]} · ${task.done?'已完成':'待完成'}`;
  info.append(text,meta); const actions = document.createElement('div'); actions.className = 'task-actions';
  const edit = document.createElement('button'); edit.textContent = task.done ? '查看记录' : '写心得'; edit.addEventListener('click',safely(() => call('editor',{id:task.id}))); actions.append(edit);
  if(task.done) { const txt=document.createElement('button'); txt.textContent='补存 TXT'; txt.addEventListener('click',safely(async()=>{$('#message').textContent='已保存：'+await call('export',{id:task.id});})); actions.append(txt); }
  row.append(canvas,info,actions); return row;
}
let sizePending = null, sizeUpdating = false;
function renderPetSize() {
  const width=Math.round(120*state.petSize/100),height=Math.round(72*state.petSize/100);
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
  const today=state.tasks.filter(t=>t.day===state.today), past=state.tasks.filter(t=>t.day!==state.today).slice().reverse();
  if(!sizeUpdating)syncSizeControls();
  $('#count').textContent=`${state.today} · 已创建 ${today.length} / 3 · 完成 ${today.filter(t=>t.done).length}`;
  $('#create').disabled=today.length>=3; $('#new-task').disabled=today.length>=3;
  $('#today-list').replaceChildren(...today.map(taskRow));
  if(!today.length) { const empty=document.createElement('p'); empty.className='empty'; empty.textContent='写下第一件事，让红色伙伴来陪你。'; $('#today-list').append(empty); }
  $('#history-list').replaceChildren(...past.map(taskRow));
  $('#history summary').textContent=`过去的任务与记录（${past.length}）`;
  $('#folder').textContent=`完成后 TXT 自动保存到：${state.recordsDir}`;
}
async function initPet() {
  const task=state.tasks.find(t=>t.id===id), pet=$('#pet');renderPetSize();
  const pixels=drawCapsuleSVG(pet.querySelector('svg'),task.slot), rects=[];
  for(let y=0;y<24;y++){let x=0;while(x<40){while(x<40&&!pixels[(y*40+x)*4+3])x++;const l=x;while(x<40&&pixels[(y*40+x)*4+3])x++;if(l<x)rects.push({x:l,y,width:x-l,height:1});}}
  await call('shape',rects); window.petReady=true;
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
  pet.addEventListener('keydown',safely(async event=>{if(event.key==='Escape')await call('pressCancel');if(event.key==='Enter')await call('editor',{id});}));
  window.companion.onExit(()=>{clearTimeout(landingTimer);pet.classList.remove('picked','landing');pet.classList.add('departing');});
}
async function init() {
  document.body.className=view; $(`#${view}`).hidden=false; state=await call('state');
  window.companion.onState(next=>{state=next;if(view==='manager')renderManager();if(view==='editor')renderEditor();if(view==='pet')renderPetSize();});
  if(view==='manager') {
    renderManager();
    $('#pet-size').addEventListener('input',safely(()=>{const percent=Number($('#pet-size').value);syncSizeControls(percent,true);return changePetSize(percent);}));
    $('#pet-size-number').addEventListener('input',safely(()=>{const percent=validSizeNumber();if(percent!==null)return changePetSize(percent);}));
    $('#pet-size-number').addEventListener('blur',()=>{if(validSizeNumber()===null){$('#message').textContent='伙伴大小请输入 20～200 之间的整数，已恢复上次设置。';syncSizeControls(sizePending??state.petSize,true);}});
    $('#pet-size-number').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();if(validSizeNumber()!==null)event.target.blur();else event.target.reportValidity();}});
    $('#reset-size').addEventListener('click',safely(()=>{syncSizeControls(100,true);return changePetSize(100);}));
    $('#create-form').addEventListener('submit',safely(async event=>{event.preventDefault();await call('create',{text:$('#new-task').value});$('#new-task').value='';$('#message').textContent='伙伴已来到桌面。可以关掉这个窗口，开始做事啦。';}));
    $('#records').addEventListener('click',safely(()=>call('records')));$('#quit').addEventListener('click',safely(()=>call('quit')));
  } else if(view==='editor') {
    renderEditor();$('#title').addEventListener('input',scheduleSave);$('#note').addEventListener('input',scheduleSave);
    $('#complete').addEventListener('click',safely(async()=>{
      if(completing)return;completing=true;$('#complete').disabled=true;
      try{clearTimeout(saveTimer);await saveEditor();const task=state.tasks.find(t=>t.id===id);await call(task.done?'reopen':'complete',{id,patch:patch()});dirty=false;if(task.done)await call('close');}
      finally{completing=false;$('#complete').disabled=false;}
    }));
    // 关闭时先完成待保存内容，防止最后一笔心得丢失。
    window.addEventListener('beforeunload',event=>{if(dirty||saving){event.preventDefault();event.returnValue='';saveEditor().then(()=>call('close')).catch(()=>{});}});
  } else if(view==='pet') await initPet();
  else if(view==='reward') {
    drawSmile($('#reward canvas'));const lines=params.get('all')==='1'?['三件事都完成啦，今天辛苦了！','今天也过得很棒，为你鼓掌！']:['又做好一件事啦，为你开心！','你认真努力的样子，闪闪发光。','一步一步，已经走得很棒啦！','小小的坚持，也有大大的力量。','今天的你，值得一个大大的拥抱。'];
    const text=lines[Number(params.get('phrase'))%lines.length];Array.from(text).forEach(char=>{const span=document.createElement('span');span.textContent=char;$('#reward-copy').append(span);});
    setTimeout(()=>$('#reward').classList.add('fading'),2800);
  }
}
init().catch(error);
