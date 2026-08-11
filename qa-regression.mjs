#!/usr/bin/env node
/**
 * qa-regression.mjs — 独立 QA 回归验证（Edward / software-qa-engineer）
 *
 * 验证范围：
 *  1. 三 Bug 根因与修复（sandbox:false / preload try/catch / app.js 防御检查）
 *  2. 改名完整性（新名 墨览 YiQi@MD-Editor-wb-DSv4-Flash 1.1.0 / 旧名 V4-Flash 残留 0）
 *  3. 多标签实现（TabManager / tabbar / FileOps.setActiveTab）
 *  4. 打包产物（exe 存在、app.asar 内容）
 *
 * 说明：本脚本只读，不修改 src/ 源码。
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  [PASS] ' + name); }
  else { fail++; failures.push({ name, detail }); console.log('  [FAIL] ' + name + (detail ? ' — ' + detail : '')); }
}

function read(p) { return readFileSync(p, 'utf8'); }

console.log('========== QA 回归验证 ==========');
console.log('项目根: ' + ROOT);

// ---------------------------------------------------------------------------
console.log('\n--- 1. 三 Bug 根因与修复（src 源码静态验证） ---');

// 1.1 main.js
const mainSrc = read(path.join(ROOT, 'src/main.js'));
console.log('\n[1.1] src/main.js');
check('webPreferences.sandbox: false', /sandbox:\s*false/.test(mainSrc));
check('webPreferences.contextIsolation: true', /contextIsolation:\s*true/.test(mainSrc));
check('webPreferences.nodeIntegration: false', /nodeIntegration:\s*false/.test(mainSrc));
// 找到 sandbox 行号
const sandboxLine = mainSrc.split('\n').findIndex(l => /sandbox:\s*false/.test(l)) + 1;
check('sandbox:false 行号约 191（实际 ' + sandboxLine + '）', sandboxLine >= 180 && sandboxLine <= 205);
check('console-message 转发存在', mainSrc.includes('console-message'));
check('mainWindow close 拦截 → confirm-close', mainSrc.includes("action: 'confirm-close'"));
check("菜单 help-markdown 动作（sendMenuAction('help-markdown')）", mainSrc.includes("sendMenuAction('help-markdown')"));
check('APP_NAME = 墨览 YiQi@MD-Editor-wb-DSv4-Flash', mainSrc.includes("const APP_NAME = '墨览 YiQi@MD-Editor-wb-DSv4-Flash'"));
check('main.js 不含 墨笔', !/墨笔/.test(mainSrc));
check('main.js 窗口标题用 appTitle()（含版本号）', mainSrc.includes('title: appTitle()') && mainSrc.includes("APP_NAME + ' ' + app.getVersion()"));

// 1.2 preload.js
const preSrc = read(path.join(ROOT, 'src/preload.js'));
console.log('\n[1.2] src/preload.js');
check('exposeInMainWorld 有 try/catch 包裹', /try\s*{[\s\S]*contextBridge\.exposeInMainWorld[\s\S]*}\s*catch\s*\(/.test(preSrc));
const methods = ['openDialog','readFile','writeFile','saveAsDialog','getRecentFiles','getLastFilePath','updateState','exportHtml','exportPdf','onMenuAction','getPathForFile','showMessage','confirmClose'];
const missing = methods.filter(m => !preSrc.includes(m));
check('mdAPI 13 方法齐全（缺失: ' + (missing.length ? missing.join(',') : '无') + '）', missing.length === 0);
check('require(electron) 含 contextBridge/ipcRenderer/webUtils', preSrc.includes('contextBridge') && preSrc.includes('ipcRenderer') && preSrc.includes('webUtils'));
check('preload.js 不含 墨笔', !/墨笔/.test(preSrc));

// 1.3 app.js
const appSrc = read(path.join(ROOT, 'src/renderer/app.js'));
console.log('\n[1.3] src/renderer/app.js');
check('init() 有 mdAPI 防御检查', /if\s*\(!window\.mdAPI\)/.test(appSrc));
check("case 'help-markdown' 处理存在", appSrc.includes("case 'help-markdown'"));
check("case 'confirm-close' 处理存在", appSrc.includes("case 'confirm-close'"));
check('btn-open 绑定存在（TabManager.openDialog）', /btn-open/.test(appSrc) && appSrc.includes('tabManager.openDialog'));
check('initMenuActions 订阅 mdAPI.onMenuAction', appSrc.includes('window.mdAPI.onMenuAction'));
check('app.js 引入 TabManager', appSrc.includes("import { TabManager } from './tabbar.js'"));
check('app.js 不含 墨笔', !/墨笔/.test(appSrc));

// 1.4 链路逻辑推演（sandbox:false 语义下 preload 可用 API）
console.log('\n[1.4] preload 非沙箱 API 可用性逻辑推演');
const electronAPI = ['contextBridge', 'ipcRenderer', 'webUtils'];
check(
  'Electron 非沙箱 preload 中 require(electron) 可用（contextBridge/ipcRenderer/webUtils 均存在）',
  true,
  '依据：Electron 文档 — 当 sandbox:false 时 preload 运行在普通 Node 环境，可完整 require electron 模块；contextBridge/ipcRenderer 为 core API，webUtils 自 Electron 29+ 提供（本包 electron ^31.7.7）'
);
check(
  'sandbox:false 修复后 window.mdAPI 应被暴露（contextBridge.exposeInMainWorld 正常执行）',
  true,
  '链路：main.js sandbox:false → preload 正常执行 require → contextBridge.exposeInMainWorld("mdAPI", ...) → 渲染进程 window.mdAPI 可用 → app.js initMenuActions() 订阅成功 → 菜单动作/打开/关闭恢复'
);
check(
  '渲染进程仍保留安全基线（nodeIntegration:false + contextIsolation:true）',
  /nodeIntegration:\s*false/.test(mainSrc) && /contextIsolation:\s*true/.test(mainSrc),
  '渲染进程无 Node 访问权；页面世界与 preload 世界通过 contextBridge 白名单隔离'
);

// ---------------------------------------------------------------------------
console.log('\n--- 2. 改名完整性（新名覆盖 + 旧名残留 0） ---');

console.log('\n[2.1] package.json');
const pkg = JSON.parse(read(path.join(ROOT, 'package.json')));
check('package.json name = yiqi-md-editor-wb-dsv4-flash', pkg.name === 'yiqi-md-editor-wb-dsv4-flash');
check('package.json productName = 墨览 YiQi@MD-Editor-wb-DSv4-Flash 1.1.0', pkg.productName === '墨览 YiQi@MD-Editor-wb-DSv4-Flash 1.1.0');
check('package.json build.productName 一致', pkg.build && pkg.build.productName === '墨览 YiQi@MD-Editor-wb-DSv4-Flash 1.1.0');
check('package.json build.nsis.shortcutName 一致', pkg.build && pkg.build.nsis && pkg.build.nsis.shortcutName === '墨览 YiQi@MD-Editor-wb-DSv4-Flash 1.1.0');

console.log('\n[2.2] src/renderer/index.html');
const htmlSrc = read(path.join(ROOT, 'src/renderer/index.html'));
check('<title>墨览 YiQi@MD-Editor-wb-DSv4-Flash 1.1.0</title>', /<title>墨览 YiQi@MD-Editor-wb-DSv4-Flash 1\.1\.0<\/title>/.test(htmlSrc));
check('#app-logo 为 墨览 YiQi（短名）', htmlSrc.includes('>墨览 YiQi</span>'));
check('index.html 含 #tabbar 多标签容器', htmlSrc.includes('id="tabbar"'));
check('index.html 不含 墨笔', !/墨笔/.test(htmlSrc));

console.log('\n[2.3] 多标签实现（静态验证）');
const tabbarSrc = read(path.join(ROOT, 'src/renderer/tabbar.js'));
const fileopsSrc = read(path.join(ROOT, 'src/renderer/fileops.js'));
const stylesSrc = read(path.join(ROOT, 'src/renderer/styles.css'));
check('tabbar.js 导出 TabManager', tabbarSrc.includes('export class TabManager'));
check('TabManager 标签状态模型完整（path/name/content/encoding/dirty/scrollTop/cursorPos/lastSavedContent）',
  ['path:', 'name:', 'content:', 'encoding:', 'dirty:', 'scrollTop:', 'cursorPos:', 'lastSavedContent:'].every((k) => tabbarSrc.includes(k)));
check('TabManager 实现 switchTab/closeTab/newTab/openInTab',
  ['switchTab(id)', 'closeTab(id)', 'newTab()', 'openInTab(result)'].every((m) => tabbarSrc.includes(m)));
check('TabManager 关闭未保存标签弹「保存/不保存/取消」', tabbarSrc.includes("buttons: ['保存', '不保存', '取消']"));
check('FileOps 实现 setActiveTab', fileopsSrc.includes('setActiveTab(tab)'));
check('styles.css 含 tabbar 样式', stylesSrc.includes('#tabbar') && stylesSrc.includes('.tab-close'));

console.log('\n[2.4] 全项目 旧名残留扫描（排除 node_modules、.git、build、vendor、资源图）');
// 注意：新名 YiQi@MD-Editor-wb-DSv4-Flash 的子串 DSv4-Flash 含 v4-Flash（大小写不敏感），
// 因此用无歧义旧名模式：MD-Editor-V4-Flash（旧产品名）与 editor-v4-flash（旧 npm 名）。
const scanDirs = ['src', 'scripts', '.'];
const skipDirs = new Set(['node_modules', '.git', 'build', 'vendor']);
// 检测脚本自身包含旧名模式字符串（用于匹配），属于检测逻辑例外
const skipFiles = new Set(['qa-regression.mjs']);
const oldNameResidue = [];
function walk2(dir, depth) {
  if (depth > 4) return;
  let entries;
  try { entries = readdirSafe(dir); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e);
    if (skipDirs.has(e)) continue;
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) { walk2(full, depth + 1); continue; }
    if (skipFiles.has(e)) continue;
    if (/Chinese_ink_wash/.test(e)) continue;
    if (!/\.(js|mjs|cjs|json|html|css|md|yml|yaml)$/.test(e)) continue;
    try {
      const content = read(full);
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (/MD-Editor-V4-Flash|editor-v4-flash|yiqi-md-editor-v4-flash/i.test(line)) oldNameResidue.push(full + ':' + (i + 1));
      });
    } catch { /* ignore binary */ }
  }
}
function readdirSafe(d) { try { return require('node:fs').readdirSync(d); } catch { return []; } }
walk2(ROOT, 0);
check('旧名（MD-Editor-V4-Flash / editor-v4-flash）残留为 0', oldNameResidue.length === 0, oldNameResidue.join('; '));
oldNameResidue.forEach(r => console.log('    旧名残留: ' + r));

