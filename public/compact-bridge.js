(() => {
  if (!navigator.userAgent.includes('YiQiCompact')) return;

  const listeners = {
    openFile: [],
    requestClose: [],
    maximized: []
  };

  const ready = new Promise((resolve) => {
    const connect = () => resolve(window.pywebview.api);
    if (window.pywebview?.api) connect();
    else window.addEventListener('pywebviewready', connect, { once: true });
  });

  const invoke = (method, ...args) => ready.then((nativeApi) => nativeApi[method](...args));

  window.__yiqiCompact = {
    emitOpenFile(filePath) {
      listeners.openFile.forEach((callback) => callback(filePath));
    },
    requestClose() {
      listeners.requestClose.forEach((callback) => callback());
    },
    emitMaximized(value) {
      listeners.maximized.forEach((callback) => callback(Boolean(value)));
    }
  };

  window.yiqiMd = {
    openFile: () => invoke('open_file'),
    readFile: (filePath) => invoke('read_file', filePath),
    saveFile: (payload) => invoke('save_file', payload),
    saveFileAs: (payload) => invoke('save_file_as', payload),
    confirmUnsaved: (name) => invoke('confirm_unsaved', name),
    exportHtml: (payload) => invoke('export_html', payload),
    exportPdf: (payload) => invoke('export_pdf', payload),
    showItem: (filePath) => invoke('show_item', filePath),
    openExternal: (url) => invoke('open_external', url),
    resolveAsset: (payload) => invoke('resolve_asset', payload),
    getAppInfo: () => invoke('get_app_info'),
    getPathForFile: (file) => file?.path || null,
    copyText: (text) => invoke('copy_text', String(text)),
    minimize: () => invoke('minimize'),
    toggleMaximize: () => invoke('toggle_maximize'),
    close: () => invoke('force_close'),
    onOpenFile: (callback) => listeners.openFile.push(callback),
    onRequestClose: (callback) => listeners.requestClose.push(callback),
    onMaximized: (callback) => listeners.maximized.push(callback)
  };

  window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.no-drag, button, [role="button"]').forEach((element) => {
      element.addEventListener('mousedown', (event) => event.stopPropagation());
    });
  });
})();
