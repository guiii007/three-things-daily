const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function dayKey(time = Date.now()) {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function timestamp(time) {
  const d = new Date(time);
  return `${dayKey(time)} ${[d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':')}`;
}
function record(task) {
  const title = Array.from(task.text.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim()).slice(0, 35).join('').replace(/[. ]+$/g, '') || '任务';
  const d = new Date(task.completedAt);
  const clock = [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2,'0')).join('') + String(d.getMilliseconds()).padStart(3,'0');
  const filename = `三件事_${dayKey(task.completedAt)}_${clock}_${task.id.slice(0,8)}_${title}.txt`;
  const text = ['三件事 · 单项完成记录', '========================================', `任务内容：${task.text}`, '完成状态：已完成', `创建时间：${timestamp(task.createdAt)}`, `完成时间：${timestamp(task.completedAt)}`, '', '心得 / 灵感 / 想记录的话：', task.note.trim() || '（未填写）', '', '========================================'].join('\r\n');
  return { filename, text: '\ufeff' + text };
}
class Store {
  constructor(file, recordsDir) {
    this.file = file;
    this.recordsDir = recordsDir;
    this.data = { version: 1, tasks: [], rewardCount: 0 };
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data.version !== 1 || !Array.isArray(data.tasks) || !Number.isInteger(data.rewardCount) || data.rewardCount < 0 || data.tasks.some(t => !t || !/^[0-9a-f-]{36}$/.test(t.id) || !/^\d{4}-\d{2}-\d{2}$/.test(t.day) || ![0,1,2].includes(t.slot) || typeof t.text !== 'string' || !t.text.trim() || t.text.length > 120 || typeof t.note !== 'string' || t.note.length > 20000 || typeof t.done !== 'boolean' || !Number.isFinite(t.createdAt) || (t.done && !Number.isFinite(t.completedAt)) || (t.position !== null && (!t.position || !Number.isFinite(t.position.x) || !Number.isFinite(t.position.y))))) throw new Error('数据文件格式不正确，请保留文件以便恢复。');
      // 兼容旧版附图字段，保留原数据，但不再提供图片操作。
      this.data = data;
    }
  }
  snapshot() { return structuredClone(this.data); }
  commit(next) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
    this.data = next;
  }
  task(id, data = this.data) {
    const task = data.tasks.find(t => t.id === id);
    if (!task) throw new Error('没有找到这件事。');
    return task;
  }
  create(text, now = Date.now()) {
    text = String(text).trim();
    if (!text || text.length > 120) throw new Error('请填写 1 到 120 字的任务。');
    const next = this.snapshot(), date = dayKey(now), count = next.tasks.filter(t => t.day === date).length;
    if (count >= 3) throw new Error('今天已经创建三个伙伴啦，明天再来。');
    const task = { id: randomUUID(), day: date, slot: count, skin: 'capsule', text, note: '', done: false, createdAt: now, completedAt: null, position: null, recordPath: null };
    next.tasks.push(task); this.commit(next); return task;
  }
  update(id, patch) {
    const next = this.snapshot(), task = this.task(id, next);
    if ('text' in patch) {
      if (typeof patch.text !== 'string' || !patch.text.trim() || patch.text.length > 120) throw new Error('任务内容不能为空，最多 120 字。');
      task.text = patch.text.trim();
    }
    if ('note' in patch) {
      if (typeof patch.note !== 'string' || patch.note.length > 20000) throw new Error('心得最多 20000 字。');
      task.note = patch.note;
    }
    this.commit(next); return task;
  }
  move(id, position) {
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) throw new Error('位置无效。');
    const next = this.snapshot(); this.task(id, next).position = { x: Math.round(position.x), y: Math.round(position.y) }; this.commit(next);
  }
  complete(id, patch, now = Date.now()) {
    this.update(id, patch);
    const next = this.snapshot(), task = this.task(id, next);
    if (task.done) return { task, alreadyDone: true };
    task.done = true; task.completedAt = now;
    // TXT 写入成功后才提交完成状态；失败时保留任务以便重试。
    task.recordPath = this.writeRecord(task);
    const phraseIndex = next.rewardCount++;
    this.commit(next); return { task, phraseIndex, alreadyDone: false };
  }
  writeRecord(task) {
    if (!task.done || !task.completedAt) throw new Error('任务尚未完成。');
    const { filename, text } = record(task);
    const dir = path.join(this.recordsDir, dayKey(task.completedAt));
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, filename);
    fs.writeFileSync(file + '.tmp', text, 'utf8'); fs.renameSync(file + '.tmp', file); return file;
  }
  export(id) { const next = this.snapshot(), task = this.task(id, next); task.recordPath = this.writeRecord(task); this.commit(next); return task.recordPath; }
  reopen(id) { const next = this.snapshot(), task = this.task(id, next); task.done = false; task.completedAt = null; this.commit(next); return task; }
}
module.exports = { Store, dayKey, record };
