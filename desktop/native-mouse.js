const koffi = require('koffi');
const user32 = koffi.load('user32.dll');
const keyState = user32.func('short __stdcall GetAsyncKeyState(int key)');
const metric = user32.func('int __stdcall GetSystemMetrics(int index)');
// 只在角色被按住期间读取当前按键状态；不安装全局钩子、不记录输入。
function leftDown() { return (keyState(metric(23) ? 2 : 1) & 0x8000) !== 0; }
module.exports = { leftDown };
