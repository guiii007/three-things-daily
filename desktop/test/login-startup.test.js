const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { launchSettings, createLoginStartup, startupMenuItem, registeredPath } = require('../login-startup');
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
  assert.deepEqual(last, { path: 'C:\\Apps\\三件事.exe', args: ['--autostart'], name:'io.threethings.companion', openAtLogin: true, enabled: true });
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

test('升级迁移已开启的旧版启动项，第二次启动不再重复写入',()=>{
  const oldPath='C:\\旧版\\三件事.exe',newPath='D:\\新版\\三件事.exe';let current=oldPath,writes=0;
  const app={isPackaged:true,getLoginItemSettings({path}){return {openAtLogin:path===current,executableWillLaunchAtLogin:path===current,launchItems:path===current?[{name:'io.threethings.companion',scope:'user',enabled:true,path:current}]:[]};},setLoginItemSettings(value){assert.equal(value.name,'io.threethings.companion');assert.equal(value.openAtLogin,true);assert.equal(value.enabled,true);current=value.path;writes++;}};
  const startup=createLoginStartup(app,{env:{},execPath:newPath,readCommand:()=>`"${current}" --autostart`});
  assert.equal(startup.reconcile(),true);assert.equal(current,newPath);assert.equal(startup.get(),true);assert.equal(startup.reconcile(),false);assert.equal(writes,1);
});
test('从未启用、Windows 中禁用、其他程序及开发模式都不自动开启',()=>{
  for(const entry of [null,{name:'io.threethings.companion',scope:'user',enabled:false},{name:'another-app',scope:'user',enabled:true},{name:'io.threethings.companion',scope:'machine',enabled:true}]){
    let writes=0;const app={isPackaged:true,getLoginItemSettings:()=>({launchItems:entry?[entry]:[]}),setLoginItemSettings(){writes++;}};
    const startup=createLoginStartup(app,{env:{},execPath:'D:\\新版.exe',readCommand:()=>entry?'"C:\\旧版.exe" --autostart':null});assert.equal(startup.reconcile(),false);assert.equal(writes,0);
  }
  const dev=createLoginStartup({isPackaged:false,getAppPath:()=>'/test'},{readCommand(){throw Error('开发模式不能读注册表');}});assert.equal(dev.reconcile(),false);
  const isolated=createLoginStartup({isPackaged:true},{testFile:'ignored.json',readCommand(){throw Error('隔离测试不能读注册表');}});assert.equal(isolated.reconcile(),false);
});
test('便携升级迁移到原始 EXE，读取失败上报且不修改设置',()=>{
  let settings;const app={isPackaged:true,getLoginItemSettings:({path})=>({openAtLogin:path==='D:\\下载\\ThreeThings.exe',launchItems:[{name:'io.threethings.companion',scope:'user',enabled:true}]}),setLoginItemSettings(value){settings=value;}};
  const startup=createLoginStartup(app,{env:{PORTABLE_EXECUTABLE_FILE:'D:\\下载\\ThreeThings.exe'},execPath:'C:\\Temp\\解压.exe',readCommand:()=>'"C:\\旧版.exe" --autostart'});assert.equal(startup.reconcile(),true);assert.equal(settings.path,'D:\\下载\\ThreeThings.exe');
  const failed=createLoginStartup(app,{readCommand(){throw Error('读取失败');}});settings=null;assert.throws(()=>failed.reconcile(),/读取失败/);assert.equal(settings,null);
  assert.equal(registeredPath('"C:\\中文 空格\\软件.exe" --autostart'),'C:\\中文 空格\\软件.exe');assert.equal(registeredPath('"C:\\app.exe" --autostart --other'),null);assert.equal(registeredPath('relative.exe --autostart'),null);
});
