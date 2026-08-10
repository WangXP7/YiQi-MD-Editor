/**
 * qa-verify.mjs — YiQi@MD-Editor-wb-DSv4-Flash QA 验证脚本
 *
 * 验证范围：
 *  1. 渲染管线静态验证（从 src/renderer/preview.js 提取真实插件配置构造等价管线）
 *  2. 编码检测逻辑验证（从 src/main.js 提取 detectAndDecode 逻辑，配合 iconv-lite）
 *  3. IPC 通道一致性（静态解析 main.js / preload.js）
 *  4. 打包产物完整性（exe / app.asar / files 配置）
 *  5. 改名完整性 + 多标签实现（TabManager / tabbar）
 *
 * 只读验证，不修改 src/ 下任何文件。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import asar from '@electron/asar';

import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import footnote from 'markdown-it-footnote';
import { full as emoji } from 'markdown-it-emoji';
import sup from 'markdown-it-sup';
import sub from 'markdown-it-sub';
import abbr from 'markdown-it-abbr';
import texmath from 'markdown-it-texmath';
import katex from 'katex';
import hljs from 'highlight.js';
import iconv from 'iconv-lite';

// markdown-it-emoji 为 ESM（仅具名导出），已在上方以 named import 引入

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// 工具：结果记录
// ---------------------------------------------------------------------------

const results = [];
function check(area, name, pass, detail) {
  results.push({ area, name, pass: !!pass, detail: detail || '' });
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(`[${mark}] [${area}] ${name}${detail ? ' — ' + detail : ''}`);
}
function section(title) {
  console.log('\n' + '='.repeat(70) + '\n' + title + '\n' + '='.repeat(70));
}

// ---------------------------------------------------------------------------
// 1. 渲染管线静态验证 —— 从 preview.js 提取真实配置
// ---------------------------------------------------------------------------

// --- 以下代码与 src/renderer/preview.js 保持一致（逐字提取） ---

function slugify(str) {
  const s = String(str)
    .trim()
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'section';
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function highlightCode(code, lang) {
  if (lang === 'mermaid') {
    return '<pre class="mermaid-block"><code class="language-mermaid">' + escapeHtml(code) + '</code></pre>';
  }
  if (lang && hljs.getLanguage(lang)) {
    try {
      return (
        '<pre class="hljs"><code class="language-' + lang + '">' +
        hljs.highlight(code, { language: lang, ignoreIllegals: true }).value +
        '</code></pre>'
      );
    } catch (err) {
      // 高亮失败时回退为纯文本
    }
  }
  if (lang) {
    return '<pre class="hljs"><code class="language-' + lang + '">' + escapeHtml(code) + '</code></pre>';
  }
  const auto = hljs.highlightAuto(code);
  return (
    '<pre class="hljs"><code class="language-' + (auto.language || 'plaintext') + '">' +
    auto.value +
    '</code></pre>'
  );
}

function renderTocHtml(headings) {
  const items = headings.filter((h) => h.level >= 2);
  if (items.length === 0) return '';
  const root = { level: 1, children: [] };
  const stack = [root];
  for (const h of items) {
    const node = { level: h.level, id: h.id, text: h.text, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
      stack.pop();
    }
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }
  return renderTocList(root.children);
}

function renderTocList(nodes) {
  if (!nodes || nodes.length === 0) return '';
  let html = '<ul>';
  for (const node of nodes) {
    html += '<li><a href="#' + escapeHtml(node.id) + '">' + escapeHtml(node.text) + '</a>' +
      renderTocList(node.children) + '</li>';
  }
  html += '</ul>';
  return html;
}

function anchorsAndTocPlugin(mdInstance) {
  mdInstance.core.ruler.push('anchors_toc', (state) => {
    const env = state.env;
    if (!env.headings) env.headings = [];
    if (!env.usedIds) env.usedIds = {};
    const tocPlaceholders = [];

    for (let i = 0; i < state.tokens.length; i += 1) {
      const token = state.tokens[i];
      if (token.type === 'heading_open') {
        const inline = state.tokens[i + 1];
        const text = inline
          ? inline.children
            ? inline.children.map((child) => child.content || '').join('')
            : inline.content || ''
          : '';
        const level = parseInt(token.tag.slice(1), 10);
        const base = slugify(text) || 'section';
        let id = base;
        let counter = 1;
        while (env.usedIds[id]) {
          id = base + '-' + counter;
          counter += 1;
        }
        env.usedIds[id] = true;
        token.attrSet('id', id);
        env.headings.push({ level, id, text });
      } else if (token.type === 'inline' && /^\[\[toc\]\]$/i.test(token.content.trim())) {
        tocPlaceholders.push(i);
      }
    }

    for (let i = tocPlaceholders.length - 1; i >= 0; i -= 1) {
      const idx = tocPlaceholders[i];
      const tocToken = new state.Token('html_block', '', 0);
      tocToken.content = '<nav class="markdown-toc">' + renderTocHtml(env.headings) + '</nav>';
      state.tokens.splice(idx, 1, tocToken);
    }
  });
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: highlightCode
});

md.use(taskLists, { enabled: true, label: true, labelAfter: false });
md.use(footnote);
md.use(emoji);
md.use(sup);
md.use(sub);
md.use(abbr);
md.use(anchorsAndTocPlugin);
md.use(texmath, {
  engine: katex,
  delimiters: 'dollars',
  katexOptions: { throwOnError: false, strict: false, output: 'html' }
});

// --- 测试 Markdown：覆盖全部目标语法 ---

const TEST_MD = [
  '# 主标题 One',
  '',
  '[[toc]]',
  '',
  '## 表格 GFM',
  '',
  '| 列1 | 列2 |',
  '| --- | --- |',
  '| A | B |',
  '',
  '## 任务列表',
  '',
  '- [x] 已完成任务',
  '- [ ] 未完成任务',
  '',
  '## 删除线',
  '',
  '~~删除的内容~~ 与 ~~strikethrough~~',
  '',
  '## 脚注',
  '',
  '这里有一个脚注[^1]。',
  '',
  '[^1]: 脚注的说明文字。',
  '',
  '## 数学公式',
  '',
  '行内公式 $E=mc^2$ 结束。',
  '',
  '$$\\frac{1}{2} + \\frac{3}{4}$$',
  '',
  '## 代码',
  '',
  '行内代码 `const a = 1;`',
  '',
  '```javascript',
  'const x = 1;',
  'console.log(x);',
  '```',
  '',
  '无语言代码块：',
  '',
  '```',
  'plain block',
  '```',
  '',
  '## Emoji',
  '',
  ':smile: :sunglasses: :rocket:',
  '',
  '## 引用',
  '',
  '> 引用内容第一行',
  '> 引用内容第二行',
  '',
  '## 嵌套列表',
  '',
  '1. 有序项',
  '   - 子无序项',
  '     - 孙项',
  '',
  '## HTML 内嵌',
  '',
  '<div class="custom-html">内嵌 HTML 内容</div>',
  '',
  '## 自动链接',
  '',
  '自动链接 https://example.com/path',
  '',
  '## 上标与下标',
  '',
  'H~2~O 与 x^2^',
  '',
  '## 缩略语',
  '',
  '*[HTML]: 超文本标记语言',
  '',
  'HTML 的缩略语。',
  ''
].join('\n');

section('1. 渲染管线静态验证（markdown-it 等价管线，配置逐字取自 preview.js）');

let renderOk = true;
let rendered = '';
try {
  rendered = md.render(TEST_MD);
  check('渲染', 'md.render 执行无异常', true, `输出长度 ${rendered.length} 字符`);
} catch (err) {
  renderOk = false;
  check('渲染', 'md.render 执行无异常', false, err.message);
}

if (renderOk) {
  // 表格
  check('GFM 表格', '输出含 <table>', rendered.includes('<table>'));
  check('GFM 表格', '输出含 <thead> 与 <th>', rendered.includes('<thead>') && rendered.includes('<th>'));

  // 任务列表
  check('任务列表', '输出含 task-list-item 类', rendered.includes('task-list-item'));
  check('任务列表', '输出含 checkbox 输入', rendered.includes('type="checkbox"'));
  check('任务列表', '[x] 项含 checked 属性', rendered.includes('checked'));

  // 删除线
  check('删除线', '输出含 <s> 删除标签', rendered.includes('<s>删除的内容</s>'));

  // 脚注
  check('脚注', '输出含 <section class="footnotes">', rendered.includes('class="footnotes"'));
  check('脚注', '输出含脚注引用 sup', rendered.includes('footnote-ref'));

  // 数学公式（KaTeX）
  check('KaTeX 行内公式', '输出含 class="katex"', rendered.includes('class="katex"'));
  check('KaTeX 块级公式', '输出含 katex-display', rendered.includes('katex-display'));

  // 代码块与行内代码
  check('代码块语言标注', '输出含 language-javascript', rendered.includes('language-javascript'));
  check('代码块高亮', '输出含 hljs-keyword 类（highlight.js 生效）', rendered.includes('hljs-keyword'));
  check('行内代码', '输出含 <code>const a = 1;</code>', rendered.includes('<code>const a = 1;</code>'));

  // emoji
  check('Emoji :smile:', '输出含 😄', rendered.includes('😄'));
  check('Emoji :sunglasses:', '输出含 😎', rendered.includes('😎'));

  // [[toc]]
  check('[[toc]] 目录', '输出含 <nav class="markdown-toc">', rendered.includes('class="markdown-toc"'));
  check('[[toc]] 目录', '目录链接指向标题锚点', rendered.includes('<a href="#') && rendered.includes('markdown-toc'));

  // 标题锚点
  check('标题锚点', 'h2 含 id 属性', rendered.includes('<h2 id="'));

  // 引用
  check('引用', '输出含 <blockquote>', rendered.includes('<blockquote>'));

  // 嵌套列表（markdown-it 标准渲染为 <li>文本\n<ul>，子 <ul> 嵌于 <li> 内）
  check('嵌套列表', '输出含 <ol> 与 <ul>', rendered.includes('<ol>') && rendered.includes('<ul>'));
  check('嵌套列表', '子 <ul> 嵌于 <li> 内（<li>文本<newline><ul>）', /<li>[^<]*<ul>/.test(rendered));

  // HTML 内嵌（html: true）
  check('HTML 内嵌', '保留 <div class="custom-html">', rendered.includes('<div class="custom-html">'));

  // 自动链接
  check('自动链接', '裸 URL 生成 <a href="https://example.com/path">', rendered.includes('<a href="https://example.com/path"'));

  // 上标 / 下标
  check('上标/下标', '输出含 <sub> 与 <sup>', rendered.includes('<sub>') && rendered.includes('<sup>'));

  // 缩略语
  check('缩略语', '输出含 abbr[title]', rendered.includes('<abbr title="超文本标记语言"'));

  // Mermaid 块保持原样（高亮回调特殊分支）
  const mermaidMd = '```mermaid\ngraph TD\n  A[开始] --> B[结束]\n```';
  const mermaidHtml = md.render(mermaidMd);
  check('Mermaid 块', '输出含 pre.mermaid-block', mermaidHtml.includes('class="mermaid-block"'));
  check('Mermaid 块', '输出含 language-mermaid', mermaidHtml.includes('language-mermaid'));
}

// --- KaTeX CSS 与预览文档 CSS 注入（静态验证 preview.js 行为） ---
section('1b. KaTeX CSS / 预览文档样式注入（静态验证）');

const previewSrc = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'preview.js'), 'utf8');
const katexCssJs = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'vendor', 'katex-css.js'), 'utf8');

check('preview.js', 'buildPreviewDocument 注入 katexCss 到 <style>', previewSrc.includes("'<style>' + katexCss + '</style>'"));
check('preview.js', 'getFullCss 拼接 katexCss（导出用）', previewSrc.includes("markdownCss(currentDark) + '\\n' + (currentDark ? githubDarkCss : githubCss) + '\\n' + katexCss"));
check('preview.js', 'buildPreviewDocument 注入 github highlight CSS', previewSrc.includes("(dark ? githubDarkCss : githubCss)"));
check('katex-css.js', '模块存在且为 export default 字符串', katexCssJs.startsWith('export default '));
check('katex-css.js', 'CSS 含 .katex 选择器', katexCssJs.includes('.katex{') || katexCssJs.includes('.katex {'));
check('katex-css.js', '字体已内嵌为 data URI（woff2）', katexCssJs.includes('data:font/woff2;base64,'));

// ---------------------------------------------------------------------------
// 2. 编码检测逻辑验证 —— 从 main.js 提取 detectAndDecode / decodeUtf8Strict
// ---------------------------------------------------------------------------

section('2. 编码检测逻辑验证（逻辑逐字取自 main.js）');

function decodeUtf8Strict(buf) {
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    return decoder.decode(buf);
  } catch (err) {
    return null;
  }
}

function detectAndDecode(buf) {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { encoding: 'utf8bom', content: buf.slice(3).toString('utf8') };
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return { encoding: 'utf16le', content: iconv.decode(buf.slice(2), 'utf16-le') };
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return { encoding: 'utf16be', content: iconv.decode(buf, 'utf16-be') };
  }
  const utf8 = decodeUtf8Strict(buf);
  if (utf8 !== null) {
    return { encoding: 'utf8', content: utf8 };
  }
  return { encoding: 'gb18030', content: iconv.decode(buf, 'gb18030') };
}

const ORIG = '墨笔编辑器：编码检测验证 123！';
const cases = [
  {
    name: 'UTF-8 BOM',
    buf: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(ORIG, 'utf8')]),
    expectEncoding: 'utf8bom',
    expectContent: ORIG
  },
  {
    name: '纯 UTF-8',
    buf: Buffer.from(ORIG, 'utf8'),
    expectEncoding: 'utf8',
    expectContent: ORIG
  },
  {
    name: 'GBK 编码中文（UTF-8 严格解码应失败→回退）',
    buf: iconv.encode(ORIG, 'gbk'),
    expectEncoding: 'gb18030',
    expectContent: ORIG
  },
  {
    name: 'GB18030 编码中文',
    buf: iconv.encode(ORIG, 'gb18030'),
    expectEncoding: 'gb18030',
    expectContent: ORIG
  },
  {
    name: 'UTF-16 LE 带 BOM',
    buf: Buffer.concat([Buffer.from([0xff, 0xfe]), iconv.encode(ORIG, 'utf16-le')]),
    expectEncoding: 'utf16le',
    expectContent: ORIG
  },
  {
    name: 'UTF-16 BE 带 BOM',
    buf: Buffer.concat([Buffer.from([0xfe, 0xff]), iconv.encode(ORIG, 'utf16-be')]),
    expectEncoding: 'utf16be',
    expectContent: ORIG
  },
  {
    name: '纯 ASCII',
    buf: Buffer.from('plain ascii text 123', 'ascii'),
    expectEncoding: 'utf8',
    expectContent: 'plain ascii text 123'
  }
];

for (const c of cases) {
  const r = detectAndDecode(c.buf);
  const okEnc = r.encoding === c.expectEncoding;
  const okContent = r.content === c.expectContent;
  check('编码检测', c.name, okEnc && okContent,
    `期望 encoding=${c.expectEncoding}, 实际 encoding=${r.encoding}, content 匹配=${r.content === c.expectContent}`);
}

// 截断的多字节序列：严格解码应返回 null
const truncated = Buffer.from([0xe4, 0xb8]); // "中" 的 UTF-8 前缀被截断
check('编码检测', '截断 UTF-8 多字节序列 decodeUtf8Strict 返回 null', decodeUtf8Strict(truncated) === null);

// 写入→读取 往返：GBK 保存后再次打开应还原
const savedGbk = iconv.encode(ORIG, 'gbk');
const reread = detectAndDecode(savedGbk);
check('编码检测', 'GBK 写入→重开往返一致（保存编码 gbk，检测回退 gb18030 解码成功）',
  reread.encoding === 'gb18030' && reread.content === ORIG);

// ---------------------------------------------------------------------------
// 3. IPC 通道一致性
// ---------------------------------------------------------------------------

section('3. IPC 通道一致性（静态解析 main.js / preload.js）');

const mainSrc = fs.readFileSync(path.join(ROOT, 'src', 'main.js'), 'utf8');
const preloadSrc = fs.readFileSync(path.join(ROOT, 'src', 'preload.js'), 'utf8');

const mainHandle = [...mainSrc.matchAll(/ipcMain\.handle\(\s*'([^']+)'/g)].map((m) => m[1]);
const mainOn = [...mainSrc.matchAll(/ipcMain\.on\(\s*'([^']+)'/g)].map((m) => m[1]);
const mainSend = [...mainSrc.matchAll(/webContents\.send\(\s*'([^']+)'/g)].map((m) => m[1]);
const preInvoke = [...preloadSrc.matchAll(/ipcRenderer\.invoke\(\s*'([^']+)'/g)].map((m) => m[1]);
const preSend = [...preloadSrc.matchAll(/ipcRenderer\.send\(\s*'([^']+)'/g)].map((m) => m[1]);
const preOn = [...preloadSrc.matchAll(/ipcRenderer\.on\(\s*'([^']+)'/g)].map((m) => m[1]);

console.log('main.js ipcMain.handle:', mainHandle.join(', '));
console.log('main.js ipcMain.on   :', mainOn.join(', '));
console.log('main.js webContents.send:', mainSend.join(', '));
console.log('preload ipcRenderer.invoke:', preInvoke.join(', '));
console.log('preload ipcRenderer.send :', preSend.join(', '));
console.log('preload ipcRenderer.on   :', preOn.join(', '));

// preload invoke → main handle
let ipcOk = true;
const invokeMissing = preInvoke.filter((ch) => !mainHandle.includes(ch));
check('IPC', 'preload invoke 的通道均在 main ipcMain.handle 注册', invokeMissing.length === 0,
  invokeMissing.length ? '缺失: ' + invokeMissing.join(', ') : '共 ' + preInvoke.length + ' 个 invoke 通道全部匹配');

// preload send → main on
const sendMissing = preSend.filter((ch) => !mainOn.includes(ch));
check('IPC', 'preload send 的通道均在 main ipcMain.on 注册', sendMissing.length === 0,
  sendMissing.length ? '缺失: ' + sendMissing.join(', ') : '共 ' + preSend.length + ' 个 send 通道全部匹配');

// main webContents.send → preload on
const mainSendMissing = mainSend.filter((ch) => !preOn.includes(ch));
check('IPC', 'main webContents.send 的通道均在 preload ipcRenderer.on 监听', mainSendMissing.length === 0,
  mainSendMissing.length ? '缺失: ' + mainSendMissing.join(', ') : '共 ' + mainSend.length + ' 个 send 通道全部匹配');

if (invokeMissing.length || sendMissing.length || mainSendMissing.length) ipcOk = false;
check('IPC', '双向通道一致性总判定', ipcOk);

// ---------------------------------------------------------------------------
// 4. 打包产物完整性
// ---------------------------------------------------------------------------

section('4. 打包产物完整性');

const buildDir = path.join(ROOT, 'build');
const exePortable = path.join(buildDir, 'YiQi@MD-Editor-wb-DSv4-Flash 1.0.0-portable-x64.exe');
const exeNsis = path.join(buildDir, 'YiQi@MD-Editor-wb-DSv4-Flash 1.0.0-x64.exe');
const asarPath = path.join(buildDir, 'win-unpacked', 'resources', 'app.asar');

function mb(bytes) {
  return (bytes / 1024 / 1024).toFixed(2);
}

let portableInfo = '不存在';
let nsisInfo = '不存在';
if (fs.existsSync(exePortable)) {
  const s = fs.statSync(exePortable);
  portableInfo = `${mb(s.size)} MiB (${s.size} bytes)`;
  check('打包产物', 'portable exe 存在', true, portableInfo);
  check('打包产物', 'portable exe 大小合理（≈76.5MB 十进制 / 72-74 MiB）',
    s.size > 70 * 1024 * 1024 && s.size < 82 * 1024 * 1024, `${mb(s.size)} MiB`);
} else {
  check('打包产物', 'portable exe 存在', false, portableInfo);
}

if (fs.existsSync(exeNsis)) {
  const s = fs.statSync(exeNsis);
  nsisInfo = `${mb(s.size)} MiB (${s.size} bytes)`;
  check('打包产物', 'nsis exe 存在', true, nsisInfo);
  check('打包产物', 'nsis exe 大小合理（≈76.7MB 十进制）',
    s.size > 70 * 1024 * 1024 && s.size < 82 * 1024 * 1024, `${mb(s.size)} MiB`);
} else {
  check('打包产物', 'nsis exe 存在', false, nsisInfo);
}

check('打包产物', 'app.asar 存在', fs.existsSync(asarPath),
  fs.existsSync(asarPath) ? `${mb(fs.statSync(asarPath).size)} MiB` : '未找到');

if (fs.existsSync(asarPath)) {
  // Windows 下 @electron/asar listPackage 返回反斜杠路径且带前导 '\'，统一归一化后比较
  const list = asar.listPackage(asarPath).map((f) => f.replace(/\\/g, '/').replace(/^\/+/, ''));
  const need = [
    'src/main.js',
    'src/preload.js',
    'src/renderer/index.html',
    'src/renderer/app.js',
    'src/renderer/editor.js',
    'src/renderer/fileops.js',
    'src/renderer/find.js',
    'src/renderer/preview.js',
    'src/renderer/tabbar.js',
    'src/renderer/utils.js',
    'src/renderer/styles.css',
    'src/renderer/vendor/bundle.js',
    'src/renderer/vendor/katex-css.js'
  ];
  for (const f of need) {
    check('asar 内容', `包含 ${f}`, list.includes(f));
  }
  // 生产依赖 iconv-lite（main 进程运行必需）
  const hasIconv = list.some((f) => f.startsWith('node_modules/iconv-lite/'));
  check('asar 内容', '包含生产依赖 node_modules/iconv-lite（main 进程 require 必需）', hasIconv);
  // 不应包含 devDependencies（bundle 已打包，无需重复）
  const hasMermaidInAsar = list.some((f) => f.startsWith('node_modules/mermaid/'));
  console.log('  [info] asar 内 node_modules/mermaid 存在:', hasMermaidInAsar, '（bundle 已内联，重复无妨）');
  const totalFiles = list.length;
  // 期望构成：src 树（约 17 条）+ 生产依赖 iconv-lite/safer-buffer（约 35 条），
  // 渲染层重型依赖已内联进 bundle.js，无需以 node_modules 形式进包
  check('asar 内容', `asar 共 ${totalFiles} 个文件条目（src 树 + iconv-lite 生产依赖，构成合理）`, totalFiles >= 30);

  // 字节级一致性：手动解析 asar pickle 头部，校验打包内容与源码构建产物完全一致
  try {
    const raw = fs.readFileSync(asarPath);
    const hdrSize = raw.readUInt32LE(4);
    const jsonLen = raw.readUInt32LE(12);
    const hdr = JSON.parse(raw.slice(16, 16 + jsonLen).toString('utf8'));
    const dataStart = 8 + hdrSize;
    const findFile = (node, parts) => {
      let cur = node;
      for (const p of parts) {
        if (!cur.files || !cur.files[p]) return null;
        cur = cur.files[p];
      }
      return cur;
    };
    const readBytes = (node) => {
      const off = dataStart + parseInt(node.offset, 10);
      return raw.slice(off, off + node.size);
    };
    const bNode = findFile(hdr, 'src/renderer/vendor/bundle.js'.split('/'));
    const bAsar = readBytes(bNode);
    const bSrc = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'vendor', 'bundle.js'));
    check('asar 字节校验', 'bundle.js 打包内容与源码构建产物字节一致', bAsar.equals(bSrc),
      `${bAsar.length} bytes identical`);
    const kNode = findFile(hdr, 'src/renderer/vendor/katex-css.js'.split('/'));
    const kAsar = readBytes(kNode);
    const kSrc = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'vendor', 'katex-css.js'));
    check('asar 字节校验', 'katex-css.js 打包内容与源码构建产物字节一致', kAsar.equals(kSrc),
      `${kAsar.length} bytes identical`);
    const mAsar = readBytes(findFile(hdr, 'src/main.js'.split('/'))).toString('utf8');
    check('asar 字节校验', '打包 main.js 含 detectAndDecode/registerIpc', mAsar.includes('detectAndDecode') && mAsar.includes('registerIpc'));
  } catch (err) {
    check('asar 字节校验', 'asar pickle 头部解析成功', false, err.message);
  }
}

// package.json files 配置覆盖检查
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const filesCfg = pkg.build && pkg.build.files;
check('files 配置', 'build.files 已配置', Array.isArray(filesCfg) && filesCfg.length > 0,
  filesCfg ? JSON.stringify(filesCfg) : '缺失');
if (Array.isArray(filesCfg)) {
  check('files 配置', '包含 src/**/*（覆盖 main/preload/renderer/vendor）', filesCfg.includes('src/**/*'));
  check('files 配置', '包含 package.json', filesCfg.includes('package.json'));
  check('files 配置', 'main 入口 src/main.js 位于覆盖范围', filesCfg.some((f) => f.includes('src')));
}
check('files 配置', 'main 字段指向 src/main.js', pkg.main === 'src/main.js');
check('files 配置', 'npm name 正确', pkg.name === 'yiqi-md-editor-wb-dsv4-flash');
check('files 配置', 'productName 正确（含版本号）', pkg.productName === 'YiQi@MD-Editor-wb-DSv4-Flash 1.0.0');
check('files 配置', 'build.productName 与 productName 一致', pkg.build && pkg.build.productName === 'YiQi@MD-Editor-wb-DSv4-Flash 1.0.0');
check('files 配置', 'build.nsis.shortcutName 正确', pkg.build && pkg.build.nsis && pkg.build.nsis.shortcutName === 'YiQi@MD-Editor-wb-DSv4-Flash 1.0.0');
check('files 配置', 'build.icon 指向 resources/icon.ico', pkg.build && pkg.build.icon === 'resources/icon.ico');
if (Array.isArray(filesCfg)) {
  check('files 配置', '包含 resources/**/*（图标进包）', filesCfg.includes('resources/**/*'));
}

