const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { launchSettings, createLoginStartup, startupMenuItem } = require('../login-startup');
test('自启动使用稳定程序路径，便携版不记录临时解压路径', () => {
  const app = { isPackaged: true };
  assert.deepEqual(launchSettings(app, {}, 'C:\\Apps\\三件事.exe'), { path: 'C:\\Apps\\三件事.exe', args: ['--autostart'] });
  assert.equal(launchSettings(app, { PORTABLE_EXECUTABLE_FILE: 'D:\\下载\\三件事.exe' }, 'C:\\Temp\\临时.exe').path, 'D:\\下载\\三件事.exe');
  assert.deepEqual(launchSettings({ isPackaged: false, getAppPath: () => 'C:\\my app' }, {}, 'electron.exe').args, ['"C:\\my app"', '--autostart']);
});
test('托盘复选项默认关闭，勾选及取消调用 Windows 登录设置', () => {
  let enabled = false, last, refreshed = 0;
  const app = { isPackaged: true, getLoginItemSettings: () => ({ openAtLogin: enabled }), setLoginItemSettings(value) { last = value; enabled = value.openAtLogin; } };
  const startup = createLoginStartup(app, { env: {}, execPath: 'C:\\Apps\\三件事.exe' });
  const make = () => startupMenuItem(startup, () => refreshed++, e => { throw e; });
  assert.equal(make().checked, false); make().click({ checked: true }); assert.equal(make().checked, true);
  assert.deepEqual(last, { path: 'C:\\Apps\\三件事.exe', args: ['--autostart'], openAtLogin: true, enabled: true });
  make().click({ checked: false }); assert.equal(last.openAtLogin, false); assert.equal(make().checked, false); assert.equal(refreshed, 2);
});
test('隔离测试的勾选状态重启后保留，不修改真实系统启动项', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'three-things-startup-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const options = { testFile: path.join(dir, 'login.json'), env: {}, execPath: 'test.exe' }, app = { isPackaged: true };
  const first = createLoginStartup(app, options); assert.equal(first.get(), false); first.set(true);
  const restored = createLoginStartup(app, options); assert.equal(restored.get(), true); restored.set(false); assert.equal(first.get(), false);
});
test('系统拒绝设置时显示错误并恢复菜单勾选状态', () => {
  let reported, refreshed = false;
  const startup = { get: () => false, set() { throw new Error('写入失败'); } };
  startupMenuItem(startup, () => { refreshed = true; }, e => { reported = e.message; }).click({ checked: true });
  assert.equal(reported, '写入失败'); assert.equal(refreshed, true); assert.equal(startupMenuItem(startup, () => {}, () => {}).checked, false);
});
