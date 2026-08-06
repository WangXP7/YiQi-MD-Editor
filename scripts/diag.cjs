'use strict';

/**
 * 诊断脚本：以与主进程完全相同的 webPreferences 创建窗口，
 * 检查 preload 是否挂载 mdAPI、编辑器/预览是否初始化、菜单动作是否可达。
 *
 * 用法：npx electron scripts/diag.cjs
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// 沙箱/无头环境禁用 GPU
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-compositing');

// 注册与主进程一致的 IPC 通道，避免 invoke 被拒
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
ipcMain.on('window:allow-close', () => console.log('[diag] window:allow-close received'));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, '..', 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  win.webContents.on('console-message', (e, level, message, line, sourceId) => {
    console.log('[renderer-console]', message, '(line', line + ')');
  });

  win.webContents.on('preload-error', (event, preloadPath, error) => {
    console.log('[preload-error]', preloadPath, error.message);
  });

  win.webContents.on('did-finish-load', async () => {
    // 先打补丁：把 console.error 中的 Error 对象序列化为可读文本
    try {
      await win.webContents.executeJavaScript(
        `(function(){
          var orig = console.error;
          console.error = function(){
            var args = Array.from(arguments).map(function(a){
              if (a instanceof Error) return 'ERR:' + a.name + ':' + a.message;
              if (a && a.message) return String(a.message);
              try { return JSON.stringify(a); } catch(e) { return String(a); }
            });
            orig.apply(console, ['[PATCHED]'].concat(args));
          };
        })();`
      );
    } catch (err) {
      console.log('[diag] patch console.error failed:', err.message);
    }

    try {
      const apiType = await win.webContents.executeJavaScript('typeof window.mdAPI');
      console.log('[diag] typeof window.mdAPI =', apiType);
      if (apiType === 'object') {
        const keys = await win.webContents.executeJavaScript('Object.keys(window.mdAPI).join(",")');
        console.log('[diag] mdAPI keys =', keys);
        const editorExists = await win.webContents.executeJavaScript('!!document.querySelector(".cm-content")');
        console.log('[diag] editor exists =', editorExists);
        const previewText = await win.webContents.executeJavaScript(
          '(function(){ var f=document.querySelector("#preview-frame"); if(!f) return "no frame"; var d=f.contentDocument; if(!d) return "no contentDocument"; var b=d.querySelector("article.markdown-body"); return b ? (b.innerHTML.length>0 ? "preview has content (" + b.innerHTML.length + ")" : "preview empty") : "no body"; })()'
        );
        console.log('[diag]', previewText);
      } else {
        console.log('[diag] SKIP: window.mdAPI not available -> init() will crash, editor/preview will be blank');
      }
    } catch (err) {
      console.log('[diag] executeJavaScript error:', err.message);
    }

    // 模拟菜单动作：help-markdown（Bug 1）
    console.log('[diag] sending menu-action: help-markdown');
    win.webContents.send('menu-action', { action: 'help-markdown' });

    // 模拟菜单动作：view-split（对照组，若监听器工作，应能切回分屏）
    setTimeout(() => {
      console.log('[diag] sending menu-action: view-split');
      win.webContents.send('menu-action', { action: 'view-split' });
    }, 1200);

    setTimeout(async () => {
      try {
        const bodyText = await win.webContents.executeJavaScript(
          '(function(){ var f=document.querySelector("#preview-frame"); if(!f) return "no frame"; var d=f.contentDocument; if(!d) return "no contentDocument"; var b=d.querySelector("article.markdown-body"); return b ? (b.innerHTML.indexOf("Markdown 语法速查") >= 0 ? "HELP RENDERED OK" : "help NOT rendered: " + b.innerHTML.slice(0, 80)) : "no body"; })()'
        );
        console.log('[diag] after help-markdown:', bodyText);
        const viewClass = await win.webContents.executeJavaScript('document.body.className');
        console.log('[diag] body class =', viewClass);
      } catch (err) {
        console.log('[diag] check preview error:', err.message);
      }
      app.exit(0);
    }, 3000);
  });

  win.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html'));
});