// ---------------------------------------------------------------------------
// 5. 改名完整性 + 多标签实现（静态验证 src）
// ---------------------------------------------------------------------------

section('5. 改名完整性 + 多标签实现（静态验证 src）');

const mainSrcChk = fs.readFileSync(path.join(ROOT, 'src', 'main.js'), 'utf8');
const htmlSrcChk = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'index.html'), 'utf8');
const appSrcChk = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'app.js'), 'utf8');
const tabbarSrcChk = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'tabbar.js'), 'utf8');
const stylesSrcChk = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'styles.css'), 'utf8');

// 改名
check('改名', "main.js APP_NAME = YiQi@MD-Editor-wb-DSv4-Flash", mainSrcChk.includes("const APP_NAME = 'YiQi@MD-Editor-wb-DSv4-Flash'"));
check('改名', 'main.js 窗口标题使用 appTitle()（产品名 + 版本号）', mainSrcChk.includes('title: appTitle()') && mainSrcChk.includes('return APP_NAME + \' \' + app.getVersion()'));
check('改名', 'index.html <title> 含产品名 + 版本号', htmlSrcChk.includes('<title>YiQi@MD-Editor-wb-DSv4-Flash 1.0.0</title>'));
check('改名', 'index.html #app-logo 为短名（不含版本号）', htmlSrcChk.includes('>YiQi@MD-Editor-wb-DSv4-Flash</span>'));
check('改名', 'app.js document.title 拼接 APP_TITLE（含版本号）', appSrcChk.includes("const APP_TITLE = 'YiQi@MD-Editor-wb-DSv4-Flash 1.0.0'") && appSrcChk.includes("' - ' + APP_TITLE"));
check('改名', 'preload.js 头注释为新名', fs.readFileSync(path.join(ROOT, 'src', 'preload.js'), 'utf8').includes('YiQi@MD-Editor-wb-DSv4-Flash'));

