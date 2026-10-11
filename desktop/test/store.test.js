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
  assert.throws(()=>store.create('第四件',today),/三个/);
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
