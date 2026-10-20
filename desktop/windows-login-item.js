// 只读当前用户属于本软件的唯一启动项，不枚举或修改其他程序。
function readRegisteredCommand() {
  const koffi=require('koffi');
  const read=koffi.load('advapi32.dll').func('int32 __stdcall RegGetValueW(intptr_t hkey,str16 subkey,str16 value,uint32 flags,_Out_ uint32 *type,void *data,_Inout_ uint32 *size)');
  const data=Buffer.alloc(65536),size=[data.length],type=[0];
  const status=read(-2147483647,'Software\\Microsoft\\Windows\\CurrentVersion\\Run','io.threethings.companion',2,type,data,size);
  if(status===2)return null;
  if(status!==0)throw new Error('读取开机启动项失败（'+status+'）。');
  return data.subarray(0,size[0]).toString('utf16le').replace(/\0+$/,'');
}
module.exports={readRegisteredCommand};
