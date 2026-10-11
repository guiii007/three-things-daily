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
    await pet.locator('#pet').click({position:{x:60,y:30}});const editor=await pageFor('editor',task.id);
    assert.equal(await editor.locator('input[type=file], #image-preview').count(),0);
    await editor.locator('#note').fill('第一行心得\n最后一笔立即完成也要记录');
    await editor.evaluate(()=>document.fonts.ready);await editor.screenshot({path:path.join(root,'editor.png')});
    await editor.locator('#complete').click();await manager.waitForFunction(()=>document.querySelector('.task-info small').textContent.includes('已完成'));
    snapshot=await invoke(manager,'state');task=snapshot.tasks[0];assert.equal(task.done,true);assert.match(fs.readFileSync(task.recordPath,'utf8'),/最后一笔立即完成也要记录/);
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
    await application.close();application=null;
    manager=await launch();snapshot=await invoke(manager,'state');assert.equal(snapshot.tasks.length,3);assert.equal(snapshot.tasks[0].note,'第一行心得\n最后一笔立即完成也要记录');
    const windows=await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().includes('view=pet')).length);assert.equal(windows,3);
    await manager.screenshot({path:path.join(root,'manager.png')});
    assert.deepEqual(errors,[]);console.log('Desktop smoke OK: creation, transparent pets, editor, latest notes, native TXT, reward/fade, daily limit, reopen, tray persistence, restart.');console.log('Test artifacts: '+root);
  }finally{if(application)await application.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
