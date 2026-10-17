const FORMAT = 'three-things-companion';
const ID = /^[a-z0-9][a-z0-9-]{1,47}$/;
const COLORS = /^#[0-9a-f]{6}$/i;
function validatePack(value) {
  const fail = message => { throw new Error('伙伴文件：' + message); };
  if (!value || value.format !== FORMAT || value.version !== 1) fail('format 或 version 不正确。');
  if (typeof value.id !== 'string' || !ID.test(value.id)) fail('id 需为 2～48 位小写字母、数字或连字符。');
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 40) fail('请填写 1～40 字的名称。');
  if (typeof value.description !== 'string' || value.description.length > 300) fail('说明最多 300 字。');
  if (![value.width,value.height].every(n=>Number.isInteger(n)&&n>=16&&n<=128)) fail('画布宽高需为 16～128 的整数。');
  const palette = value.palette;
  if (!palette || typeof palette !== 'object' || Array.isArray(palette) || !Object.keys(palette).length || Object.keys(palette).length > 62) fail('调色板无效。');
  for (const [key, color] of Object.entries(palette)) if (!/^[a-z0-9]$/i.test(key) || typeof color !== 'string' || !(COLORS.test(color) || ['$primary','$shade','$shine'].includes(color))) fail('调色板键需为单个字母或数字，颜色需为 #RRGGBB 或主题颜色标记。');
  const rows = value.frames?.idle;
  if (!Array.isArray(rows) || rows.length !== value.height || rows.some(row => typeof row !== 'string' || row.length !== value.width || [...row].some(c => c !== '.' && !Object.hasOwn(palette, c)))) fail('idle 行数需等于 height，每行字符数等于 width；点号表示透明。');
  let runs=0;for(const row of rows){let opaque=false;for(const c of row){if(c!=='.'&&!opaque)runs++;opaque=c!=='.';}}if(runs>2048)fail('轮廓过于复杂，请减少分散的像素点。');
  if (!rows.some(row => /[^.]/.test(row))) fail('角色不能完全透明。');
  return { format: FORMAT, version: 1, id: value.id, name: value.name.trim(), description: value.description, width: value.width, height: value.height, palette: { ...palette }, frames: { idle: [...rows] } };
}
function parsePack(text) {
  if (Buffer.byteLength(text, 'utf8') > 65536) throw new Error('伙伴文件最多 64 KB。');
  let value; try { value = JSON.parse(text); } catch { throw new Error('伙伴文件不是有效 JSON，请让 AI 修正后重试。'); }
  return validatePack(value);
}
module.exports = { validatePack, parsePack };
