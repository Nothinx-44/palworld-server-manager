const { contextBridge, ipcRenderer } = require('electron');

// Pont IPC minimal et explicite : le renderer n'a pas accès à Node, uniquement à ces fonctions.
contextBridge.exposeInMainWorld('api', {
  getStatus: () => ipcRenderer.invoke('setup:getStatus'),
  install: (body) => ipcRenderer.invoke('setup:install', body),
  installServices: () => ipcRenderer.invoke('services:install'),
  uninstallServices: () => ipcRenderer.invoke('services:uninstall'),
  startDashboard: () => ipcRenderer.invoke('dashboard:start'),
  stopDashboard: () => ipcRenderer.invoke('dashboard:stop'),
  openDashboard: () => ipcRenderer.invoke('dashboard:open'),
  createAccount: (data) => ipcRenderer.invoke('account:create', data),
  listAccounts: () => ipcRenderer.invoke('account:list'),
  onLog: (cb) => ipcRenderer.on('setup:log', (_evt, line) => cb(line)),
  fitWindow: (width, height) => ipcRenderer.send('window:fit', width, height),
  pickFolder: (defaultPath) => ipcRenderer.invoke('dialog:pickFolder', defaultPath)
});
