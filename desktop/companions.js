const fs = require('node:fs');
const path = require('node:path');
const { parsePack } = require('./companion-kit/format');
const capsule = { id: 'capsule', name: '像素胶囊', description: '暖黄色胶囊伙伴，举着小手，陪你做好每天三件事。', builtin: true };
class CompanionLibrary {
  constructor(dir) { this.dir = dir; this.reload(); }
  reload() {
    this.packs = [capsule, { id:'chick', name:'原画小鸡', description:'与桌面图标相同的高清透明小鸡，保留青绿色圆肚子、棕色发梢和自然的表情。', width:128, height:128, renderStyle:'original', builtin:true }];
    this.warnings = [];
    if (!fs.existsSync(this.dir)) return;
    for (const file of fs.readdirSync(this.dir).filter(name => name.endsWith('.json')).sort()) {
      try { const pack = this.read(path.join(this.dir,file)); if (this.packs.some(p => p.id === pack.id)) throw new Error('伙伴 id 重复。'); this.packs.push({ ...pack, builtin: false }); }
      catch (error) { this.warnings.push(file + '：' + error.message); }
    }
  }
  read(file) { if (fs.statSync(file).size > 65536) throw new Error('伙伴文件最多 64 KB。'); return parsePack(fs.readFileSync(file,'utf8')); }
  get(id) { return this.packs.find(pack => pack.id === id); }
  import(file) {
    const pack = this.read(file);
    if (this.get(pack.id)) throw new Error('已有相同 id 的伙伴。请让 AI 使用新的 id，原伙伴不会被覆盖。');
    if (this.packs.length >= 102) throw new Error('最多导入 100 个自定义伙伴。');
    fs.mkdirSync(this.dir,{recursive:true});
    fs.writeFileSync(path.join(this.dir,pack.id+'.json'),JSON.stringify(pack,null,2)+'\n',{encoding:'utf8',flag:'wx'});
    this.reload(); return pack;
  }
}
module.exports = { CompanionLibrary };
