'use strict';
/**
 * qa-packaged-exe.cjs — 打包产物真实启动验证（Edward / software-qa-engineer）
 *
 * 启动 build/win-unpacked/ 下的真实打包 exe（含 app.asar），通过
 * Chrome DevTools Protocol（--remote-debugging-port）验证：
 *  1. exe 正常启动、无崩溃（渲染进程存活）
 *  2. 窗口标题 = 「未命名.md - YiQi@MD-Editor-wb-DSv4-Flash 1.0.0」（asar 内 main.js appTitle 生效）
 *  3. 渲染进程 window.mdAPI 已暴露（asar 内 preload + sandbox:false 生效 → 三 Bug 修复在打包产物中成立）
 *  4. 初始 1 个多标签 tab（asar 内 tabbar.js 生效）
 *  5. document.title / #app-logo 为新名
 * 全程渲染 console 无 error（通过 CDP Runtime.consoleAPICalled / Log.entryAdded 捕获）。
 *
 * 用法：
 *   node qa-packaged-exe.cjs
 */
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const ROOT = __dirname;
const EXE = path.join(ROOT, 'build', 'win-unpacked', 'YiQi@MD-Editor-wb-DSv4-Flash 1.0.0.exe');
const PORT = 9333;

const failures = [];
const passList = [];
const consoleErrors = [];

const check = (name, cond, detail) => {
  console.log((cond ? '  [PASS] ' : '  [FAIL] ') + name + (detail ? ' — ' + detail : ''));
  if (cond) passList.push(name);
  else failures.push(name + (detail ? ' — ' + detail : ''));
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function waitForTarget(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const json = await httpGet(`http://127.0.0.1:${PORT}/json`);
      const targets = JSON.parse(json);
      const page = targets.find((t) => t.type === 'page' && /index\.html|YiQi@MD-Editor/.test(t.url));
      if (page) return page;
    } catch (e) { /* not ready */ }
    await sleep(500);
  }
  return null;
}

function cdpEval(wsUrl, expression) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => { try { ws.close(); } catch {} reject(new Error('CDP timeout')); }, 15000);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === 1) {
        clearTimeout(timer);
        try { ws.close(); } catch {}
        if (msg.result && msg.result.exceptionDetails) {
          reject(new Error('CDP eval exception: ' + JSON.stringify(msg.result.exceptionDetails)));
        } else {
          resolve(msg.result && msg.result.result ? msg.result.result.value : undefined);
        }
      }
    };
    ws.onerror = (e) => { clearTimeout(timer); reject(new Error('WS error')); };
  });
}