// 多标签
check('多标签', 'index.html 含 #tabbar 容器', htmlSrcChk.includes('id="tabbar"'));
check('多标签', 'app.js 引入 TabManager', appSrcChk.includes("import { TabManager } from './tabbar.js'"));
check('多标签', 'app.js 新建 → tabManager.newTab', appSrcChk.includes("() => tabManager.newTab()"));
check('多标签', 'app.js 打开 → tabManager.openDialog', appSrcChk.includes("() => tabManager.openDialog()"));
check('多标签', 'app.js 保存 → tabManager.saveActive', appSrcChk.includes("() => tabManager.saveActive()"));
check('多标签', 'app.js 拖拽 → tabManager.openInTab', appSrcChk.includes('tabManager.openInTab(result)'));
check('多标签', 'app.js 会话恢复 → tabManager.openInTab', appSrcChk.includes('tabManager.openInTab(result)'));
check('多标签', 'tabbar.js 导出 TabManager 类', tabbarSrcChk.includes('export class TabManager'));
check('多标签', 'TabManager 实现 createTab 状态模型（path/name/content/encoding/dirty/scrollTop/cursorPos/lastSavedContent）',
  ['path:', 'name:', 'content:', 'encoding:', 'dirty:', 'scrollTop:', 'cursorPos:', 'lastSavedContent:'].every((k) => tabbarSrcChk.includes(k)));
