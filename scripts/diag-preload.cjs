'use strict';

/**
 * diag-preload.cjs — 验证 preload.js 是否在 sandbox:true + contextIsolation:true 下成功加载，
 * 以及 window.mdAPI 是否完整暴露。结果写入文件，规避 stdout 丢失问题。
 *
 * 用法：npx electron scripts/diag-preload.cjs
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

const outFile = path.join(os.tmpdir(), 'md-diag-preload-result.json');
const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'md-diag-'));

function writeResult(obj) {
  try {
    fs.writeFileSync(outFile, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    // ignore
  }
}

app.setPath('userData', tmpUserData);
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('in-process-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  win.webContents.on('console-message', (e, level, message, line, sourceId) => {
    console.log('[console]', message);
  });

  win.webContents.on('preload-error', (event, preloadPath, error) => {
    console.log('[preload-error]', preloadPath, '->', error && error.message);
  });

  win.webContents.on('did-finish-load', () => {
    console.log('[event] did-finish-load url=', win.webContents.getURL());
  });
  win.webContents.on('render-process-gone', (e, details) => {
    console.log('[event] render-process-gone reason=', details.reason, 'exitCode=', details.exitCode);
  });

  // 窗口默认 about:blank，preload 同样执行。
  await new Promise((resolve) => setTimeout(resolve, 2000));

  let report = { note: 'probe failed' };
  try {
    report = await win.webContents.executeJavaScript(`(function () {
      const keys = window.mdAPI ? Object.keys(window.mdAPI) : null;
      return {
        url: location.href,
        hasMdAPI: !!window.mdAPI,
        apiKeys: keys,
        openDialogType: window.mdAPI && typeof window.mdAPI.openDialog,
        onMenuActionType: window.mdAPI && typeof window.mdAPI.onMenuAction,
        confirmCloseType: window.mdAPI && typeof window.mdAPI.confirmClose,
        getPathForFileType: window.mdAPI && typeof window.mdAPI.getPathForFile
      };
    })()`);
  } catch (probeErr) {
    report = { probeError: String(probeErr && probeErr.message || probeErr) };
  }

  // 尝试触发一次 menu-action 并确认渲染进程能收到
  let delivery = { note: 'delivery probe skipped' };
  try {
    delivery = await new Promise((resolve) => {
      win.webContents.executeJavaScript(`(function () {
        return new Promise(function (res) {
          if (!window.mdAPI || !window.mdAPI.onMenuAction) { res({ received: false, reason: 'no mdAPI' }); return; }
          window.mdAPI.onMenuAction(function (payload) {
            res({ received: true, payload: payload });
          });
          setTimeout(function () { res({ received: false, reason: 'timeout' }); }, 800);
        });
      })()`).then((p) => {
        win.webContents.send('menu-action', { action: 'help-markdown' });
        return p;
      });
    });
  } catch (deliveryErr) {
    delivery = { deliveryError: String(deliveryErr && deliveryErr.message || deliveryErr) };
  }

  const result = { report, delivery };
  writeResult(result);
  console.log('RESULT', JSON.stringify(result));
  console.log('OUTFILE', outFile);
  app.exit(0);
}).catch((err) => {
  console.error('DIAG FAILED', err);
  writeResult({ fatal: String(err && err.message || err), stack: String(err && err.stack || '') });
  app.exit(1);
});
