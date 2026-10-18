#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { parsePack, validatePack } = require('./format');
function preview(pack) {
  const escape = text => text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const themes = [{primary:'#eec669',shade:'#cca249',shine:'#ffe7ae'}];
  const cards = themes.map(theme => {
    let rects = '';
    pack.frames.idle.forEach((row,y)=>[...row].forEach((key,x)=>{if(key==='.')return;const color=pack.palette[key],fill=color.startsWith('$')?theme[color.slice(1)]:color;rects+=`<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`;}));
    return `<div><svg viewBox="0 0 ${pack.width} ${pack.height}" shape-rendering="crispEdges">${rects}</svg></div>`;
  }).join('');
  return `<!doctype html><meta charset="utf-8"><title>${escape(pack.name)} — 伙伴预览</title><style>body{margin:40px;background:#fffaf0;color:#604555;font-family:system-ui}section{display:flex;flex-wrap:wrap;gap:20px}section div{border:2px solid #c9b8aa;background:repeating-conic-gradient(#eee 0% 25%,#fff 0% 50%) 0/16px 16px;width:240px}svg{display:block;width:100%}p{max-width:760px;line-height:1.7}</style><h1>${escape(pack.name)}</h1><p>${escape(pack.description)}</p><section>${cards}</section><p>透明区域为棋盘格。同一个伙伴陪伴当天的全部事情，配色不随事情序号变化。软件会提供捏起、拖动、消失动画。</p>`;
}
function run(args) {
  const [command,file,...rest] = args;
  if (!file || !['init','validate','preview'].includes(command)) throw new Error('用法：node cli.js init|validate|preview <伙伴文件路径> [--id my-pet --name 名称]');
  if (command === 'init') {
    const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'example.companion.json'),'utf8'));
    pack.id=rest.includes('--id')?rest[rest.indexOf('--id')+1]:'my-chick';
    pack.name=rest.includes('--name')?rest[rest.indexOf('--name')+1]:'我的小鸡';
    const normalized=validatePack(pack);fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true});fs.writeFileSync(file,JSON.stringify(normalized,null,2)+'\n',{encoding:'utf8',flag:'wx'});
    return '已创建模板：'+path.resolve(file);
  }
  const pack=parsePack(fs.readFileSync(file,'utf8'));
  if (command === 'validate') return `校验通过：${pack.name} (${pack.id})，${pack.width}×${pack.height} 像素。`;
  const target=path.resolve(file).replace(/\.json$/i,'')+'.preview.html';fs.writeFileSync(target,preview(pack));return '预览文件：'+target;
}
if (require.main===module) { try { console.log(run(process.argv.slice(2))); } catch(error) { console.error(error.message);process.exitCode=1; } }
module.exports = { run, preview };