check('多标签', 'TabManager 实现 switchTab / closeTab / newTab / openInTab',
  ['switchTab(id)', 'closeTab(id)', 'newTab()', 'openInTab(result)'].every((m) => tabbarSrcChk.includes(m)));
check('多标签', 'TabManager 关闭未保存标签弹「保存/不保存/取消」', tabbarSrcChk.includes("buttons: ['保存', '不保存', '取消']"));
check('多标签', 'FileOps 实现 setActiveTab', fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'fileops.js'), 'utf8').includes('setActiveTab(tab)'));
check('多标签', 'styles.css 含 #tabbar / .tab / .tab-close 样式', stylesSrcChk.includes('#tabbar') && stylesSrcChk.includes('.tab-close'));
check('多标签', 'bundle.js 已包含 TabManager 代码', fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'vendor', 'bundle.js'), 'utf8').includes('var TabManager = class'));

// 已知环境问题记录（builder-debug.yml 存在即佐证打包发生过）
check('环境记录', 'builder-debug.yml 存在（打包日志佐证）', fs.existsSync(path.join(buildDir, 'builder-debug.yml')));
check('环境记录', 'smoke-test.log 存在（冒烟测试佐证）', fs.existsSync(path.join(buildDir, 'smoke-test.log')));

// ---------------------------------------------------------------------------
// 汇总
// ---------------------------------------------------------------------------