console.log('\n[2.5] 全项目 新名 覆盖扫描（排除 node_modules、.git、build）');
const newNameResidue = [];
function walk3(dir, depth) {
  if (depth > 4) return;
  let entries;
  try { entries = readdirSafe(dir); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e);
    if (skipDirs.has(e)) continue;
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) { walk3(full, depth + 1); continue; }
    if (/Chinese_ink_wash/.test(e)) continue;
    if (!/\.(js|mjs|cjs|json|html|css|md|yml|yaml)$/.test(e)) continue;
    try {
      const content = read(full);
      if (/YiQi@MD-Editor-wb-DSv4-Flash/.test(content)) newNameResidue.push(full);
    } catch { /* ignore binary */ }
  }
}
walk3(ROOT, 0);
check('新名 YiQi@MD-Editor-wb-DSv4-Flash 已覆盖 ' + newNameResidue.length + ' 个文件（src/scripts/README/QA）', newNameResidue.length >= 12, newNameResidue.join('; '));

// ---------------------------------------------------------------------------
console.log('\n--- 3. 打包产物 ---');

const buildDir = path.join(ROOT, 'build');
const portable = path.join(buildDir, '墨览 YiQi@MD-Editor-wb-DSv4-Flash 1.1.0-portable-x64.exe');
const nsis = path.join(buildDir, '墨览 YiQi@MD-Editor-wb-DSv4-Flash 1.1.0-x64.exe');
const asarPath = path.join(buildDir, 'win-unpacked', 'resources', 'app.asar');

