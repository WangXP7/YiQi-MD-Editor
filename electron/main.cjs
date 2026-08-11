const { app, BrowserWindow, dialog, ipcMain, shell, nativeTheme, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const isDev = !app.isPackaged;
let mainWindow = null;
let pendingFile = null;
let forceClose = false;
let appIsQuitting = false;

app.setName('YiQi@MD-Editor-GPT5.6SolxHigh-v1.1.3');
app.setAppUserModelId('com.yiqi.mdeditor.gpt56solxhigh');

function isMarkdownFile(filePath) {
  return /\.(md|markdown|mdown|mkd|txt)$/i.test(filePath || '');
}

function getFileFromArgs(argv) {
  return argv.find((arg) => path.isAbsolute(arg) && fs.existsSync(arg) && isMarkdownFile(arg)) || null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 980,
    minHeight: 640,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#080b14',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (pendingFile) {
      mainWindow.webContents.send('app:open-file', pendingFile);
      pendingFile = null;
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file:') && !url.startsWith('http://127.0.0.1:5173')) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });

  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximized', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximized', false));
  mainWindow.on('close', (event) => {
    if (forceClose || appIsQuitting) return;
    event.preventDefault();
    mainWindow.webContents.send('app:request-close');
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const file = getFileFromArgs(argv);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if (file) mainWindow.webContents.send('app:open-file', file);
    }
  });

  app.whenReady().then(() => {
    pendingFile = getFileFromArgs(process.argv.slice(1));
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => { appIsQuitting = true; });

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow) mainWindow.webContents.send('app:open-file', filePath);
  else pendingFile = filePath;
});

function safeFileResult(filePath, content) {
  return {
    canceled: false,
    filePath,
    name: path.basename(filePath),
    content: content.replace(/^\uFEFF/, '')
  };
}

ipcMain.handle('dialog:open-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开 Markdown 文档',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Markdown 文档', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
      { name: '文本文件', extensions: ['txt'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  const files = await Promise.all(result.filePaths.map(async (filePath) => {
    const content = await fs.promises.readFile(filePath, 'utf8');
    return safeFileResult(filePath, content);
  }));
  return { canceled: false, files };
});

ipcMain.handle('file:read', async (_event, filePath) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    return safeFileResult(filePath, content);
  } catch (error) {
    return { canceled: true, error: error.message };
  }
});

ipcMain.handle('file:save', async (_event, { filePath, content }) => {
  await fs.promises.writeFile(filePath, content, 'utf8');
  return { canceled: false, filePath, name: path.basename(filePath) };
});

ipcMain.handle('dialog:save-file', async (_event, { defaultName, content }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存 Markdown 文档',
    defaultPath: defaultName || '未命名.md',
    filters: [
      { name: 'Markdown 文档', extensions: ['md'] },
      { name: 'Markdown（长扩展名）', extensions: ['markdown'] },
      { name: '文本文件', extensions: ['txt'] }
    ]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  await fs.promises.writeFile(result.filePath, content, 'utf8');
  return { canceled: false, filePath: result.filePath, name: path.basename(result.filePath) };
});

ipcMain.handle('dialog:confirm-unsaved', async (_event, name) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: '尚未保存',
    message: `${name || '当前文档'}包含未保存的修改。`,
    detail: '要先保存这些修改吗？',
    buttons: ['保存', '不保存', '取消'],
    defaultId: 0,
    cancelId: 2,
    noLink: true
  });
  return result.response;
});

ipcMain.handle('export:html', async (_event, { title, html, css }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出为 HTML',
    defaultPath: `${title || 'document'}.html`,
    filters: [{ name: 'HTML 网页', extensions: ['html'] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  const page = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title || 'Markdown')}</title><style>${css}</style></head><body><article class="markdown-body">${html}</article></body></html>`;
  await fs.promises.writeFile(result.filePath, page, 'utf8');
  return { canceled: false, filePath: result.filePath };
});

ipcMain.handle('export:pdf', async (_event, { title, html, css }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出为 PDF',
    defaultPath: `${title || 'document'}.pdf`,
    filters: [{ name: 'PDF 文档', extensions: ['pdf'] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };

  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
  });
  const page = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(title || 'Markdown')}</title><style>${css} body{background:#fff!important;padding:0!important}.markdown-body{max-width:none!important;box-shadow:none!important}</style></head><body><article class="markdown-body">${html}</article></body></html>`;
  await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`);
  const buffer = await printWindow.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    margins: { marginType: 'custom', top: 0.55, bottom: 0.55, left: 0.6, right: 0.6 }
  });
  await fs.promises.writeFile(result.filePath, buffer);
  printWindow.destroy();
  return { canceled: false, filePath: result.filePath };
});

ipcMain.handle('shell:show-item', (_event, filePath) => shell.showItemInFolder(filePath));
ipcMain.handle('shell:open-external', (_event, url) => {
  if (/^https?:\/\//i.test(url)) return shell.openExternal(url);
  return false;
});

ipcMain.handle('clipboard:write-text', (_event, text) => {
  clipboard.writeText(String(text ?? ''));
  return true;
});

ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:toggle-maximize', () => {
  if (!mainWindow) return;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('window:force-close', () => {
  forceClose = true;
  mainWindow?.close();
});

ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  platform: process.platform,
  darkMode: nativeTheme.shouldUseDarkColors
}));

ipcMain.handle('path:resolve-asset', (_event, { documentPath, source }) => {
  if (!documentPath || !source || /^(https?:|data:|file:|#)/i.test(source)) return source;
  return pathToFileURL(path.resolve(path.dirname(documentPath), source)).href;
});

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
