const assert=require('node:assert/strict'),path=require('node:path');
let playwright;try{playwright=require('playwright');}catch(_){playwright=require('C:/Users/91524/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
let app;
(async()=>{try{
  const env={...process.env,CAPSULE_TEST_ROOT:path.resolve('.desktop-test/tap-'+Date.now())};delete env.ELECTRON_RUN_AS_NODE;
  app=await playwright._electron.launch({executablePath:process.env.CAPSULE_TEST_EXE||require('electron'),args:process.env.CAPSULE_TEST_EXE?[]:[path.resolve('.')],env});
  const manager=await app.firstWindow();await manager.locator('#new-task').fill('轻点立刻记录');await manager.locator('#create').click();
  let pet;for(let i=0;i<100;i++){pet=app.windows().find(w=>w.url().includes('view=pet'));if(pet)break;await new Promise(r=>setTimeout(r,30));}
  await pet.waitForFunction(()=>window.petReady);
  const started=Date.now();await pet.locator('#pet').click({position:{x:60,y:30}});
  for(let i=0;i<20;i++){if(app.windows().some(w=>w.url().includes('view=editor')))break;await new Promise(r=>setTimeout(r,10));}
  assert.ok(app.windows().some(w=>w.url().includes('view=editor')),'轻点没有打开输入框');assert.ok(Date.now()-started<500,'轻点仍在等待双击');
  assert.equal(await pet.locator('#pet.picked').count(),0);assert.equal(await pet.locator('#pet.unlocked').count(),0);
  console.log('Tap OK: editor opens on release without double-click delay. Long-press timing and release positions are covered by hold.test.js.');
}finally{if(app)await app.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
