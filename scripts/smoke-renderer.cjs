'use strict';
/**
 * YiQi@MD-Editor-wb-DSv4-Flash - 渲染层多标签冒烟测试（真实 Electron 环境）
 *
 * 用真实 src/preload.js + src/renderer/index.html + 已构建 bundle.js 加载应用，
 * 捕获渲染进程 console 错误与崩溃，并执行多标签操作场景：
 *  1. 初始 1 个未命名标签（会话恢复无文件 → 自动新建）
 *  2. 菜单 new-file ×2 → 共 3 个标签
 *  3. 点击切换到第 1 个标签
 *  4. 输入内容 → 脏标记 `*` 出现
 *  5. 关闭中间（干净）标签 → 2 个标签保留
 *  6. 关闭脏标签（对话框桩返回「不保存」）→ 1 个标签
 *  7. 关闭最后一个标签 → 自动新建空标签
 * 全程无渲染进程错误则 PASS。
 *
 * 用法（沙箱环境需禁用硬件加速与 GPU）：
 *   env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe \
 *     --no-sandbox --disable-gpu --in-process-gpu scripts/smoke-renderer.cjs
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const failures = [];

// 沙箱/无 GPU 环境下禁用硬件加速，避免 GPU 进程反复崩溃
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.whenReady().then(async () => {
  // 注册渲染进程初始化与多标签场景所需的最小 IPC 桩
  ipcMain.handle('file:get-last', () => ({ lastFilePath: null }));
  ipcMain.handle('file:recent', () => ({ recentFiles: [] }));
  ipcMain.handle('app:state-update', () => ({ ok: true }));
  ipcMain.handle('file:open-dialog', () => ({ ok: false, canceled: true }));
  ipcMain.handle('file:read', () => ({ ok: false, error: 'smoke: no read' }));
  // 关闭脏标签确认对话框：返回 1 = 「不保存」
  ipcMain.handle('dialog:message', () => ({ response: 1 }));

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
      spellcheck: false
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

  await win.loadFile(path.join(ROOT, 'src', 'renderer', 'index.html'));
  await sleep(5000);

  const getState = () =>
    win.webContents.executeJavaScript(
      `new Promise((resolve) => {
         const bar = document.getElementById('tabbar');
         const names = bar ? Array.from(bar.querySelectorAll('.tab-name')).map((n) => n.textContent) : [];
         resolve(JSON.stringify({
           tabs: bar ? bar.querySelectorAll('.tab').length : -1,
           active: bar ? bar.querySelectorAll('.tab.active').length : -1,
           activeIdx: bar ? Array.from(bar.querySelectorAll('.tab')).findIndex((t) => t.classList.contains('active')) : -1,
           names,
           title: document.title,
           logo: document.getElementById('app-logo') ? document.getElementById('app-logo').textContent : ''
         }));
       })`
    ).then(JSON.parse);

  const click = (selector, idx) =>
    win.webContents.executeJavaScript(
      `new Promise((resolve) => {
         const el = document.querySelectorAll(${JSON.stringify(selector)})[${idx}];
         if (el) { el.click(); resolve('clicked'); } else { resolve('missing'); }
       })`
    );

  const focusEditor = () =>
    win.webContents.executeJavaScript(
      `new Promise((resolve) => {
         const el = document.querySelector('.cm-content');
         if (el) { el.focus(); resolve('focused'); } else { resolve('missing'); }
       })`
    );

  const check = (name, cond, detail) => {
    console.log((cond ? '  [PASS] ' : '  [FAIL] ') + name + (detail ? ' — ' + detail : ''));
    if (!cond) failures.push(name + (detail ? ' — ' + detail : ''));
  };

  try {
    // 1. 初始状态
    let s = await getState();
    check('初始 1 个标签且为活动', s.tabs === 1 && s.active === 1, JSON.stringify(s));
    check('窗口标题含新名 + 版本号', /YiQi@MD-Editor-wb-DSv4-Flash 1\.0\.0/.test(s.title), s.title);
    check('#app-logo 为短名', s.logo === 'YiQi@MD-Editor-wb-DSv4-Flash', s.logo);

    // 2. 菜单 new-file ×2 → 3 个标签
    win.webContents.send('menu-action', { action: 'new-file' });
    await sleep(400);
    win.webContents.send('menu-action', { action: 'new-file' });
    await sleep(400);
    s = await getState();
    check('new-file ×2 后共 3 个标签', s.tabs === 3, JSON.stringify(s));

    // 3. 点击切换到第 1 个标签
    await click('.tab', 0);
    await sleep(400);
    s = await getState();
    check('点击标签[0]后活动索引为 0', s.activeIdx === 0, 'activeIdx=' + s.activeIdx);

    // 4. 输入内容 → 脏标记
    await focusEditor();
    await win.webContents.sendInputEvent({ type: 'char', keyCode: 'A' });
    await sleep(400);
    s = await getState();
    check('输入后活动标签出现脏标记 *', s.names[0] && s.names[0].startsWith('* '), s.names.join(' | '));

    // 5. 关闭中间（干净）标签 [1] → 保留 2 个
    await click('.tab-close', 1);
    await sleep(400);
    s = await getState();
    check('关闭中间标签后剩 2 个', s.tabs === 2, JSON.stringify(s));

    // 6. 关闭脏活动标签（对话框桩返回「不保存」）→ 剩 1 个
    await click('.tab-close', 0);
    await sleep(400);
    s = await getState();
    check('关闭脏标签（不保存）后剩 1 个', s.tabs === 1, JSON.stringify(s));

    // 7. 关闭最后一个标签 → 自动新建空标签
    await click('.tab-close', 0);
    await sleep(400);
    s = await getState();
    check('关闭最后一个标签后自动新建（仍 1 个）', s.tabs === 1 && s.active === 1, JSON.stringify(s));

    // 8. 全程无渲染错误
    check('全程无渲染进程错误', errors.length === 0, errors.join('; '));
  } catch (err) {
    failures.push('scenario threw: ' + err.message);
    console.log('SCENARIO_ERROR:', err.message);
  }

  console.log('ERRORS:', JSON.stringify(errors, null, 2));
  console.log('SUMMARY: ' + (failures.length === 0 ? 'ALL PASS' : failures.length + ' FAIL'));
  app.exit(failures.length === 0 && errors.length === 0 ? 0 : 1);
});

app.on('window-all-closed', () => {
  // 冒烟测试自行退出
});
