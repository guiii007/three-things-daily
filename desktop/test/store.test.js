const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Store, dayKey } = require('../store');
function setup(t) {
  const parent = path.resolve('.desktop-test'); fs.mkdirSync(parent,{recursive:true});
  const dir = fs.mkdtempSync(path.join(parent, 'capsule-store-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { store: new Store(path.join(dir,'tasks.json'),path.join(dir,'records')), dir };
}
test('每天最多三个，完成后不释放名额，第二天重新计算', t => {
  const { store }=setup(t), today=new Date(2026,9,11,10).getTime(), tomorrow=new Date(2026,9,12,10).getTime();
  const task=store.create('第一件',today);store.create('第二件',today);store.create('第三件',today);
  store.complete(task.id,{note:'做完啦'},today+1000);
  assert.throws(()=>store.create('第四件',today),/三件事/);
  assert.equal(store.create('新的一天',tomorrow).slot,0);
  assert.equal(store.data.tasks.length,4);
});
test('TXT 含最新的中文心得、时间、BOM，重启恢复完成状态',t=>{
  const { store,dir }=setup(t),now=new Date(2026,9,11,10).getTime();
  const task=store.create('中文 / 任务: <测试>?',now);
  const done=store.complete(task.id,{text:'更新后的任务',note:'第一行\n最后一笔心得'},now+5000);
  const bytes=fs.readFileSync(done.task.recordPath),text=bytes.toString('utf8');
  assert.deepEqual([...bytes.subarray(0,3)],[239,187,191]);
  assert.match(text,/更新后的任务/);assert.match(text,/最后一笔心得/);assert.match(text,/2026-10-11 10:00:05/);
  const restored=new Store(path.join(dir,'tasks.json'),store.recordsDir);
  assert.equal(restored.task(task.id).done,true);assert.equal(restored.task(task.id).note,'第一行\n最后一笔心得');
  assert.equal(store.complete(task.id,{},now+6000).alreadyDone,true);
});
test('写入 TXT 失败不标记完成，心得仍保留，可以重试',t=>{
  const {store,dir}=setup(t),task=store.create('不能丢的事情');
  fs.writeFileSync(path.join(dir,'blocked'),'不是文件夹');store.recordsDir=path.join(dir,'blocked');
  assert.throws(()=>store.complete(task.id,{note:'写入失败也要保留'}));
  assert.equal(store.task(task.id).done,false);assert.equal(store.task(task.id).note,'写入失败也要保留');
  store.recordsDir=path.join(dir,'records');assert.ok(fs.existsSync(store.complete(task.id,{}).task.recordPath));
});
test('重新开启后再次完成生成新 TXT，保留上一次完成记录',t=>{
  const {store}=setup(t),task=store.create('反复打磨');
  const first=store.complete(task.id,{note:'第一次完成'},Date.now());store.reopen(task.id);
  const second=store.complete(task.id,{note:'第二次完成'},Date.now()+1000);
  assert.notEqual(first.task.recordPath,second.task.recordPath);
  assert.match(fs.readFileSync(first.task.recordPath,'utf8'),/第一次完成/);
  assert.match(fs.readFileSync(second.task.recordPath,'utf8'),/第二次完成/);
});
test('纯文字任务保持位置，兼容旧版含附图的记录',t=>{
  const {store,dir}=setup(t),task=store.create('写下感悟');store.move(task.id,{x:-20,y:80});
  assert.equal('images' in store.task(task.id),false);
  const file=path.join(dir,'tasks.json'),legacy=JSON.parse(fs.readFileSync(file,'utf8'));
  legacy.tasks[0].images=['data:image/png;base64,AAAA'];legacy.tasks[0].note='旧版心得';
  fs.writeFileSync(file,JSON.stringify(legacy));
  const restored=new Store(file,store.recordsDir);assert.deepEqual(restored.task(task.id).position,{x:-20,y:80});
  assert.equal(restored.task(task.id).note,'旧版心得');
  restored.update(task.id,{images:['不再支持上传']});
  assert.deepEqual(restored.task(task.id).images,legacy.tasks[0].images);
  const done=restored.complete(task.id,{note:'文字记录'});
  const text=fs.readFileSync(done.task.recordPath,'utf8');assert.match(text,/文字记录/);assert.doesNotMatch(text,/附图|data:image/);
});
test('数据损坏时不覆盖原文件',t=>{
  const {dir}=setup(t),file=path.join(dir,'tasks.json');fs.writeFileSync(file,'损坏的数据');
  assert.throws(()=>new Store(file,path.join(dir,'records')));assert.equal(fs.readFileSync(file,'utf8'),'损坏的数据');
});
test('安全文件名和日期以本地日历计算',t=>{
  const {store}=setup(t),now=new Date(2026,9,11,23,59).getTime();const task=store.create('../危险:*?"<>|文件',now);
  const done=store.complete(task.id,{note:'记录'},now+1000);assert.equal(dayKey(now),'2026-10-11');assert.equal(path.dirname(done.task.recordPath),store.recordsDir);
  assert.ok(!/[<>:"/\\|?*]/.test(path.basename(done.task.recordPath)));
});

test('伙伴大小保存、范围校验以及旧版默认 100%',t=>{
  const {store,dir}=setup(t);store.create('保持任务');assert.equal(store.data.petSize,100);
  for(const percent of [20,137,200]){store.setPetSize(percent);assert.equal(new Store(store.file,store.recordsDir).data.petSize,percent);}
  for(const value of [19,201,100.5,'100',NaN])assert.throws(()=>store.setPetSize(value),/20%/);
  const legacy=store.snapshot();delete legacy.petSize;fs.writeFileSync(store.file,JSON.stringify(legacy));
  const restored=new Store(store.file,store.recordsDir);assert.equal(restored.data.petSize,100);assert.equal(restored.data.tasks.length,1);
});

test('任务窗口与文本框大小记住最后调整，并兼容旧数据',t=>{
  const {store}=setup(t);const task=store.create('保留我的心得');store.update(task.id,{note:'已有内容'});
  assert.deepEqual(store.data.editorLayout,{width:430,height:530,titleHeight:null,noteHeight:null});
  store.setEditorLayout({width:680,height:720});store.setEditorLayout({titleHeight:132,noteHeight:340});
  store.setEditorLayout({width:640,height:680,noteHeight:280});
  const restored=new Store(store.file,store.recordsDir);
  assert.deepEqual(restored.data.editorLayout,{width:640,height:680,titleHeight:132,noteHeight:280});assert.equal(restored.task(task.id).note,'已有内容');
  for(const invalid of [{width:NaN},{height:99},{noteHeight:149},{titleHeight:'132'},{width:10001}])assert.throws(()=>restored.setEditorLayout(invalid),/大小无效/);
  const legacy=store.snapshot();delete legacy.editorLayout;fs.writeFileSync(store.file,JSON.stringify(legacy));
  assert.deepEqual(new Store(store.file,store.recordsDir).data.editorLayout,{width:430,height:530,titleHeight:null,noteHeight:null});
});

test('部分完成保存今日进度，保留未完成状态、心得和每日名额',t=>{
  const {isDeferred,tomorrowKey}=require('../store');const {store}=setup(t),today=new Date(2026,9,12,23,59).getTime(),tomorrow=new Date(2026,9,13,9).getTime();
  const task=store.create('跨天的任务',today);store.create('第二件',today);store.create('第三件',today);store.move(task.id,{x:90,y:80});
  const result=store.defer(task.id,{note:'今天完成第一部分，下一步继续'},today);
  assert.equal(result.task.done,false);assert.equal(result.task.completedAt,null);assert.equal(store.data.rewardCount,0);
  assert.equal(result.task.deferredUntil,tomorrowKey(today));assert.equal(result.task.deferredUntil,'2026-10-13');
  assert.ok(isDeferred(result.task,today));assert.equal(isDeferred(result.task,tomorrow),false);
  const file=result.task.progressRecords[0].path,text=fs.readFileSync(file,'utf8');
  assert.match(text,/今天完成了一部分，明天继续干/);assert.match(text,/下一步继续/);assert.match(text,/继续日期：2026-10-13/);assert.doesNotMatch(text,/完成状态：已完成/);assert.equal(path.dirname(file),store.recordsDir);
  assert.equal(store.defer(task.id,{},today+10).alreadyDeferred,true);assert.equal(store.task(task.id).progressRecords.length,1);
  assert.throws(()=>store.create('第四件',today),/三件事/);
  const restored=new Store(store.file,store.recordsDir);assert.ok(isDeferred(restored.task(task.id),today));assert.deepEqual(restored.task(task.id).position,{x:90,y:80});
  assert.equal(restored.task(task.id).note,'今天完成第一部分，下一步继续');assert.equal(restored.create('明天新任务',tomorrow).slot,0);
});
test('可以当天恢复，再记进度或彻底完成，旧进度 TXT 保留',t=>{
  const {isDeferred}=require('../store');const {store}=setup(t),now=new Date(2026,9,12,12).getTime(),task=store.create('继续努力',now);
  const first=store.defer(task.id,{note:'第一阶段'},now).task.progressRecords[0].path;store.resume(task.id);assert.equal(isDeferred(store.task(task.id),now),false);
  const second=store.defer(task.id,{note:'第二阶段'},now).task.progressRecords[1].path;assert.notEqual(first,second);
  const complete=store.complete(task.id,{note:'终于完成'},now+1000).task;
  assert.equal(complete.done,true);assert.equal(complete.deferredUntil,null);assert.equal(complete.progressRecords.length,2);
  assert.match(fs.readFileSync(first,'utf8'),/第一阶段/);assert.match(fs.readFileSync(second,'utf8'),/第二阶段/);assert.match(fs.readFileSync(complete.recordPath,'utf8'),/完成状态：已完成/);
  assert.throws(()=>store.defer(task.id,{note:'不能改动'},now),/已经完成/);assert.equal(store.task(task.id).note,'终于完成');
});
test('进度 TXT 写入失败不让伙伴休息，最新文字仍保留',t=>{
  const {store,dir}=setup(t),task=store.create('不能丢失进度');const blocked=path.join(dir,'blocked-progress');fs.writeFileSync(blocked,'不是目录');store.recordsDir=blocked;
  assert.throws(()=>store.defer(task.id,{note:'这段文字要保留'}));assert.equal(store.task(task.id).done,false);assert.equal(store.task(task.id).deferredUntil,null);assert.equal(store.task(task.id).progressRecords.length,0);assert.equal(store.task(task.id).note,'这段文字要保留');
});

test('旧任务位置迁移到共享伙伴，位置跨任务与重启保留',t=>{
 const {store}=setup(t);const a=store.create('已有事情');store.move(a.id,{x:123,y:456});const old=store.snapshot();delete old.companionPosition;fs.writeFileSync(store.file,JSON.stringify(old));const migrated=new Store(store.file,store.recordsDir);assert.deepEqual(migrated.data.companionPosition,{x:123,y:456});migrated.moveCompanion({x:222.4,y:333.6});migrated.create('新增事情');assert.deepEqual(new Store(store.file,store.recordsDir).data.companionPosition,{x:222,y:334});assert.throws(()=>migrated.moveCompanion({x:NaN,y:1}),/位置/);
});
