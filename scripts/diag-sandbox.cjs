'use strict';

/**
 * 验证 iframe sandbox 对 Mermaid 渲染的影响：
 * A) 保持 sandbox="allow-same-origin"（当前）
 * B) 改为 sandbox="allow-same-origin allow-scripts"
 * 对比 help-markdown 中 mermaid 块是否成功渲染为 <svg>。
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

// 防止窗口销毁时默认退出（顺序执行多个用例需要）
app.on('window-all-closed', () => {});

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

const testCases = [
  { name: 'A: allow-same-origin (current)', sandbox: 'allow-same-origin' },
  { name: 'B: allow-same-origin allow-scripts', sandbox: 'allow-same-origin allow-scripts' }
];

let caseIndex = 0;

function runCase() {
  if (caseIndex >= testCases.length) {
    console.log('[sandbox-test] DONE');
    app.exit(0);
    return;
  }
  const tc = testCases[caseIndex];
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  win.webContents.on('console-message', (e, level, message, line) => {
    console.log('[' + tc.name + '] console:', message);
  });

  win.webContents.on('did-finish-load', async () => {
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
      // 切换 iframe sandbox
      await win.webContents.executeJavaScript(
        `document.querySelector('#preview-frame').setAttribute('sandbox', ${JSON.stringify(tc.sandbox)}); true;`
      );
      await new Promise((r) => setTimeout(r, 800));
      win.webContents.send('menu-action', { action: 'help-markdown' });
      await new Promise((r) => setTimeout(r, 3500));
      const report = await win.webContents.executeJavaScript(
        `(function(){
          var f = document.querySelector('#preview-frame');
          var d = f && f.contentDocument;
          var b = d && d.querySelector('article.markdown-body');
          if (!b) return {error: 'no body'};
          var svgs = b.querySelectorAll('div.mermaid svg');
          var errs = b.querySelectorAll('.mermaid-error');
          var preBlocks = b.querySelectorAll('pre.mermaid-block');
          return {
            svgCount: svgs.length,
            errCount: errs.length,
            preCount: preBlocks.length,
            bodySnippet: b.innerHTML.slice(0, 200)
          };
        })()`
      );
      console.log('[' + tc.name + '] REPORT:', JSON.stringify(report));
    } catch (err) {
      console.log('[' + tc.name + '] error:', err.message);
    }
    win.destroy();
    caseIndex += 1;
    setTimeout(runCase, 500);
  });

  win.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html'));
}

app.whenReady().then(runCase);
