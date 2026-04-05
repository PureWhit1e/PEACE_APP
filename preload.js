const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('peace', {
  saveFile: (content, format) => ipcRenderer.invoke('save-file', content, format),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  pickImage: () => ipcRenderer.invoke('pick-image'),
  pickVideo: () => ipcRenderer.invoke('pick-video'),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  // Detect Electron environment
  isElectron: true,
});
