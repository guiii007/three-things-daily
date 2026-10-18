const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('companion', {
  call: (method, value) => ipcRenderer.invoke('companion:call', method, value),
  onState: fn => { ipcRenderer.on('companion:state', (_event, state) => fn(state)); },
  onExit: fn => { ipcRenderer.on('companion:exit', fn); },
  onCloseRequest: fn => { ipcRenderer.on('companion:close-request', fn); },
  onSelectTask: fn => { ipcRenderer.on('companion:select-task', (_event, id) => fn(id)); },
  onGesture: fn => { ipcRenderer.on('companion:gesture', (_event, state) => fn(state)); }
});
