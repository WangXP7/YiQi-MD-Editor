const e = require('electron');
console.log('electron keys:', Object.keys(e).join(','));
console.log('typeof app:', typeof e.app, 'typeof ipcMain:', typeof e.ipcMain, 'typeof BrowserWindow:', typeof e.BrowserWindow);
