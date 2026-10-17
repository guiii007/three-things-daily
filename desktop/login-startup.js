const fs = require('node:fs');
const path = require('node:path');

function launchSettings(app, env = process.env, execPath = process.execPath) {
  // 便携版运行于临时解压目录；启动项必须指向用户下载的原始 EXE。
  return { path: env.PORTABLE_EXECUTABLE_FILE || execPath, args: app.isPackaged ? ['--autostart'] : [`"${app.getAppPath()}"`, '--autostart'] };
}
function createLoginStartup(app, { testFile, env, execPath } = {}) {
  const launch = launchSettings(app, env, execPath);
  return {
    get() {
      if (testFile) return fs.existsSync(testFile) && JSON.parse(fs.readFileSync(testFile, 'utf8')).enabled === true;
      const settings = app.getLoginItemSettings(launch);
      return settings.openAtLogin && settings.executableWillLaunchAtLogin !== false;
    },
    set(enabled) {
      if (typeof enabled !== 'boolean') throw new Error('开机自启动设置无效。');
      if (testFile) { fs.mkdirSync(path.dirname(testFile), { recursive: true }); fs.writeFileSync(testFile, JSON.stringify({ enabled })); }
      else app.setLoginItemSettings({ ...launch, openAtLogin: enabled, enabled });
      if (this.get() !== enabled) throw new Error('开机自启动设置未能保存，请重试。');
    }
  };
}
function startupMenuItem(startup, refresh, reportError) {
  return { id: 'launch-at-login', label: '开机自启动', type: 'checkbox', checked: startup.get(), click(item) {
    try { startup.set(item.checked); } catch (error) { reportError(error); }
    refresh();
  } };
}
module.exports = { launchSettings, createLoginStartup, startupMenuItem };