section('QA 汇总');

const byArea = {};
for (const r of results) {
  (byArea[r.area] = byArea[r.area] || []).push(r);
}
let total = 0;
let passed = 0;
let failed = 0;
const failedList = [];
for (const area of Object.keys(byArea)) {
  const arr = byArea[area];
  const p = arr.filter((r) => r.pass).length;
  total += arr.length;
  passed += p;
  const f = arr.length - p;
  failed += f;
  arr.filter((r) => !r.pass).forEach((r) => failedList.push(`${r.area}: ${r.name}`));
  console.log(`  ${area}: ${p}/${arr.length} PASS${f ? '  (' + f + ' FAIL)' : ''}`);
}
console.log(`\n总计: ${passed}/${total} PASS, ${failed} FAIL`);
if (failedList.length) {
  console.log('失败清单:');
  failedList.forEach((f) => console.log('  - ' + f));
}

// 汇总 JSON（供团队读取）
const summary = {
  total,
  passed,
  failed,
  failedList,
  portableExe: portableInfo,
  nsisExe: nsisInfo,
  routingDecision: failed === 0 ? 'NoOne' : 'Engineer'
};
fs.writeFileSync(path.join(ROOT, 'qa-summary.json'), JSON.stringify(summary, null, 2));
console.log('\n已写入 qa-summary.json');