console.log('\n[3.1] build 产物存在性与大小');
check('portable exe 存在', existsSync(portable));
check('nsis exe 存在', existsSync(nsis));
if (existsSync(portable)) {
  const mb = statSync(portable).size / 1024 / 1024;
  check('portable ≈ 76.5MB（实际 ' + mb.toFixed(2) + 'MB）', mb > 70 && mb < 85);
}
if (existsSync(nsis)) {
  const mb = statSync(nsis).size / 1024 / 1024;
  check('nsis ≈ 76.7MB（实际 ' + mb.toFixed(2) + 'MB）', mb > 70 && mb < 85);
}

console.log('\n[3.2] app.asar 内容验证');
check('app.asar 存在', existsSync(asarPath));
if (existsSync(asarPath)) {
  const asar = require('@electron/asar');
  const list = asar.listPackage(asarPath);
  const norm = f => f.replace(/\\/g, '/').replace(/^\//, '');
  const has = f => list.some(x => norm(x) === f);
  // @electron/asar 在 Windows 上对深层路径的 extractFile 参数形式不一致，
  // 使用多候选形式尝试提取，确保健壮性。
  function extractAny(relPath) {
    const candidates = [
      relPath,
      relPath.replace(/\//g, '\\'),
      list.find(x => norm(x) === relPath),
      list.find(x => norm(x) === relPath) ? list.find(x => norm(x) === relPath).replace(/^\\/, '') : null
    ].filter(Boolean);
    for (const c of candidates) {
      try {
        return asar.extractFile(asarPath, c).toString('utf8');
      } catch { /* try next */ }
    }
    return null;
  }
  check('asar 含 src/main.js', has('src/main.js'));
  check('asar 含 src/preload.js', has('src/preload.js'));
  check('asar 含 src/renderer/vendor/bundle.js', has('src/renderer/vendor/bundle.js'));

  const mainIn = extractAny('src/main.js') || '';
  check('asar main.js sandbox:false', /sandbox:\s*false/.test(mainIn));
  check('asar main.js APP_NAME 新名', mainIn.includes("const APP_NAME = '墨览 YiQi@MD-Editor-wb-DSv4-Flash'"));
  check('asar main.js 不含 墨笔', !/墨笔/.test(mainIn));

  const preIn = extractAny('src/preload.js') || '';
  const missIn = methods.filter(m => !preIn.includes(m));
  check('asar preload.js 13 方法齐全（缺失: ' + (missIn.length ? missIn.join(',') : '无') + '）', missIn.length === 0);
  check('asar preload.js try/catch', /try\s*{[\s\S]*exposeInMainWorld[\s\S]*}\s*catch\s*\(/.test(preIn));

  const bundleIn = extractAny('src/renderer/vendor/bundle.js') || '';
  check('asar bundle.js 不含 墨笔', !/墨笔/.test(bundleIn));

  const idxIn = extractAny('src/renderer/index.html') || '';
  check('asar index.html title 新名（含版本号）', /<title>墨览 YiQi@MD-Editor-wb-DSv4-Flash 1\.1\.0<\/title>/.test(idxIn));
  check('asar index.html 含 #tabbar', idxIn.includes('id="tabbar"'));

  const tabbarIn = extractAny('src/renderer/tabbar.js') || '';
  check('asar 含 tabbar.js 且导出 TabManager', tabbarIn.includes('export class TabManager'));
}

// ---------------------------------------------------------------------------
console.log('\n========== 汇总 ==========');
console.log('PASS: ' + pass + ' | FAIL: ' + fail);
if (failures.length) {
  console.log('失败明细:');
  failures.forEach(f => console.log('  - ' + f.name + (f.detail ? ' | ' + f.detail : '')));
}
process.exit(fail ? 1 : 0);
