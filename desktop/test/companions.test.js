const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { CompanionLibrary } = require('../companions');
const { validatePack, parsePack } = require('../companion-kit/format');
const { run } = require('../companion-kit/cli');
const { Store } = require('../store');
const example = require('../companion-kit/example.companion.json');
function setup(t) { const root=path.resolve('.desktop-test');fs.mkdirSync(root,{recursive:true});const dir=fs.mkdtempSync(path.join(root,'library-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir; }
test('伙伴文件拒绝无效网格、代码颜色、路径 id、空角色和超大文件',()=>{
  assert.equal(validatePack(example).id,'chick');
  for(const change of [{id:'../../escape'},{width:129},{name:''},{palette:{O:'url(https://invalid)'}},{frames:{idle:Array(24).fill('.'.repeat(40))}},{frames:{idle:['A']}}])assert.throws(()=>validatePack({...example,...change}));
  assert.throws(()=>parsePack(' '.repeat(65537)),/64 KB/);
});
test('内置伙伴、导入持久化与重复 id 保护',t=>{
  const dir=setup(t),library=new CompanionLibrary(path.join(dir,'companions'));assert.deepEqual(library.packs.map(p=>p.id),['capsule','chick']);
  const file=path.join(dir,'custom.json');fs.writeFileSync(file,JSON.stringify({...example,id:'my-bird',name:'我的小鸟'}));library.import(file);
  assert.equal(new CompanionLibrary(library.dir).get('my-bird').name,'我的小鸟');assert.throws(()=>library.import(file),/相同 id/);
  fs.writeFileSync(file,JSON.stringify(example));assert.throws(()=>library.import(file),/相同 id/);
  fs.writeFileSync(path.join(library.dir,'broken.json'),'坏掉的文件');const restored=new CompanionLibrary(library.dir);assert.equal(restored.packs.length,3);assert.equal(restored.warnings.length,1);
});
test('独立 AI 工具能够生成、校验和预览一个新伙伴',t=>{
  const dir=setup(t),file=path.join(dir,'agent-bird.companion.json');run(['init',file,'--id','agent-bird','--name','AI 小鸟']);assert.match(run(['validate',file]),/校验通过/);run(['preview',file]);assert.match(fs.readFileSync(file.replace(/\.json$/,'.preview.html'),'utf8'),/<svg/);assert.throws(()=>run(['init',file]),/EEXIST/);
});
test('选择形象更新今天未完成任务及新任务，不改历史和已完成任务',t=>{
  const dir=setup(t),store=new Store(path.join(dir,'tasks.json'),path.join(dir,'records')),now=new Date(2026,9,17,10).getTime(),old=new Date(2026,9,16,10).getTime();
  const past=store.create('昨天',old),first=store.create('今天完成',now),second=store.create('今天继续',now);store.complete(first.id,{},now+10);store.setSelectedCompanion('chick',now);
  assert.equal(store.task(past.id).skin,'capsule');assert.equal(store.task(first.id).skin,'capsule');assert.equal(store.task(second.id).skin,'chick');assert.equal(store.create('新的伙伴',now).skin,'chick');assert.equal(new Store(store.file,store.recordsDir).data.selectedSkin,'chick');
});

test('小鸡没有环带，胶囊和自定义主题色不会随事情序号改变',()=>{
  const vm=require('node:vm'),context={};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../art.js'),'utf8'),context);
  const render=(skin,slot,companions=[example])=>{
    const fills=[],ctx={fillStyle:'#000000',clearRect(){},save(){},restore(){},translate(){},fillRect(x,y,w,h){fills.push([x,y,w,h,this.fillStyle]);}};
    context.drawCompanion({getContext:()=>ctx},{skin,slot},companions);return fills;
  };
  assert.ok(!example.frames.idle.some(row=>/[RT]/.test(row)));
  for(const skin of ['chick','capsule'])for(const slot of [1,2])assert.deepEqual(render(skin,slot),render(skin,0));
  const themed={...example,palette:{...example.palette,B:'$primary'}};
  for(const slot of [0,1,2]){
    const pixels=render('chick',slot,[themed]);assert.equal(pixels.find(p=>p[0]===48&&p[1]===56)[4],'#eec669');
  }
});
