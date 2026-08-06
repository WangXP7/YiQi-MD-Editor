'use strict';

/**
 * Mermaid 渲染诊断：区分 iframe sandbox 问题与无头环境问题。
 * 对比两种 iframe：sandbox="allow-same-origin" 与 sandbox="allow-same-origin allow-scripts"
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

ipcMain.handle('file:open-dialog', () => ({ ok: false, canceled: true }));
ipcMain.handle('file:read', () => ({ ok: false, error: 'diag' }));
ipcMain.handle('file:write', () => ({ ok: false, error: 'diag' }));
ipcMain.handle('file:save-as-dialog', () => ({ ok: false, canceled: true }));
ipcMain.handle('file:recent', () => ({ recentFiles: [] }));
ipcMain.handle('file:get-last', () => ({ lastFilePath: null }));
ipcMain.handle('export:html', () => ({ ok: false, canceled: true }));
ipcMain.handle('export:pdf', () => ({ ok: false, canceled: true }));
ipcMain.handle('dialog:message', () => ({ response: -1 }));
ipcMain.handle('app:state-update', () => ({ ok: true }));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  win.webContents.on('console-message', (e, level, message, line) => {
    console.log('[renderer-console]', message, '(line', line + ')');
  });

  win.webContents.on('did-finish-load', async () => {
    // 在渲染进程直接构造 mermaid 测试（使用 bundle 中的 mermaid 不现实，改为直接 require 不行）
    // 改为：在页面里动态 import? bundle 是 IIFE，mermaid 未暴露到 window。
    // 因此这里直接调用预览模块的导出路径：通过页面内的事件? 简化：直接检测 iframe srcdoc 是否可访问 + 标题渲染
    const report = await win.webContents.executeJavaScript(
      `(function(){
        var f = document.querySelector('#preview-frame');
        if (!f) return {error: 'no frame'};
        var d = f.contentDocument;
        if (!d) return {error: 'no contentDocument'};
        var b = d.querySelector('article.markdown-body');
        var mermaidDivs = b ? b.querySelectorAll('div.mermaid, .mermaid-error, pre.mermaid-block') : [];
        var out = {iframeSandbox: f.getAttribute('sandbox'), bodyLen: b ? b.innerHTML.length : 0};
        out.mermaidNodes = [];
        mermaidDivs.forEach(function(n){ out.mermaidNodes.push(n.className + ' :: ' + String(n.textContent || '').slice(0, 60)); });
        return out;
      })()`
    );
    console.log('[diag-mermaid]', JSON.stringify(report, null, 2));
    app.exit(0);
  });

  win.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html'));
});
