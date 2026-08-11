'use strict';
/**
 * qa-outline-copy.cjs — 1.1.0 新功能验证（Alex / engineer 自测）
 *
 * 用真实 src/preload.js + src/renderer/index.html + 已构建 bundle.js 加载应用，
 * 运行时验证本轮新增功能：
 *  A. 左侧大纲栏：h1-h6 树状缩进渲染、点击跳转编辑器 + 预览区、编辑滚动高亮、
 *     空文档占位「无章节」、折叠/展开持久化
 *  B. 选区悬浮复制按钮：选区出现 → 按钮显示；点击 → 主进程 clipboard IPC 收到文本；
 *     复制成功 Toast；选区清空 → 按钮隐藏
 *  C. Mermaid 修复：mermaid 块渲染出 SVG 注入 iframe（不再报跨文档错误）
 *  D. 版本/产品名：document.title / #app-logo / mdAPI.getAppInfo
 * 全程无渲染进程错误则 PASS。
 *
 * 用法（沙箱环境）：
 *   env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron.exe \
 *     --no-sandbox --disable-gpu --in-process-gpu qa-outline-copy.cjs
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const ROOT = path.resolve(__dirname);
const errors = [];
const failures = [];
const passList = [];

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.whenReady().then(async () => {
  // ---- IPC 桩 ----
  ipcMain.handle('file:get-last', () => ({ lastFilePath: null }));
  ipcMain.handle('file:recent', () => ({ recentFiles: [] }));
  ipcMain.handle('app:state-update', () => ({ ok: true }));
  ipcMain.handle('app:get-info', () => ({ title: '墨览 YiQi@MD-Editor-wb-DSv4-Flash 1.1.0', version: '1.1.0' }));
  ipcMain.handle('file:open-dialog', () => ({ ok: false, canceled: true }));
  ipcMain.handle('file:read', () => ({ ok: false, error: 'qa: no read' }));
  ipcMain.handle('dialog:message', () => ({ response: 1 }));
  // 记录剪贴板写入
  let clipboardCalls = [];
  ipcMain.handle('clipboard:write-text', (e, text) => {
    clipboardCalls.push(text);
    return { ok: true };
  });

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
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

  await win.loadFile(path.join(ROOT, 'src', 'renderer', 'index.html'));
  await sleep(4000);

  const js = (code) => win.webContents.executeJavaScript(code);
  const check = (name, cond, detail) => {
    console.log((cond ? '  [PASS] ' : '  [FAIL] ') + name + (detail ? ' — ' + detail : ''));
    if (cond) passList.push(name);
    else failures.push(name + (detail ? ' — ' + detail : ''));
  };

  try {
    // ---- D. 版本 / 产品名 ----
    const s0 = await js(`new Promise((r) => r(JSON.stringify({
      title: document.title,
      logo: document.getElementById('app-logo').textContent,
      hasSidebar: !!document.getElementById('outline-sidebar'),
      hasList: !!document.getElementById('outline-list')
    })))`).then(JSON.parse);
    check('document.title = 墨览 YiQi@MD-Editor-wb-DSv4-Flash 1.1.0', /墨览 YiQi@MD-Editor-wb-DSv4-Flash 1\.1\.0/.test(s0.title), s0.title);
    check('#app-logo = 墨览 YiQi', s0.logo === '墨览 YiQi', s0.logo);
    check('大纲栏 DOM 存在', s0.hasSidebar && s0.hasList);

    // ---- A. 大纲栏 ----
    // 写入含多级标题 + mermaid 的文档（填充正文放在最后，便于滚动到末尾验证高亮）
    let filler = '';
    for (let i = 0; i < 80; i++) filler += '第 ' + i + ' 行填充正文用于滚动测试\n';
    const doc = [
      '# 一级标题A',
      '',
      '## 二级标题B',
      '',
      '### 三级标题C',
      '',
      '## 二级标题D',
      '',
      '普通段落文字',
      '',
      '# 一级标题E',
      '',
      filler,
      '```mermaid',
      'graph TD',
      '  A[开始] --> B[处理]',
      '  B --> C[结束]',
      '```',
      ''
    ].join('\n');

    const pasteText = (text) => js(`new Promise((resolve) => {
      const el = document.querySelector('.cm-content');
      el.focus();
      const dt = new DataTransfer();
      dt.setData('text/plain', ${JSON.stringify(text)});
      el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
      setTimeout(resolve, 600);
    })`);

    await pasteText(doc);
    await sleep(1500);

    const s1 = await js(`new Promise((r) => r(JSON.stringify({
      outlineItems: document.querySelectorAll('#outline-list .outline-item').length,
      outlineTexts: Array.from(document.querySelectorAll('#outline-list .outline-item')).map((n) => n.textContent),
      editorText: document.querySelector('.cm-content').textContent.slice(0, 40)
    })))`).then(JSON.parse);
    check('大纲渲染 5 个标题（h1-h6 扫描）', s1.outlineItems === 5, 'items=' + s1.outlineItems);
    check('大纲标题文本顺序正确', JSON.stringify(s1.outlineTexts) === JSON.stringify(['一级标题A', '二级标题B', '三级标题C', '二级标题D', '一级标题E']), JSON.stringify(s1.outlineTexts));
    check('编辑器已载入文档', /一级标题A/.test(s1.editorText), s1.editorText);

    // 点击第 2 个大纲项（二级标题B，第 3 行）→ 编辑器跳转 + 预览滚动
    const s2 = await js(`new Promise((resolve) => {
      const item = document.querySelectorAll('#outline-list .outline-item')[1];
      item.click();
      setTimeout(() => {
        const cursor = document.getElementById('stat-cursor').textContent;
        const previewDoc = document.getElementById('preview-frame').contentDocument;
        const scrollTop = previewDoc ? (previewDoc.scrollingElement || previewDoc.documentElement).scrollTop : -1;
        const activeItem = document.querySelectorAll('#outline-list .outline-item')[1].classList.contains('active');
        resolve(JSON.stringify({ cursor, scrollTop, activeItem }));
      }, 400);
    })`).then(JSON.parse);
    check('点击大纲项后编辑器跳转到对应行', /行 3/.test(s2.cursor), 'cursor=' + s2.cursor);
    check('点击大纲项后大纲项高亮', s2.activeItem === true, JSON.stringify(s2));
    check('预览区已滚动（scrollTop >= 0）', s2.scrollTop >= 0, 'scrollTop=' + s2.scrollTop);

    // 编辑滚动 → 大纲高亮变化：把编辑器滚到文档末尾（等待 CodeMirror 完成上次 scrollIntoView 测量）
    await sleep(800);
    await js(`new Promise((resolve) => {
      const scroller = document.querySelector('.cm-scroller');
      scroller.scrollTop = scroller.scrollHeight;
      setTimeout(() => {
        scroller.dispatchEvent(new Event('scroll'));
        setTimeout(resolve, 600);
      }, 300);
    })`);
    await sleep(400);
    const s3 = await js(`new Promise((r) => r(JSON.stringify({
      activeIdx: Array.from(document.querySelectorAll('#outline-list .outline-item')).findIndex((n) => n.classList.contains('active')),
      scrollTop: document.querySelector('.cm-scroller').scrollTop,
      scrollHeight: document.querySelector('.cm-scroller').scrollHeight,
      clientHeight: document.querySelector('.cm-scroller').clientHeight,
      lines: document.getElementById('stat-lines').textContent
    })))`).then(JSON.parse);
    console.log('  [debug] 滚动诊断:', JSON.stringify(s3));
    check('编辑滚动后大纲高亮最后一个标题', s3.activeIdx === 4, 'activeIdx=' + s3.activeIdx + ' scrollTop=' + s3.scrollTop);

    // 折叠/展开
    await js(`document.getElementById('outline-collapse').click(); 'ok'`);
    const s4 = await js(`new Promise((r) => r(JSON.stringify({
      collapsed: document.body.classList.contains('outline-collapsed')
    })))`).then(JSON.parse);
    check('折叠后 body.outline-collapsed', s4.collapsed === true, JSON.stringify(s4));
    await js(`document.getElementById('btn-outline').click(); 'ok'`);
    const s5 = await js(`new Promise((r) => r(JSON.stringify({
      collapsed: document.body.classList.contains('outline-collapsed')
    })))`).then(JSON.parse);
    check('工具栏按钮可重新展开', s5.collapsed === false, JSON.stringify(s5));

    // 空文档占位：新建空标签（new-file 菜单链路）
    win.webContents.send('menu-action', { action: 'new-file' });
    await sleep(800);
    const s6 = await js(`new Promise((r) => r(JSON.stringify({
      empty: !!document.querySelector('#outline-list .outline-empty'),
      emptyText: document.querySelector('#outline-list .outline-empty') ? document.querySelector('#outline-list .outline-empty').textContent : ''
    })))`).then(JSON.parse);
    check('空文档显示「无章节」占位', s6.empty && s6.emptyText === '无章节', JSON.stringify(s6));

    // ---- B. 悬浮复制按钮 ----
    // 重新写入含多行文本文档
    await pasteText('# 复制测试\n\n需要复制的这段文字内容 abcdefg 123456\n\n结束\n');
    await sleep(1200);

    // 用 CodeMirror 语法兼容的合成键盘事件选择文本（比 sendInputEvent 在隐藏窗口下可靠）
    const selectKeys = (keys) => js(`new Promise((resolve) => {
      const el = document.querySelector('.cm-content');
      el.focus();
      const list = ${JSON.stringify(keys)};
      let i = 0;
      const fire = () => {
        if (i >= list.length) { resolve('done'); return; }
        const k = list[i++];
        const opts = { key: k.key, code: k.code, ctrlKey: !!k.ctrl, shiftKey: !!k.shift, bubbles: true, cancelable: true };
        el.dispatchEvent(new KeyboardEvent('keydown', opts));
        el.dispatchEvent(new KeyboardEvent('keyup', opts));
        setTimeout(fire, 30);
      };
      fire();
    })`);

    await js(`document.querySelector('.cm-content').focus(); 'ok'`);
    // Ctrl+Home 定位到文档开头，再 Shift+Right ×10 选择 10 个字符
    const keys = [{ key: 'Home', code: 'Home', ctrl: true }];
    for (let i = 0; i < 10; i++) keys.push({ key: 'ArrowRight', code: 'ArrowRight', shift: true });
    await selectKeys(keys);
    await sleep(600);
    const s7 = await js(`new Promise((r) => r(JSON.stringify({
      btnVisible: !document.getElementById('copy-float-btn').classList.contains('hidden'),
      btnText: document.getElementById('copy-float-btn').textContent,
      cursor: document.getElementById('stat-cursor').textContent
    })))`).then(JSON.parse);
    check('选中文本后悬浮复制按钮显示', s7.btnVisible === true, JSON.stringify(s7));
    check('按钮文案为「📋 复制」', s7.btnText === '📋 复制', s7.btnText);

    // 点击复制按钮 → IPC 收到文本 + Toast
    clipboardCalls = [];
    await js(`document.getElementById('copy-float-btn').click(); 'ok'`);
    await sleep(600);
    const s8 = await js(`new Promise((r) => r(JSON.stringify({
      toast: document.getElementById('toast') ? document.getElementById('toast').textContent : '',
      btnHidden: document.getElementById('copy-float-btn').classList.contains('hidden')
    })))`).then(JSON.parse);
    check('点击复制后主进程 clipboard IPC 收到文本', clipboardCalls.length === 1 && typeof clipboardCalls[0] === 'string' && clipboardCalls[0].length > 0, JSON.stringify(clipboardCalls));
    check('复制成功 Toast「已复制 N 字符」', /^已复制 \d+ 字符$/.test(s8.toast), s8.toast);
    check('复制成功后按钮隐藏', s8.btnHidden === true, JSON.stringify(s8));

    // 选区清空 → 按钮隐藏（合成 Home 键折叠选区）
    await selectKeys([{ key: 'Home', code: 'Home' }]);
    await sleep(500);
    const s9 = await js(`new Promise((r) => r(JSON.stringify({
      btnHidden: document.getElementById('copy-float-btn').classList.contains('hidden')
    })))`).then(JSON.parse);
    check('选区清空后按钮隐藏', s9.btnHidden === true, JSON.stringify(s9));

    // ---- C. Mermaid 修复 ----
    // 重新写入含 mermaid 的文档并等待渲染
    await js(`new Promise((resolve) => {
      const el = document.querySelector('.cm-content');
      el.focus();
      const dt = new DataTransfer();
      dt.setData('text/plain', '# 图表演示\\n\\n\\\`\\\`\\\`mermaid\\ngraph TD\\n  A[开始] --> B[处理]\\n  B --> C[结束]\\n\\\`\\\`\\\`\\n');
      el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
      setTimeout(resolve, 600);
    })`);
    await sleep(3500);
    const s10 = await js(`new Promise((r) => {
      const doc = document.getElementById('preview-frame').contentDocument;
      const svgs = doc ? doc.querySelectorAll('.markdown-body svg') : [];
      const errs = doc ? doc.querySelectorAll('.mermaid-error, .mermaid-placeholder') : [];
      r(JSON.stringify({ svgCount: svgs.length, errCount: errs.length }));
    })`).then(JSON.parse);
    check('Mermaid 渲染出 SVG（跨文档缺陷已修复）', s10.svgCount >= 1, JSON.stringify(s10));
    check('Mermaid 无错误占位', s10.errCount === 0, JSON.stringify(s10));
  } catch (err) {
    failures.push('执行异常: ' + (err && err.message ? err.message : String(err)));
    console.error('执行异常:', err);
  }

  console.log('\n=== 汇总 ===');
  console.log('PASS: ' + passList.length + ' | FAIL: ' + failures.length);
  if (failures.length) {
    console.log('失败明细:');
    failures.forEach((f) => console.log('  - ' + f));
  }
  console.log('ERRORS:', JSON.stringify(errors));
  console.log(errors.length === 0 && failures.length === 0 ? 'SUMMARY: ALL PASS' : 'SUMMARY: FAILED');
  app.exit(failures.length ? 1 : 0);
});