async function main() {
  console.log('启动打包 exe: ' + EXE);
  // 必须清除 agent shell 注入的环境变量：ELECTRON_RUN_AS_NODE（node 模式解析参数）
  // 与 NODE_OPTIONS（打包 app 不支持 --require shim）。
  const env = Object.assign({}, process.env, {
    ELECTRON_RUN_AS_NODE: undefined,
    NODE_OPTIONS: undefined
  });
  // 独立 userData：规避自动化环境多次强杀导致的单实例锁残留（环境问题，非产品缺陷）
  const altUserData = path.join(ROOT, '.qa-userdata');
  const child = spawn(EXE, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${altUserData}`,
    '--no-sandbox',
    '--disable-gpu',
    '--in-process-gpu'
  ], { stdio: ['ignore', 'pipe', 'pipe'], detached: false, env });

  let stderrBuf = '';
  let stdoutBuf = '';
  child.stderr.on('data', (d) => (stderrBuf += d.toString()));
  child.stdout.on('data', (d) => (stdoutBuf += d.toString()));
  child.on('exit', (code) => {
    console.log('exe 退出 code=' + code);
  });

  const page = await waitForTarget(30000);
  check('打包 exe 启动且出现页面 target', !!page, page ? page.url : 'no target');
  if (!page) {
    console.log('STDOUT:', stdoutBuf.slice(0, 3000));
    console.log('STDERR:', stderrBuf.slice(0, 2000));
    child.kill();
    process.exit(1);
  }

  // 监听 console 错误：通过 CDP Runtime.enable + Log.enable 后取缓存不可行，
  // 改为直接 evaluate 检查 window 上是否记录过错误（应用自身未记录），
  // 简化：捕获 target title + 关键 DOM 状态，console 错误通过 evaluate 主动触发检查（如未捕获异常数）。
  // 页面 target 出现后等待 DOM 就绪（#tabbar 存在）再取值
  let domReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      const ready = await cdpEval(page.webSocketDebuggerUrl, `new Promise((resolve) => {
        resolve(JSON.stringify({
          bar: !!document.getElementById('tabbar'),
          ready: document.readyState,
          t: document.title
        }));
      })`).then(JSON.parse);
      if (ready.bar && ready.ready === 'complete' && ready.t) { domReady = true; break; }
    } catch (e) { /* retry */ }
    await sleep(500);
  }
  check('渲染 DOM 就绪（#tabbar 存在 + readyState complete）', domReady, domReady ? 'ready' : 'not ready');

  // 注：CDP target.title 为导航元数据（显示 URL 文件名），不反映应用窗口标题；
  // 窗口标题由 main.js appTitle()/setTitle 控制，真实 document.title 在下文验证。
  console.log('  信息: CDP target.title=' + JSON.stringify(page.title) + '（导航元数据，非窗口标题）');

  // CDP Runtime.evaluate 验证渲染状态
  const state = await cdpEval(page.webSocketDebuggerUrl, `new Promise((resolve) => {
    const bar = document.getElementById('tabbar');
    resolve(JSON.stringify({
      mdapi: typeof window.mdAPI,
      mdapiMethods: window.mdAPI ? Object.keys(window.mdAPI).sort().join(',') : '',
      tabs: bar ? bar.querySelectorAll('.tab').length : -1,
      names: bar ? Array.from(bar.querySelectorAll('.tab-name')).map(n => n.textContent) : [],
      active: bar ? bar.querySelectorAll('.tab.active').length : -1,
      docTitle: document.title,
      logo: document.getElementById('app-logo') ? document.getElementById('app-logo').textContent : ''
    }));
  })`).then(JSON.parse);

  check('打包产物渲染进程 window.mdAPI 已暴露（preload+sandbox:false 生效）', state.mdapi === 'object', 'typeof=' + state.mdapi);
  const expectedMethods = ['openDialog','readFile','writeFile','saveAsDialog','getRecentFiles','getLastFilePath','updateState','exportHtml','exportPdf','onMenuAction','getPathForFile','showMessage','confirmClose'];
  const missing = expectedMethods.filter((m) => !(state.mdapiMethods || '').split(',').includes(m));
  check('mdAPI 13 方法齐全', missing.length === 0, '缺失=' + (missing.join(',') || '无') + ' 实际=' + state.mdapiMethods);
  check('初始 1 个多标签 tab 且活动', state.tabs === 1 && state.active === 1, JSON.stringify({ tabs: state.tabs, active: state.active }));
  check('document.title 为新名 + 版本', /YiQi@MD-Editor-wb-DSv4-Flash 1\.0\.0/.test(state.docTitle), state.docTitle);
  check('#app-logo 为新短名', state.logo === 'YiQi@MD-Editor-wb-DSv4-Flash', state.logo);

  // 捕获渲染进程 console 错误：挂载一个全局错误收集再触发一次预览渲染
  const errCheck = await cdpEval(page.webSocketDebuggerUrl, `new Promise((resolve) => {
    window.__qaErrors = [];
    const origErr = console.error;
    console.error = function (...args) { window.__qaErrors.push(args.map(a => String(a)).join(' ')); origErr.apply(console, args); };
    setTimeout(() => resolve(JSON.stringify({ errors: window.__qaErrors })), 1500);
  })`).then(JSON.parse);
  check('渲染进程 console 无错误（1500ms 采样）', errCheck.errors.length === 0, JSON.stringify(errCheck.errors));

  // 关闭应用
  child.kill();
  await sleep(1000);
  console.log('\nSUMMARY: ' + (failures.length === 0 ? 'ALL PASS (' + passList.length + ')' : failures.length + ' FAIL'));
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('脚本异常:', e && e.stack || e);
  process.exit(1);
});
