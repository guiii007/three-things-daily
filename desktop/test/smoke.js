// 使用真实 Electron 窗口；所有数据与 TXT 隔离在 .desktop-test 中。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let playwright;
try { playwright = require('playwright'); } catch (_) {
  playwright = require('C:/Users/91524/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
}
const root = path.resolve('.desktop-test/smoke-' + Date.now());
const executablePath = process.env.CAPSULE_TEST_EXE || require('electron');
const errors=[];
let application;
async function launch() {
  const env={...process.env,CAPSULE_TEST_ROOT:root}; delete env.ELECTRON_RUN_AS_NODE;
  application=await playwright._electron.launch({executablePath,args:process.env.CAPSULE_TEST_EXE?[]:[path.resolve('.')],env,timeout:60000});
  application.on('window',page=>page.on('pageerror',e=>errors.push(e.message)));
  return pageFor('manager');
}
async function pageFor(view,id) {
  for(let n=0;n<100;n++) {
    const page=application.windows().find(p=>{const u=new URL(p.url());return u.searchParams.get('view')===view&&(!id||u.searchParams.get('id')===id);});
    if(page){await page.waitForSelector(`#${view}:not([hidden])`);return page;}
    await new Promise(r=>setTimeout(r,50));
  }throw new Error('未找到窗口 '+view);
}
async function invoke(page,method,value) {
  const result=await page.evaluate(async({method,value})=>window.companion.call(method,value),{method,value});
  assert.equal(result.ok,true,result.error);return result.value;
}
(async()=>{
  try{
    let manager=await launch();
    assert.equal(await manager.locator('#hide-manager').count(),0);
    await manager.locator('#new-task').fill('软件实测 / 中文任务');await manager.locator('#create').click();
    await manager.waitForFunction(()=>document.querySelector('#count').textContent.includes('已创建 1'));
    let snapshot=await invoke(manager,'state'),task=snapshot.tasks[0];const pet=await pageFor('pet',task.id);
    assert.equal(await pet.evaluate(()=>document.body.className),'pet');
    await pet.waitForFunction(()=>window.petReady===true); await new Promise(r=>setTimeout(r,500));
    const props=await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().includes('view=pet')).map(w=>({bounds:w.getBounds(),top:w.isAlwaysOnTop(),visible:w.isVisible(),focusable:w.isFocusable()})));
    console.log('Native pet properties:',JSON.stringify(props));
    assert.equal(props.length,1);assert.equal(props[0].bounds.width,120);assert.equal(props[0].bounds.height,72);assert.ok(props[0].top);assert.equal(props[0].focusable,false);
    const sizeNumber=manager.locator('#pet-size-number');
    await sizeNumber.fill('');await sizeNumber.pressSequentially('137');
    assert.equal(await sizeNumber.inputValue(),'137');
    await manager.waitForFunction(async()=>(await window.companion.call('state')).value.petSize===137);
    for(const percent of [48,132,20,200]){
      await sizeNumber.fill(String(percent));
      await manager.waitForFunction(async value=>(await window.companion.call('state')).value.petSize===value,percent);
      await pet.waitForFunction(value=>document.querySelector('#pet').clientWidth===Math.round(120*value/100),percent);
      assert.equal(await manager.locator('#pet-size').inputValue(),String(percent));
    }
    for(const invalid of ['', '19', '201', '120.5']){
      await sizeNumber.fill(invalid);assert.equal((await invoke(manager,'state')).petSize,200);
      await manager.locator('#count').click();assert.equal(await sizeNumber.inputValue(),'200');
    }
    for(const percent of [20,137,200]) {
      await manager.locator('#pet-size').evaluate((input,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));},percent);
      await manager.waitForFunction(async value=>(await window.companion.call('state')).value.petSize===value,percent);
      await pet.waitForFunction(value=>document.querySelector('#pet').clientWidth===Math.round(120*value/100),percent);
      const bounds=await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('view=pet')).getBounds());
      assert.equal(bounds.width,Math.max(64,Math.round(120*percent/100)));assert.equal(bounds.height,Math.max(64,Math.round(72*percent/100)));
      assert.ok(await pet.locator('svg rect').count()>100);assert.equal(await sizeNumber.inputValue(),String(percent));
      if(percent===20){await pet.locator('#pet').click({position:{x:14,y:7}});const tinyEditor=await pageFor('editor',task.id);const tinyClosed=tinyEditor.waitForEvent('close');await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('view=editor')).close());await tinyClosed;}
      if(percent===200)await pet.screenshot({path:path.join(root,'pet-200.png')});
    }
    await manager.locator('#reset-size').click();await pet.waitForFunction(()=>document.querySelector('#pet').clientWidth===120);
    assert.equal(await sizeNumber.inputValue(),'100');
    await pet.locator('#pet').click({position:{x:60,y:30}});let editor=await pageFor('editor',task.id);
    await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('view=editor')).setSize(680,720));
    await editor.evaluate(()=>{document.querySelector('#title').style.height='132px';document.querySelector('#note').style.height='340px';});
    await editor.locator('#note').fill('调整后立刻关闭也要保留');
    let closed=editor.waitForEvent('close');await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('view=editor')).close());await closed;
    await invoke(manager,'editor',{id:task.id});editor=await pageFor('editor',task.id);
    let rememberedBounds=await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('view=editor')).getNormalBounds());
    assert.equal(rememberedBounds.width,680);assert.equal(rememberedBounds.height,720);
    assert.equal(await editor.locator('#note').inputValue(),'调整后立刻关闭也要保留');
    assert.equal(await editor.locator('#title').evaluate(e=>Math.round(e.getBoundingClientRect().height)),132);
    assert.equal(await editor.locator('#note').evaluate(e=>Math.round(e.getBoundingClientRect().height)),340);
    await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('view=editor')).setSize(640,680));
    await editor.locator('#note').evaluate(e=>e.style.height='280px');
    closed=editor.waitForEvent('close');await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('view=editor')).close());await closed;
    await invoke(manager,'editor',{id:task.id});editor=await pageFor('editor',task.id);
    rememberedBounds=await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('view=editor')).getNormalBounds());
    assert.equal(rememberedBounds.width,640);assert.equal(rememberedBounds.height,680);
    assert.equal(await editor.locator('#note').evaluate(e=>Math.round(e.getBoundingClientRect().height)),280);
    assert.equal(await editor.locator('input[type=file], #image-preview').count(),0);
    await editor.locator('#note').fill('第一行心得\n最后一笔立即完成也要记录');
    await editor.evaluate(()=>document.fonts.ready);await editor.screenshot({path:path.join(root,'editor.png')});
    await editor.locator('#complete').click();await manager.waitForFunction(()=>document.querySelector('.task-info small').textContent.includes('已完成'));
    snapshot=await invoke(manager,'state');task=snapshot.tasks[0];assert.equal(task.done,true);assert.equal(path.dirname(task.recordPath),snapshot.recordsDir);assert.match(fs.readFileSync(task.recordPath,'utf8'),/最后一笔立即完成也要记录/);
    const reward=await pageFor('reward');await reward.waitForSelector('#reward-copy span');
    assert.ok(await reward.locator('#reward-copy span').count()>5);
    await reward.evaluate(()=>document.fonts.ready);await reward.screenshot({path:path.join(root,'reward.png')});
    await new Promise(r=>setTimeout(r,300));
    assert.equal(await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('view=reward')).isAlwaysOnTop()),true);
    await reward.waitForSelector('#reward.fading',{timeout:6000});
    await manager.locator('.task-actions button').first().click();const completedEditor=await pageFor('editor',task.id);assert.equal(await completedEditor.locator('#note').inputValue(),'第一行心得\n最后一笔立即完成也要记录');
    await completedEditor.locator('#complete').click();await manager.waitForFunction(()=>document.querySelector('.task-info small').textContent.includes('待完成'));
    await invoke(manager,'create',{text:'第二件'});await invoke(manager,'create',{text:'第三件'});
    const fourth=await manager.evaluate(()=>window.companion.call('create',{text:'不能创建第四件'}));assert.equal(fourth.ok,false);
    snapshot=await invoke(manager,'state');for(const pending of snapshot.tasks.filter(t=>!t.done)){const petPage=await pageFor('pet',pending.id);await petPage.waitForFunction(()=>window.petReady);}
    snapshot=await invoke(manager,'state');
    await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('view=manager')).close());const hidden=await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('view=manager')).isVisible());assert.equal(hidden,false);
    assert.ok((await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().includes('view=pet')).every(w=>w.isVisible()))));
    await invoke(manager,'petSize',137);
    await application.close();application=null;
    manager=await launch();snapshot=await invoke(manager,'state');assert.equal(snapshot.petSize,137);assert.equal(await manager.locator('#pet-size-number').inputValue(),'137');assert.equal(snapshot.tasks.length,3);assert.equal(snapshot.tasks[0].note,'第一行心得\n最后一笔立即完成也要记录');
    for(const task of snapshot.tasks){const resized=await pageFor('pet',task.id);await resized.waitForFunction(()=>window.petReady);assert.equal(await resized.locator('#pet').evaluate(p=>p.clientWidth),164);}
    assert.deepEqual(snapshot.editorLayout,{width:640,height:680,titleHeight:132,noteHeight:280});
    await invoke(manager,'editor',{id:snapshot.tasks[1].id});const nextTaskEditor=await pageFor('editor',snapshot.tasks[1].id);
    const restoredBounds=await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('view=editor')).getNormalBounds());
    assert.equal(restoredBounds.width,640);assert.equal(restoredBounds.height,680);
    assert.equal(await nextTaskEditor.locator('#note').evaluate(e=>Math.round(e.getBoundingClientRect().height)),280);
    const windows=await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().includes('view=pet')).length);assert.equal(windows,3);
    await nextTaskEditor.locator('#note').fill('刚刚完成了第一步，明天继续第二步');
    const restingPet=await pageFor('pet',snapshot.tasks[1].id),rested=restingPet.waitForEvent('close');
    await nextTaskEditor.evaluate(()=>document.fonts.ready);await nextTaskEditor.screenshot({path:path.join(root,'partial-editor.png')});
    await nextTaskEditor.locator('#defer').click();await rested;
    snapshot=await invoke(manager,'state');const partialTask=snapshot.tasks[1];assert.equal(partialTask.done,false);assert.ok(partialTask.deferredUntil>snapshot.today);assert.equal(partialTask.progressRecords.length,1);
    assert.match(fs.readFileSync(partialTask.progressRecords[0].path,'utf8'),/刚刚完成了第一步/);
    assert.equal(await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().includes('view=pet')).length),2);
    await application.close();application=null;manager=await launch();snapshot=await invoke(manager,'state');
    assert.equal(snapshot.tasks[1].deferredUntil,partialTask.deferredUntil);assert.equal(snapshot.tasks[1].done,false);
    assert.equal(await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().includes('view=pet')).length),2);
    await invoke(manager,'editor',{id:partialTask.id});const resumeEditor=await pageFor('editor',partialTask.id);
    assert.equal(await resumeEditor.locator('#note').inputValue(),'刚刚完成了第一步，明天继续第二步');assert.match(await resumeEditor.locator('#defer').textContent(),/今天继续干/);
    await resumeEditor.locator('#defer').click();const returnedPet=await pageFor('pet',partialTask.id);await returnedPet.waitForFunction(()=>window.petReady);
    assert.equal((await invoke(manager,'state')).tasks[1].deferredUntil,null);
    // 仅在隔离的测试进程里快进日期，验证跨日不会恢复旧伙伴。
    const restingAgain=returnedPet.waitForEvent('close');await resumeEditor.locator('#defer').click();await restingAgain;
    const tomorrow=(await invoke(manager,'state')).tasks[1].deferredUntil;
    await application.evaluate(({},date)=>{const next=new Date(date+'T09:00:00').getTime();Date.now=()=>next;},tomorrow);
    await manager.waitForFunction(date=>document.querySelector('#count').textContent.startsWith(date),tomorrow,{timeout:20000});
    assert.equal(await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().includes('view=pet')).length),0);
    assert.equal((await invoke(manager,'state')).tasks.length,3);
    await invoke(manager,'resume',{id:partialTask.id});
    assert.equal(await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().includes('view=pet')).length),0);
    const fresh=await invoke(manager,'create',{text:'今天重新出发，继续第二步'});const freshPet=await pageFor('pet',fresh.id);await freshPet.waitForFunction(()=>window.petReady);
    assert.equal(fresh.slot,0);assert.equal(fresh.day,tomorrow);
    assert.equal(await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().includes('view=pet')).length),1);
    assert.equal((await invoke(manager,'state')).tasks[1].done,false);
    await manager.screenshot({path:path.join(root,'manager.png')});
    assert.deepEqual(errors,[]);console.log('Desktop smoke OK: creation, transparent pets, editor, latest notes, native TXT, reward/fade, daily limit, reopen, tray persistence, restart.');console.log('Test artifacts: '+root);
  }finally{if(application)await application.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
