'use strict';
/**
 * qa-bugs-regression.cjs — 三 Bug 未回归运行时验证（Edward / software-qa-engineer）
 *
 * 用真实 src/preload.js + src/renderer/index.html + 已构建 bundle.js 加载应用，
 * 运行时验证三个此前修复的 Bug 未回归：
 *  A. 语法速查（帮助 → Markdown 语法速查）：help-markdown 菜单动作 → 预览视图 + 速查内容
 *  B. 打开按钮（工具栏 #btn-open）→ openDialog → 新标签
 *  C. 关闭窗口（标题栏 ✕ / 系统关闭）→ confirm-close 闭环：
 *     - 无脏标签：close 拦截 → confirm-close → handleConfirmClose → confirmClose → 窗口关闭
 *     - 有脏标签 + 取消：窗口保留
 *     - 有脏标签 + 不保存：窗口关闭
 * 全程无渲染进程错误。
 *
 * 用法（沙箱环境）：
 *   env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe \
 *     --no-sandbox --disable-gpu --in-process-gpu qa-bugs-regression.cjs
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = path.resolve(__dirname);
const errors = [];
const failures = [];
const passList = [];

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-bugs-reg-'));
const fileA = path.join(tmpDir, 'open-test.md');
fs.writeFileSync(fileA, '# Open Button Test\n\n内容\n', 'utf8');

// 对话框响应队列（dialog:message）
let dialogQueue = [];
let openDialogResult = null;
let allowCloseCount = 0;
let mainWindow = null;

app.whenReady().then(async () => {
  // ---- IPC 桩 ----
  ipcMain.handle('file:get-last', () => ({ lastFilePath: null }));
  ipcMain.handle('file:recent', () => ({ recentFiles: [] }));
  ipcMain.handle('app:state-update', () => ({ ok: true }));
  ipcMain.handle('app:get-info', () => ({ title: '墨览 YiQi@MD-Editor-wb-DSv4-Flash 1.1.0', version: '1.1.0' }));
  ipcMain.handle('clipboard:write-text', () => ({ ok: true }));
  ipcMain.handle('file:open-dialog', () => openDialogResult || { ok: false, canceled: true });
  ipcMain.handle('file:read', (e, p) => {
    try {
      const buf = fs.readFileSync(p);
      return { ok: true, filePath: p, content: buf.toString('utf8'), encoding: 'utf8' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
  ipcMain.handle('dialog:message', async () => {
    if (dialogQueue.length === 0) return { response: 1 };
    return { response: dialogQueue.shift() };
  });
  // 主进程 confirm-close 闭环：收到渲染进程 confirmClose 后真正关闭窗口
  ipcMain.on('window:allow-close', () => {
    allowCloseCount += 1;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.destroy();
    }
  });

  function createWin() {
    const win = new BrowserWindow({
      width: 1100,
      height: 760,
      show: false,
      backgroundColor: '#ffffff',
      webPreferences: {
        preload: path.join(ROOT, 'src', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        spellcheck: false,
        backgroundThrottling: false
      }
    });
    win.webContents.on('console-message', (event, level, message) => {
      const lvl = ['verbose', 'info', 'warning', 'error'][level] || 'log';
      console.log('[renderer:' + lvl + ']', message);
      if (level >= 3) errors.push(message);
    });
    win.webContents.on('render-process-gone', (event, details) => {
      errors.push('render-process-gone ' + JSON.stringify(details));
    });
    win.webContents.on('did-fail-load', (event, code, desc) => {
      errors.push('did-fail-load ' + code + ' ' + desc);
    });
    // 与 main.js 一致的 close 拦截
    let allowed = false;
    win.on('close', (event) => {
      if (allowed) return;
      event.preventDefault();
      win.webContents.send('menu-action', { action: 'confirm-close' });
    });
    win._allow = () => { allowed = true; };
    return win;
  }

  const check = (name, cond, detail) => {
    console.log((cond ? '  [PASS] ' : '  [FAIL] ') + name + (detail ? ' — ' + detail : ''));
    if (cond) passList.push(name);
    else failures.push(name + (detail ? ' — ' + detail : ''));
  };

  try {
    // ============ A. 语法速查 ============
    console.log('\n--- A. 语法速查（帮助 → Markdown 语法速查） ---');
    mainWindow = createWin();
    await mainWindow.loadFile(path.join(ROOT, 'src', 'renderer', 'index.html'));
    await sleep(4000);
    const js = (code) => mainWindow.webContents.executeJavaScript(code);

    mainWindow.webContents.send('menu-action', { action: 'help-markdown' });
    await sleep(1200);
    let s = await js(`new Promise((resolve) => {
         const iframe = document.getElementById('preview-frame');
         let helpText = '';
         try { helpText = iframe.contentDocument ? iframe.contentDocument.body.innerText.slice(0, 200) : ''; } catch (e) { helpText = 'ERR:' + e.message; }
         resolve(JSON.stringify({
           bodyClass: document.body.className,
           helpText,
           mdapi: typeof window.mdAPI,
           tabs: document.getElementById('tabbar') ? document.getElementById('tabbar').querySelectorAll('.tab').length : -1
         }));
       })`).then(JSON.parse);
    check('help-markdown 切到预览视图', /view-preview/.test(s.bodyClass), s.bodyClass);
    check('预览 iframe 显示「Markdown 语法速查」', s.helpText.includes('Markdown 语法速查'), s.helpText.slice(0, 80));
    check('渲染进程 window.mdAPI 已暴露', s.mdapi === 'object', 'typeof=' + s.mdapi);
    check('语法速查不改变标签数（仍 1 个）', s.tabs === 1, 'tabs=' + s.tabs);

    // ============ B. 打开按钮 ============
    console.log('\n--- B. 打开按钮（工具栏 #btn-open） ---');
    openDialogResult = { ok: true, canceled: false, filePath: fileA, content: '# Open Button Test\n\n内容\n', encoding: 'utf8' };
    await js(`document.getElementById('btn-open').click(); 'clicked'`);
    await sleep(1000);
    s = await js(`new Promise((resolve) => {
         const bar = document.getElementById('tabbar');
         const names = Array.from(bar.querySelectorAll('.tab-name')).map((n) => n.textContent);
         const activeIdx = Array.from(bar.querySelectorAll('.tab')).findIndex((t) => t.classList.contains('active'));
         resolve(JSON.stringify({ tabs: bar.querySelectorAll('.tab').length, names, activeIdx, title: document.title }));
       })`).then(JSON.parse);
    check('点击「打开」按钮创建新标签（2 个）且活动', s.tabs === 2 && s.activeIdx === 1 && /open-test\.md/.test(s.names[1]), JSON.stringify(s));
    check('打开后窗口标题为文件名 - 产品名', /^open-test\.md - 墨览 YiQi@MD-Editor-wb-DSv4-Flash 1\.1\.0$/.test(s.title), s.title);

    // ============ C. 关闭窗口 confirm-close 闭环 ============
    console.log('\n--- C. 关闭窗口（标题栏 ✕ → confirm-close 闭环） ---');
    // C1: 无脏标签 → close 拦截 → confirm-close → confirmClose → 关闭
    allowCloseCount = 0;
    mainWindow.close(); // 触发 close 事件（被拦截 → send confirm-close）
    await sleep(800);
    check('C1 无脏标签：close 被拦截后经 confirm-close 真正关闭', mainWindow.isDestroyed(), 'destroyed=' + mainWindow.isDestroyed());
    check('C1 window:allow-close 被调用', allowCloseCount === 1, 'allowCloseCount=' + allowCloseCount);

    // C2: 有脏标签 + 取消 → 窗口保留
    mainWindow = createWin();
    await mainWindow.loadFile(path.join(ROOT, 'src', 'renderer', 'index.html'));
    await sleep(4000);
    const js2 = (code) => mainWindow.webContents.executeJavaScript(code);
    // 输入内容使其变脏
    await js2(`document.querySelector('.cm-content').focus(); 'ok'`);
    await mainWindow.webContents.sendInputEvent({ type: 'char', keyCode: 'X' });
    await sleep(500);
    dialogQueue.push(2); // 取消
    mainWindow.close();
    await sleep(1000);
    check('C2 有脏标签 + 取消：窗口保留未关闭', !mainWindow.isDestroyed(), 'destroyed=' + mainWindow.isDestroyed());

    // C3: 有脏标签 + 不保存 → 窗口关闭
    allowCloseCount = 0;
    dialogQueue.push(1); // 不保存
    mainWindow.close();
    await sleep(1000);
    check('C3 有脏标签 + 不保存：窗口关闭', mainWindow.isDestroyed(), 'destroyed=' + mainWindow.isDestroyed());
    check('C3 window:allow-close 被调用', allowCloseCount === 1, 'allowCloseCount=' + allowCloseCount);

    // 全程无渲染错误
    // 已知项：预览 iframe 内 mermaid.run 渲染失败（既有架构缺陷，非本轮回归，
    // 与 GPU/无头无关 —— 主文档 mermaid 渲染成功、iframe 节点渲染失败，
    // 见 qa 报告「发现项」。应用有降级占位【Mermaid 渲染失败】，不崩溃）。
    const mermaidErrors = errors.filter((e) => /Mermaid/.test(e));
    const otherErrors = errors.filter((e) => !/Mermaid/.test(e));
    check('全程无渲染进程错误（排除已知 Mermaid 缺陷）', otherErrors.length === 0, otherErrors.join('; '));
    console.log('  已知项: Mermaid 渲染失败（既有缺陷，非本轮回归）→ ' + mermaidErrors.length + ' 次');
  } catch (err) {
    failures.push('scenario threw: ' + err.message);
    console.log('SCENARIO_ERROR:', err && err.stack || err);
  }

  console.log('ERRORS:', JSON.stringify(errors, null, 2));
  const knownMermaid = errors.filter((e) => /Mermaid/.test(e)).length;
  const unknownErrors = errors.filter((e) => !/Mermaid/.test(e));
  console.log('SUMMARY: ' + (failures.length === 0 && unknownErrors.length === 0 ? 'ALL PASS (' + passList.length + ')' : failures.length + ' FAIL') + (knownMermaid ? '（含已知 Mermaid 缺陷 ' + knownMermaid + ' 次）' : ''));
  app.exit(failures.length === 0 && unknownErrors.length === 0 ? 0 : 1);
});

app.on('window-all-closed', () => {});
