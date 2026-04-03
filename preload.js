const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('peace', {
  saveFile: (content) => ipcRenderer.invoke('save-file', content),
  quitApp: () => ipcRenderer.invoke('quit-app'),
});
