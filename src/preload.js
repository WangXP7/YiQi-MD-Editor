// ============================================================
//  YiQi@MD-Editor-千问-GLM5.2  —  Preload (安全桥接)
// ============================================================
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('yiQi', {
  onFileLoaded: (cb) => ipcRenderer.on('file-loaded', (_, d) => cb(d)),
  onFileSaved: (cb) => ipcRenderer.on('file-saved', (_, d) => cb(d)),
  onEditorCmd: (cb) => ipcRenderer.on('editor-cmd', (_, d) => cb(d)),
  onEditorWrap: (cb) => ipcRenderer.on('editor-wrap', (_, d) => cb(d)),
  onInsertTable: (cb) => ipcRenderer.on('editor-insert-table', () => cb()),
  onInsertTask: (cb) => ipcRenderer.on('editor-insert-task', () => cb()),
  onSetView: (cb) => ipcRenderer.on('set-view', (_, d) => cb(d)),
  onExportHtml: (cb) => ipcRenderer.on('export-html', () => cb()),
  onExportPdf: (cb) => ipcRenderer.on('export-pdf', () => cb()),
  exportPdfReq: () => ipcRenderer.send('export-pdf-req'),
  onShowCheatsheet: (cb) => ipcRenderer.on('show-cheatsheet', () => cb()),
  notifyChanged: () => ipcRenderer.send('content-changed'),
  requestSave: () => ipcRenderer.send('save-request'),
  dropFile: (p) => ipcRenderer.send('open-file-drop', { path: p }),
  getAppInfo: () => new Promise(r => {
    ipcRenderer.on('app-info', (_, d) => r(d));
    ipcRenderer.send('get-app-info');
  }),
  onDragOver: (cb) => ipcRenderer.on('drag-over', () => cb()),
  // 导出 HTML 文件
  saveHtmlFile: (content) => new Promise((resolve) => {
    const { ipcRenderer } = require('electron');
    ipcRenderer.send('save-html', { content });
    ipcRenderer.once('html-saved', (_, p) => resolve(p));
  }),
  // 通过主进程显示保存对话框返回路径
  pickSavePath: (defaultName) => {
    const { ipcRenderer } = require('electron');
    return new Promise((resolve) => {
      ipcRenderer.send('pick-save-path', { defaultName });
      ipcRenderer.once('save-path', (_, p) => resolve(p));
    });
  }
});
