const { app, BrowserWindow, ipcMain, dialog, fs } = require('electron');
const path = require('path');
const fsPromises = fs.promises;

const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'YiQi@MD-Editor-Trae-SeedCode',
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    titleBarStyle: 'hidden',
    backgroundColor: '#0f0f23',
    show: false
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC for file operations
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Markdown Files', extensions: ['md', 'markdown', 'mdown', 'mkd', 'mkdn', 'txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const content = await fsPromises.readFile(filePath, 'utf-8');
    return { path: filePath, content };
  }
  return null;
});

ipcMain.handle('save-file', async (event, { filePath, content }) => {
  try {
    await fsPromises.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('save-file-dialog', async (event, { content, defaultPath }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Markdown File',
    defaultPath: defaultPath || 'untitled.md',
    filters: [
      { name: 'Markdown Files', extensions: ['md'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (!result.canceled && result.filePath) {
    await fsPromises.writeFile(result.filePath, content, 'utf-8');
    return { success: true, path: result.filePath };
  }
  return null;
});

ipcMain.handle('export-html', async (event, { html, defaultPath }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export as HTML',
    defaultPath: defaultPath || 'export.html',
    filters: [
      { name: 'HTML Files', extensions: ['html'] }
    ]
  });
  if (!result.canceled && result.filePath) {
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Exported from YiQi@MD-Editor</title>
<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js/styles/github-dark.min.css">
<script src="https://cdn.jsdelivr.net/npm/highlight.js/lib/highlight.min.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
    if (window.mermaid) {
      mermaid.initialize({ startOnLoad: true });
    }
  });
</script>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 40px 20px; line-height: 1.6; }
  img { max-width: 100%; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; }
  th { background: #f5f5f5; }
  blockquote { border-left: 4px solid #ddd; margin: 0; padding: 0 16px; color: #666; }
  code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
  pre { background: #282c34; border-radius: 6px; overflow-x: auto; padding: 16px; }
  pre code { background: none; padding: 0; color: #abb2bf; }
</style>
</head>
<body>
${html}
</body>
</html>`;
    await fsPromises.writeFile(result.filePath, htmlContent, 'utf-8');
    return { success: true, path: result.filePath };
  }
  return null;
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-app-name', () => {
  return 'YiQi@MD-Editor-Trae-SeedCode';
});
