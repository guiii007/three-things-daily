const fs = require('node:fs');
const path = require('node:path');
const source = path.dirname(require.resolve('@fontsource/fusion-pixel-12px-proportional-sc/400.css'));
const target = path.join(__dirname,'assets','font');
fs.mkdirSync(target,{recursive:true});
fs.copyFileSync(path.join(source,'400.css'),path.join(target,'400.css'));
fs.copyFileSync(path.join(source,'LICENSE'),path.join(target,'LICENSE'));
fs.cpSync(path.join(source,'files'),path.join(target,'files'),{recursive:true});
