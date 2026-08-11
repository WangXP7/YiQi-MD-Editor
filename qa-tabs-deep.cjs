'use strict';
/**
 * qa-tabs-deep.cjs — 独立深度多标签验证（Edward / software-qa-engineer）
 *
 * 用真实 src/preload.js + src/renderer/index.html + 已构建 bundle.js 加载应用，
 * 覆盖 smoke-renderer.cjs 未覆盖的场景：
 *  1. 初始 1 个未命名标签 + 窗口标题格式
 *  2. 新建（new-file 菜单动作，对应 Ctrl+N accelerator 链路）→ 新标签
 *  3. 打开（open-file-result，对应 Ctrl+O accelerator 链路）→ 创建新标签
 *  4. 同路径再次打开 → 切换既有标签，不重复打开
 *  5. 点击标签切换 → CodeMirror setDoc 内容切换 + 滚动位置恢复 + 焦点恢复
 *  6. 关闭脏标签三分支：取消 / 不保存 / 保存（真实写盘）
 *  7. 关闭当前标签后激活相邻标签
 *  8. 关闭最后一个标签自动新建空标签
 *  9. 全程渲染进程 console 无错误
 *
 * 说明：Electron 中 sendInputEvent 注入的按键不经过应用菜单 accelerator，
 * 因此 Ctrl+N/O 的 accelerator→sendMenuAction 绑定在 main.js 静态校验
 * （CmdOrCtrl+N → 'new-file'、CmdOrCtrl+O → dialogOpenFile→open-file-result），
 * 运行时以主进程菜单点击后的 IPC 下发（menu-action 事件）驱动，与真实一致。
 *
 * 用法（沙箱环境）：
 *   env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe \
 *     --no-sandbox --disable-gpu --in-process-gpu qa-tabs-deep.cjs
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

// ---- 静态校验：main.js 菜单 accelerator 绑定 ----
const mainSrc = fs.readFileSync(path.join(ROOT, 'src', 'main.js'), 'utf8');

// ---- 临时文件区 ----
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-tabs-deep-'));
const fileA = path.join(tmpDir, 'alpha.md');
const fileB = path.join(tmpDir, 'beta.md');
// 超长文档（300 行）保证可滚动，验证滚动位置恢复
let alphaBody = '# Alpha Document\n\n';
for (let i = 1; i <= 300; i++) alphaBody += '第 ' + i + ' 行内容 alpha 测试滚动位置恢复\n';
fs.writeFileSync(fileA, alphaBody, 'utf8');
fs.writeFileSync(fileB, '# Beta Document\n\nbeta 内容\n', 'utf8');

// 对话框响应队列
let dialogQueue = [];
let saveAsResult = null;

app.whenReady().then(async () => {
  // ---- IPC 桩 ----
  ipcMain.handle('file:get-last', () => ({ lastFilePath: null }));
  ipcMain.handle('file:recent', () => ({ recentFiles: [] }));
  ipcMain.handle('app:state-update', () => ({ ok: true }));
  ipcMain.handle('app:get-info', () => ({ title: '墨览 YiQi@MD-Editor-wb-DSv4-Flash 1.1.0', version: '1.1.0' }));
  ipcMain.handle('clipboard:write-text', () => ({ ok: true }));
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
  ipcMain.handle('file:save-as-dialog', (e, content) => {
    const p = saveAsResult || path.join(tmpDir, 'saved.md');
    fs.writeFileSync(p, content, 'utf8');
    return { ok: true, filePath: p, encoding: 'utf8' };
  });
  ipcMain.handle('file:write', (e, p, content) => {
    fs.writeFileSync(p, content, 'utf8');
    return { ok: true, filePath: p, encoding: 'utf8' };
  });

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
      // 隐藏窗口默认节流 requestAnimationFrame，禁用以保证滚动恢复回调及时执行
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

  await win.loadFile(path.join(ROOT, 'src', 'renderer', 'index.html'));
  await sleep(5000);

  const js = (code) => win.webContents.executeJavaScript(code);
  const sendMenu = (action, payload) =>
    win.webContents.send('menu-action', payload ? { action, payload } : { action });
  const sendOpen = (filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    sendMenu('open-file-result', { ok: true, canceled: false, filePath, content, encoding: 'utf8' });
  };

  const getState = () =>
    js(`new Promise((resolve) => {
         const bar = document.getElementById('tabbar');
         const names = bar ? Array.from(bar.querySelectorAll('.tab-name')).map((n) => n.textContent) : [];
         const contentEl = document.querySelector('.cm-content');
         const scroller = document.querySelector('.cm-scroller');
         resolve(JSON.stringify({
           tabs: bar ? bar.querySelectorAll('.tab').length : -1,
           active: bar ? bar.querySelectorAll('.tab.active').length : -1,
           activeIdx: bar ? Array.from(bar.querySelectorAll('.tab')).findIndex((t) => t.classList.contains('active')) : -1,
           names,
           title: document.title,
           editorText: contentEl ? contentEl.innerText.slice(0, 200) : '',
           scrollTop: scroller ? scroller.scrollTop : -1,
           focused: document.activeElement ? (document.activeElement.className || document.activeElement.tagName) : ''
         }));
       })`).then(JSON.parse);

  const clickTab = (idx) =>
    js(`new Promise((resolve) => {
         const el = document.querySelectorAll('.tab')[${idx}];
         if (el) { el.click(); resolve('clicked'); } else { resolve('missing'); }
       })`);

  const clickClose = (idx) =>
    js(`new Promise((resolve) => {
         const el = document.querySelectorAll('.tab-close')[${idx}];
         if (el) { el.click(); resolve('clicked'); } else { resolve('missing'); }
       })`);

  const focusEditor = () =>
    js(`new Promise((resolve) => {
         const el = document.querySelector('.cm-content');
         if (el) { el.focus(); resolve('focused'); } else { resolve('missing'); }
       })`);

  const typeChar = (c) => win.webContents.sendInputEvent({ type: 'char', keyCode: c });

  const check = (name, cond, detail) => {
    console.log((cond ? '  [PASS] ' : '  [FAIL] ') + name + (detail ? ' — ' + detail : ''));
    if (cond) passList.push(name);
    else failures.push(name + (detail ? ' — ' + detail : ''));
  };

  try {
    // 0. 静态：main.js accelerator 绑定（Ctrl+N / Ctrl+O）
    check('main.js CmdOrCtrl+N → new-file accelerator 绑定',
      /accelerator: 'CmdOrCtrl\+N'[\s\S]*?sendMenuAction\('new-file'\)/.test(mainSrc));
    check('main.js CmdOrCtrl+O → 打开对话框 accelerator 绑定',
      /accelerator: 'CmdOrCtrl\+O'[\s\S]*?dialogOpenFile\(\)/.test(mainSrc));

    // 1. 初始状态
    let s = await getState();
    check('初始 1 个未命名标签且为活动', s.tabs === 1 && s.active === 1, JSON.stringify(s));
    check('窗口标题格式「文件名 - 产品名 版本」', /^未命名\.md - 墨览 YiQi@MD-Editor-wb-DSv4-Flash 1\.1\.0$/.test(s.title), s.title);
    const winTitle = win.getTitle();
    check('BrowserWindow 实际标题含新名 + 版本', /墨览 YiQi@MD-Editor-wb-DSv4-Flash 1\.1\.0/.test(winTitle), winTitle);

    // 2. 新建（new-file，即 Ctrl+N 链路）→ 2 个标签
    sendMenu('new-file');
    await sleep(500);
    s = await getState();
    check('新建后共 2 个标签且新标签活动', s.tabs === 2 && s.activeIdx === 1, JSON.stringify(s));

    // 3. 打开 fileA（即 Ctrl+O 链路）→ 新标签（3 个）
    sendOpen(fileA);
    await sleep(500);
    s = await getState();
    check('打开 fileA 创建新标签（共 3）且活动', s.tabs === 3 && s.activeIdx === 2 && /alpha\.md/.test(s.names[2]), JSON.stringify(s));

    // 4. 同路径再次打开 → 不重复，切换既有标签
    sendOpen(fileA);
    await sleep(500);
    s = await getState();
    check('同路径再次打开不重复（仍 3 个）且活动为既有 fileA', s.tabs === 3 && /alpha\.md/.test(s.names[s.activeIdx]), JSON.stringify(s));

    // 5. 打开 fileB → 新标签（4 个）
    sendOpen(fileB);
    await sleep(500);
    s = await getState();
    check('打开 fileB 创建新标签（共 4）', s.tabs === 4 && /beta\.md/.test(s.names[3]), JSON.stringify(s));

    // 6. 点击标签切换 → CodeMirror setDoc 内容切换
    await clickTab(2);
    await sleep(500);
    s = await getState();
    check('点击 alpha 标签后编辑器内容为 Alpha 文档', s.editorText.includes('Alpha Document') && !s.editorText.includes('Beta Document'), JSON.stringify({ text: s.editorText.slice(0, 60) }));
    await clickTab(3);
    await sleep(500);
    s = await getState();
    check('点击 beta 标签后编辑器内容为 Beta 文档', s.editorText.includes('Beta Document') && !s.editorText.includes('Alpha Document'), JSON.stringify({ text: s.editorText.slice(0, 60) }));

    // 7. 滚动位置恢复：alpha 长文档滚到中部 → 切走 → 切回
    await clickTab(2);
    await sleep(500);
    await js(`new Promise((resolve) => {
         const sc = document.querySelector('.cm-scroller');
         sc.scrollTop = 300;
         sc.dispatchEvent(new Event('scroll'));
         resolve(sc.scrollTop);
       })`);
    await sleep(200);
    await clickTab(3);
    await sleep(500);
    await clickTab(2);
    // 轮询等待 rAF 恢复回调执行（隐藏窗口下 rAF 可能延迟，功能上应最终恢复 ≈300）
    let scrollOk = false;
    for (let i = 0; i < 20; i++) {
      await sleep(250);
      s = await getState();
      if (s.scrollTop >= 250 && s.scrollTop <= 350) { scrollOk = true; break; }
    }
    check('切回 alpha 后滚动位置恢复（≈300）', scrollOk, 'scrollTop=' + s.scrollTop);
    check('切换后编辑器焦点恢复', /cm-/.test(s.focused), 'focused=' + s.focused);

    // 8. 关闭 beta（干净）→ 3 个
    await clickClose(3);
    await sleep(500);
    s = await getState();
    check('关闭干净 beta 后剩 3 个', s.tabs === 3, JSON.stringify(s));

    // 9. 在 alpha 输入 → 脏；关闭它（取消=2）→ 不关闭
    await focusEditor();
    await typeChar('Z');
    await sleep(400);
    s = await getState();
    check('alpha 输入后出现脏标记', /^\* alpha\.md$/.test(s.names[2]), s.names.join(' | '));
    dialogQueue.push(2); // 取消
    await clickClose(2);
    await sleep(500);
    s = await getState();
    check('脏标签关闭选择「取消」→ 标签保留', s.tabs === 3 && /alpha\.md/.test(s.names[2]), JSON.stringify(s));

    // 10. 关闭 alpha（不保存=1）→ 2 个
    dialogQueue.push(1); // 不保存
    await clickClose(2);
    await sleep(500);
    s = await getState();
    check('脏标签关闭选择「不保存」→ 标签关闭（剩 2）', s.tabs === 2 && !s.names.some((n) => /alpha/.test(n)), JSON.stringify(s));

    // 11. 新建 tabD，输入 → 脏；关闭它（保存=0）→ 真实写盘后关闭
    sendMenu('new-file');
    await sleep(400);
    await focusEditor();
    await typeChar('S');
    await sleep(400);
    const savePath = path.join(tmpDir, 'tabD-saved.md');
    saveAsResult = savePath;
    dialogQueue.push(0); // 保存
    await clickClose(2); // 当前活动 tabD（第 3 个）
    await sleep(600);
    s = await getState();
    const savedOnDisk = fs.existsSync(savePath) && fs.readFileSync(savePath, 'utf8').includes('S');
    check('脏标签关闭选择「保存」→ 另存为真实写盘且标签关闭', savedOnDisk && s.tabs === 2, 'savedOnDisk=' + savedOnDisk + ' tabs=' + s.tabs);

    // 12. 关闭当前活动标签后激活相邻标签
    s = await getState();
    const activeBefore = s.activeIdx;
    await clickClose(activeBefore);
    await sleep(500);
    s = await getState();
    check('关闭当前标签后激活相邻标签（仍 ≥1 个活动）', s.active === 1, JSON.stringify(s));

    // 13. 关闭最后一个标签 → 自动新建空标签
    while ((await getState()).tabs > 1) {
      await clickClose(0);
      await sleep(400);
    }
    await clickClose(0);
    await sleep(500);
    s = await getState();
    check('关闭最后一个标签自动新建空标签', s.tabs === 1 && s.active === 1 && /未命名\.md/.test(s.names[0]), JSON.stringify(s));

    // 14. 全程无渲染错误
    check('全程无渲染进程错误', errors.length === 0, errors.join('; '));
  } catch (err) {
    failures.push('scenario threw: ' + err.message);
    console.log('SCENARIO_ERROR:', err && err.stack || err);
  }

  console.log('ERRORS:', JSON.stringify(errors, null, 2));
  console.log('SUMMARY: ' + (failures.length === 0 ? 'ALL PASS (' + passList.length + ')' : failures.length + ' FAIL'));
  app.exit(failures.length === 0 && errors.length === 0 ? 0 : 1);
});

app.on('window-all-closed', () => {});
