const { contextBridge, ipcRenderer, webUtils, clipboard } = require('electron');

contextBridge.exposeInMainWorld('yiqiMd', {
  openFile: () => ipcRenderer.invoke('dialog:open-file'),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  saveFile: (payload) => ipcRenderer.invoke('file:save', payload),
  saveFileAs: (payload) => ipcRenderer.invoke('dialog:save-file', payload),
  confirmUnsaved: (name) => ipcRenderer.invoke('dialog:confirm-unsaved', name),
  exportHtml: (payload) => ipcRenderer.invoke('export:html', payload),
  exportPdf: (payload) => ipcRenderer.invoke('export:pdf', payload),
  showItem: (filePath) => ipcRenderer.invoke('shell:show-item', filePath),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  resolveAsset: (payload) => ipcRenderer.invoke('path:resolve-asset', payload),
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  copyText: (text) => clipboard.writeText(String(text)),
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  close: () => ipcRenderer.send('window:force-close'),
  onOpenFile: (callback) => ipcRenderer.on('app:open-file', (_event, filePath) => callback(filePath)),
  onRequestClose: (callback) => ipcRenderer.on('app:request-close', () => callback()),
  onMaximized: (callback) => ipcRenderer.on('window:maximized', (_event, value) => callback(value))
});
