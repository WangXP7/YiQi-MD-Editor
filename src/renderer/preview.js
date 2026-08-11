/**
 * YiQi@MD-Editor-wb-DSv4-Flash - 预览模块
 *
 * 基于 markdown-it（GFM + 脚注 + emoji + 锚点 + TOC + 上/下标 + 缩略语）、
 * KaTeX（数学公式）、highlight.js（代码高亮）、Mermaid（图表）构建渲染管线。
 * 预览渲染在 sandbox iframe 中执行，避免样式污染主界面。
 */

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
import mermaid from 'mermaid';
import githubCss from 'highlight.js/styles/github.css';
import githubDarkCss from 'highlight.js/styles/github-dark.css';
import katexCss from './vendor/katex-css.js';
import { escapeHtml, decodeHtmlEntities } from './utils.js';

// ---------------------------------------------------------------------------
// 状态
// ---------------------------------------------------------------------------

let iframe = null;
let previewDoc = null;
let currentDark = false;
let lastText = '';
let headingsIndex = [];
let headingElements = [];
let pendingRender = false;
let previewScrollCallback = null;
const mermaidCache = new Map();
let mermaidChain = Promise.resolve();

// ---------------------------------------------------------------------------
// markdown-it 配置
// ---------------------------------------------------------------------------

/**
 * 标题 ID 生成器：保留中文，去除其余符号。
 * @param {string} str 标题文本
 * @returns {string} slug
 */
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

/**
 * markdown-it 代码高亮回调。
 * @param {string} code 代码内容
 * @param {string} lang 语言标识
 * @returns {string} 渲染后的 HTML
 */
function highlightCode(code, lang) {
  if (lang === 'mermaid') {
    // Mermaid 块：保留原文，由后续 mermaid.run 渲染
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

/** markdown-it 实例（默认 preset 已含表格与删除线） */
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

// ---------------------------------------------------------------------------
// 自研锚点 + TOC 插件
//
// 说明：不依赖 markdown-it-anchor / markdown-it-toc-done-right，避免
// 第三方插件与 markdown-it@14 的 peerDependencies 冲突，保证 npm install
// 一次成功。功能等价：
//  - 为每个标题注入 id（slugify + 去重）
//  - 将 [[toc]] 占位符替换为按层级嵌套的目录导航
// ---------------------------------------------------------------------------

/**
 * 生成目录导航 HTML（按标题层级嵌套）。
 * @param {Array<{level: number, id: string, text: string}>} headings
 * @returns {string}
 */
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

/**
 * 递归渲染目录 <ul>。
 * @param {Array} nodes
 * @returns {string}
 */
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

/**
 * markdown-it core 规则：标题锚点 + [[toc]] 目录。
 * @param {MarkdownIt} mdInstance
 */
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

    // 从后往前替换占位符，避免索引失效
    for (let i = tocPlaceholders.length - 1; i >= 0; i -= 1) {
      const idx = tocPlaceholders[i];
      const tocToken = new state.Token('html_block', '', 0);
      tocToken.content = '<nav class="markdown-toc">' + renderTocHtml(env.headings) + '</nav>';
      state.tokens.splice(idx, 1, tocToken);
    }
  });
}

// ---------------------------------------------------------------------------
// 预览文档样式（GitHub 风格，手写实现）
// ---------------------------------------------------------------------------

/**
 * 生成预览 iframe 内使用的 Markdown 正文样式。
 * @param {boolean} dark 是否暗色主题
 * @returns {string} CSS 字符串
 */
function markdownCss(dark) {
  const vars = dark
    ? {
        bg: '#0d1117',
        text: '#e6edf3',
        secondary: '#9198a1',
        muted: '#6e7681',
        border: '#30363d',
        borderStrong: '#484f58',
        link: '#58a6ff',
        codeBg: 'rgba(110, 118, 129, 0.4)',
        blockBg: '#161b22',
        tableAlt: 'rgba(110, 118, 129, 0.1)',
        quoteColor: '#8b949e',
        hr: '#21262d',
        headingBorder: '#21262d',
        kbdBg: '#161b22',
        taskMark: '#3fb950'
      }
    : {
        bg: '#ffffff',
        text: '#24292f',
        secondary: '#57606a',
        muted: '#6e7781',
        border: '#d0d7de',
        borderStrong: '#afb8c1',
        link: '#0969da',
        codeBg: 'rgba(175, 184, 193, 0.2)',
        blockBg: '#f6f8fa',
        tableAlt: 'rgba(175, 184, 193, 0.2)',
        quoteColor: '#57606a',
        hr: '#d0d7de',
        headingBorder: '#d0d7de',
        kbdBg: '#f6f8fa',
        taskMark: '#1a7f37'
      };

  return `
:root {
  --md-bg: ${vars.bg};
  --md-text: ${vars.text};
  --md-secondary: ${vars.secondary};
  --md-muted: ${vars.muted};
  --md-border: ${vars.border};
  --md-border-strong: ${vars.borderStrong};
  --md-link: ${vars.link};
  --md-code-bg: ${vars.codeBg};
  --md-block-bg: ${vars.blockBg};
  --md-table-alt: ${vars.tableAlt};
  --md-quote: ${vars.quoteColor};
  --md-hr: ${vars.hr};
  --md-heading-border: ${vars.headingBorder};
  --md-kbd-bg: ${vars.kbdBg};
  --md-task-mark: ${vars.taskMark};
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--md-bg);
  color: var(--md-text);
}

body {
  font-family: 'Segoe UI', 'Microsoft YaHei', 'PingFang SC', 'Helvetica Neue', Arial, sans-serif;
  font-size: 16px;
  line-height: 1.7;
  word-wrap: break-word;
}

.markdown-body {
  max-width: 860px;
  margin: 0 auto;
  padding: 32px 40px 64px;
}

.markdown-body > *:first-child { margin-top: 0 !important; }
.markdown-body > *:last-child { margin-bottom: 0 !important; }

.markdown-body h1, .markdown-body h2, .markdown-body h3,
.markdown-body h4, .markdown-body h5, .markdown-body h6 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
  color: var(--md-text);
}

.markdown-body h1 {
  font-size: 2em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--md-heading-border);
}

.markdown-body h2 {
  font-size: 1.5em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--md-heading-border);
}

.markdown-body h3 { font-size: 1.25em; }
.markdown-body h4 { font-size: 1em; }
.markdown-body h5 { font-size: 0.875em; }
.markdown-body h6 {
  font-size: 0.85em;
  color: var(--md-secondary);
}

.markdown-body p {
  margin-top: 0;
  margin-bottom: 16px;
}

.markdown-body a {
  color: var(--md-link);
  text-decoration: none;
}

.markdown-body a:hover {
  text-decoration: underline;
}

.markdown-body img {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
}

.markdown-body hr {
  height: 0.25em;
  padding: 0;
  margin: 24px 0;
  background-color: var(--md-hr);
  border: 0;
}

.markdown-body blockquote {
  margin: 0 0 16px;
  padding: 0 1em;
  color: var(--md-quote);
  border-left: 0.25em solid var(--md-border-strong);
}

.markdown-body ul, .markdown-body ol {
  margin: 0 0 16px;
  padding-left: 2em;
}

.markdown-body li {
  margin: 0.25em 0;
}

.markdown-body li + li {
  margin-top: 0.25em;
}

.markdown-body li > p {
  margin-top: 4px;
  margin-bottom: 4px;
}

.markdown-body .task-list-item {
  list-style: none;
}

.markdown-body .task-list-item input[type='checkbox'] {
  margin-right: 6px;
  accent-color: var(--md-task-mark);
  vertical-align: middle;
}

.markdown-body code {
  padding: 0.2em 0.4em;
  margin: 0;
  font-size: 85%;
  font-family: 'Cascadia Code', 'Consolas', 'Microsoft YaHei', monospace;
  background-color: var(--md-code-bg);
  border-radius: 6px;
}

.markdown-body pre {
  margin: 0 0 16px;
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: var(--md-block-bg);
  border-radius: 6px;
}

.markdown-body pre code {
  padding: 0;
  margin: 0;
  font-size: 100%;
  background: transparent;
  border-radius: 0;
}

.markdown-body table {
  display: block;
  width: 100%;
  max-width: 100%;
  overflow: auto;
  margin: 0 0 16px;
  border-spacing: 0;
  border-collapse: collapse;
}

.markdown-body table th,
.markdown-body table td {
  padding: 6px 13px;
  border: 1px solid var(--md-border);
}

.markdown-body table tr {
  background-color: var(--md-bg);
  border-top: 1px solid var(--md-border-strong);
}

.markdown-body table tr:nth-child(2n) {
  background-color: var(--md-table-alt);
}

.markdown-body table th {
  font-weight: 600;
}

.markdown-body kbd {
  display: inline-block;
  padding: 3px 6px;
  font: 11px 'Cascadia Code', Consolas, monospace;
  color: var(--md-text);
  vertical-align: middle;
  background-color: var(--md-kbd-bg);
  border: 1px solid var(--md-border-strong);
  border-bottom-color: var(--md-border);
  border-radius: 6px;
  box-shadow: inset 0 -1px 0 var(--md-border);
}

.markdown-body sup, .markdown-body sub {
  line-height: 0;
}

.markdown-body abbr[title] {
  text-decoration: underline dotted;
  cursor: help;
}

.markdown-body .footnotes {
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px solid var(--md-border);
  font-size: 13px;
  color: var(--md-secondary);
}

.markdown-body .footnotes ol {
  padding-left: 1.5em;
}

.markdown-body .markdown-toc {
  padding: 12px 16px;
  margin: 0 0 24px;
  border: 1px solid var(--md-border);
  border-radius: 8px;
  background-color: var(--md-block-bg);
  font-size: 14px;
}

.markdown-body .markdown-toc ul {
  list-style: none;
  padding-left: 1em;
  margin: 4px 0;
}

.markdown-body .markdown-toc > ul {
  padding-left: 0;
  margin: 0;
}

.markdown-body .markdown-toc a {
  color: var(--md-link);
  text-decoration: none;
}

.markdown-body .markdown-toc a:hover {
  text-decoration: underline;
}

.markdown-body .mermaid {
  margin: 16px 0;
  text-align: center;
  background: transparent;
}

.markdown-body .mermaid svg {
  max-width: 100%;
  height: auto;
}

.markdown-body .hljs {
  background: transparent;
  padding: 0;
}

@media (max-width: 600px) {
  .markdown-body {
    padding: 16px;
  }
}
`;
}

// ---------------------------------------------------------------------------
// iframe 初始化与渲染
// ---------------------------------------------------------------------------

/**
 * 构建预览 iframe 的初始文档。
 * @param {boolean} dark 是否暗色主题
 * @returns {string} HTML 字符串
 */
function buildPreviewDocument(dark) {
  return (
    '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">' +
    '<style>' + markdownCss(dark) + '</style>' +
    '<style>' + (dark ? githubDarkCss : githubCss) + '</style>' +
    '<style>' + katexCss + '</style>' +
    '</head><body><article class="markdown-body"></article></body></html>'
  );
}

/**
 * 初始化预览 iframe。
 * @param {HTMLIFrameElement} frame iframe 元素
 */
export function initPreview(frame) {
  iframe = frame;
  iframe.addEventListener('load', () => {
    previewDoc = iframe.contentDocument;
    // 预览区滚动 → 大纲当前章节高亮（回调由 OutlineManager 注册）
    const scrollEl = previewDoc.scrollingElement || previewDoc.documentElement;
    if (scrollEl) {
      scrollEl.addEventListener('scroll', () => {
        if (previewScrollCallback) previewScrollCallback();
      });
    }
    // 拦截外部链接：交给主进程用系统浏览器打开；锚点链接内部滚动
    previewDoc.addEventListener('click', (e) => {
      const target = e.target;
      const a = target && target.closest ? target.closest('a') : null;
      if (!a || !a.href) return;
      const href = a.getAttribute('href') || '';
      if (href.startsWith('#')) return;
      e.preventDefault();
      const url = a.href;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        window.open(url, '_blank');
      }
    });
    if (pendingRender) {
      pendingRender = false;
      doRender(lastText);
    }
  });
  iframe.srcdoc = buildPreviewDocument(currentDark);
}

/**
 * 确保 Mermaid 已初始化（仅一次）。
 */
function ensureMermaid() {
  if (mermaid.__mdEditorInited) return;
  mermaid.__mdEditorInited = true;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: currentDark ? 'dark' : 'default',
    fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif'
  });
}

/**
 * 处理文档中的 Mermaid 块：渲染 SVG 并注入预览 iframe。
 *
 * 修复说明：mermaid.run({nodes}) 内部通过主文档 document.getElementById
 * 定位渲染容器，若直接把 iframe 文档内的节点传入，会因跨文档查找失败而报错
 * （QA 已知缺陷）。改为：在主文档（渲染进程上下文）创建隐藏渲染节点 →
 * mermaid.run 渲染出 SVG → 将 SVG 节点移入预览 iframe（DOM 节点跨文档
 * 插入会被自动 adopt，样式继承 iframe 内 markdownCss）。
 *
 * @param {Document} doc iframe 文档
 */
function processMermaidBlocks(doc) {
  const codeEls = doc.querySelectorAll('pre.mermaid-block code.language-mermaid');
  if (codeEls.length === 0) return;
  ensureMermaid();

  // 主文档隐藏宿主（渲染容器）
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-99999px;top:0;width:0;height:0;overflow:hidden;';
  document.body.appendChild(host);

  /** @type {Array<{placeholder: HTMLElement, node: HTMLElement, source: string}>} */
  const jobs = [];
  codeEls.forEach((codeEl) => {
    const pre = codeEl.parentElement;
    const source = codeEl.textContent || '';
    // iframe 内占位（渲染成功后被 SVG 替换，失败显示错误）
    const placeholder = doc.createElement('div');
    placeholder.className = 'mermaid-placeholder';
    placeholder.textContent = '（图表加载中…）';
    placeholder.style.cssText = 'text-align:center;color:var(--md-muted);padding:8px;';
    if (pre) pre.replaceWith(placeholder);
    // 主文档渲染节点
    const node = document.createElement('div');
    node.className = 'mermaid';
    node.textContent = source;
    node.setAttribute('data-source', source);
    host.appendChild(node);
    jobs.push({ placeholder, node, source });
  });

  mermaidChain = mermaidChain
    .then(() => mermaid.run({ nodes: jobs.map((j) => j.node) }))
    .then(() => {
      jobs.forEach((job) => {
        const svg = job.node.querySelector('svg');
        if (svg) {
          const key = job.source + (currentDark ? ':dark' : ':light');
          mermaidCache.set(key, svg.outerHTML);
          // SVG 移入 iframe 文档（自动 adopt）
          job.placeholder.replaceWith(svg);
        } else {
          job.placeholder.classList.add('mermaid-error');
          job.placeholder.textContent = '【Mermaid 渲染失败】' + job.source;
        }
      });
    })
    .catch((err) => {
      console.error('Mermaid 渲染失败:', err);
      jobs.forEach((job) => {
        job.placeholder.classList.add('mermaid-error');
        job.placeholder.textContent = '【Mermaid 渲染失败】' + job.source;
      });
    })
    .finally(() => {
      host.remove();
    });
}

/**
 * 扫描 Markdown 源文本中的标题（跳过代码围栏），用于滚动联动。
 * @param {string} text 源文本
 * @returns {Array<{level: number, text: string, line: number}>}
 */
export function scanHeadings(text) {
  const result = [];
  const lines = String(text || '').split('\n');
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*(```+|~~~+)/);
    if (fence) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (m) {
      result.push({ level: m[1].length, text: m[2], line: i + 1 });
    }
  }
  return result;
}

/**
 * 执行一次完整渲染（写入 iframe 正文 + 处理 Mermaid + 刷新标题索引）。
 * @param {string} text 源文本
 */
function doRender(text) {
  lastText = text;
  if (!previewDoc) return;
  const body = previewDoc.querySelector('article.markdown-body');
  if (!body) return;
  body.innerHTML = md.render(text || '');
  processMermaidBlocks(previewDoc);
  headingsIndex = scanHeadings(text);
  headingElements = Array.from(previewDoc.querySelectorAll('h1, h2, h3, h4, h5, h6'));
}

/**
 * 渲染预览（外部调用入口，自动处理 iframe 未就绪的情况）。
 * @param {string} text 源文本
 */
export function renderPreview(text) {
  lastText = text;
  if (!previewDoc) {
    pendingRender = true;
    return;
  }
  doRender(text);
}

/**
 * 设置预览主题（亮/暗），重建 iframe 文档并重新渲染。
 * @param {boolean} dark 是否暗色主题
 */
export function setPreviewTheme(dark) {
  currentDark = dark;
  if (!iframe) return;
  pendingRender = true;
  previewDoc = null;
  iframe.srcdoc = buildPreviewDocument(dark);
}

/**
 * 获取当前主题是否为暗色。
 * @returns {boolean}
 */
export function isPreviewDark() {
  return currentDark;
}

/**
 * 将编辑器滚动位置同步到预览区。
 * 优先按标题分块定位，无标题时按内容比例映射。
 * @param {object} view CodeMirror 视图
 */
export function syncScroll(view) {
  if (!previewDoc || !view) return;
  const scrollEl = previewDoc.scrollingElement || previewDoc.documentElement;
  if (!scrollEl) return;

  const editorScroll = view.scrollDOM;
  const editorMax = editorScroll.scrollHeight - editorScroll.clientHeight;
  const ratio = editorMax > 0 ? editorScroll.scrollTop / editorMax : 0;

  // 计算编辑区顶部可见行号（lineBlockAtHeight 接受内容坐标 scrollTop，精确可靠；
  // posAtCoords 需要 client 坐标且在未渲染视口返回 null，仅作兜底）
  let topLine = 1;
  try {
    const block = view.lineBlockAtHeight(editorScroll.scrollTop + 2);
    topLine = view.state.doc.lineAt(block.from).number;
  } catch (err) {
    const pos = view.posAtCoords({ x: 0, y: 2 });
    if (pos !== null) {
      const line = view.state.doc.lineAt(pos);
      topLine = line.number;
    }
  }

  // 找到源文件中位于当前行之前（含）的最后一个标题
  let targetIdx = null;
  for (let i = 0; i < headingsIndex.length; i++) {
    if (headingsIndex[i].line <= topLine) {
      targetIdx = i;
    } else {
      break;
    }
  }

  let targetTop = 0;
  if (targetIdx !== null && headingElements[targetIdx]) {
    targetTop = headingElements[targetIdx].offsetTop - 10;
  } else {
    const previewMax = scrollEl.scrollHeight - scrollEl.clientHeight;
    targetTop = previewMax * ratio;
  }

  scrollEl.scrollTop = Math.max(0, Math.round(targetTop));
}

// ---------------------------------------------------------------------------
// 大纲联动接口（供左侧大纲栏 OutlineManager 复用）
// ---------------------------------------------------------------------------

/**
 * 获取当前文档标题索引（scanHeadings 结果）。
 * @returns {Array<{level: number, text: string, line: number}>}
 */
export function getHeadings() {
  return headingsIndex;
}

/**
 * 获取预览区标题 DOM 元素引用（与 headingsIndex 一一对应）。
 * @returns {HTMLElement[]}
 */
export function getHeadingElements() {
  return headingElements;
}

/**
 * 获取预览区滚动位置。
 * @returns {number}
 */
export function getPreviewScrollTop() {
  if (!previewDoc) return 0;
  const scrollEl = previewDoc.scrollingElement || previewDoc.documentElement;
  return scrollEl ? scrollEl.scrollTop : 0;
}

/**
 * 将预览区滚动到指定标题（先按索引，索引失配时按标题文本回退匹配）。
 * @param {number} index 标题索引
 */
export function scrollPreviewToHeading(index) {
  if (!previewDoc) return;
  const scrollEl = previewDoc.scrollingElement || previewDoc.documentElement;
  if (!scrollEl) return;
  let el = headingElements[index];
  if (!el && headingsIndex[index]) {
    const targetText = String(headingsIndex[index].text).trim();
    el = headingElements.find((h) => String(h.textContent || '').trim() === targetText) || null;
  }
  if (!el) return;
  scrollEl.scrollTop = Math.max(0, Math.round(el.offsetTop - 10));
}

/**
 * 注册预览区滚动回调（大纲当前章节高亮）。
 * @param {() => void} callback
 */
export function onPreviewScroll(callback) {
  previewScrollCallback = callback;
}

// ---------------------------------------------------------------------------
// 帮助文档与导出
// ---------------------------------------------------------------------------

const HELP_MARKDOWN = [
  '# Markdown 语法速查',
  '',
  '## 标题',
  '',
  '- `# 一级标题` 至 `###### 六级标题`',
  '',
  '## 强调与删除线',
  '',
  '- `**加粗**`、`*斜体*`、`***加粗斜体***`',
  '- `~~删除线~~`',
  '',
  '## 列表',
  '',
  '- 无序列表：`- 项目`',
  '- 有序列表：`1. 项目`',
  '- 任务列表：`- [ ] 待办`、`- [x] 已完成`',
  '',
  '## 链接与图片',
  '',
  '- `[文字](https://example.com)`',
  '- `![图片说明](图片地址)`',
  '- 自动链接：https://example.com',
  '',
  '## 引用与代码',
  '',
  '- 引用：`> 引用内容`',
  '- 行内代码：`` `code` ``',
  '- 代码块：',
  '',
  '```javascript',
  "console.log('Hello');",
  '```',
  '',
  '## 表格',
  '',
  '| 列 1 | 列 2 |',
  '| ---- | ---- |',
  '| A    | B    |',
  '',
  '## 数学公式（KaTeX）',
  '',
  '- 行内：`$E = mc^2$`',
  '- 块级：`$$` 换行后写公式，再 `$$` 结束',
  '',
  '## 图表（Mermaid）',
  '',
  '```mermaid',
  'graph TD',
  '  A[开始] --> B[处理]',
  '  B --> C[结束]',
  '```',
  '',
  '## 其他',
  '',
  '- 脚注：文字[^1]，底部定义 `[^1]: 注释内容`',
  '- Emoji：`:smile:` :smile:',
  '- 目录：在文档中写入 `[[toc]]` 自动生成',
  '- 上标 `^上标^`、下标 `~下标~`、缩略语 `*[HTML]: 超文本标记语言`',
  '',
  '[^1]: 这是脚注内容。'
].join('\n');

/**
 * 在预览区显示语法速查帮助文档（不修改编辑缓冲区）。
 */
export function showHelp() {
  renderPreview(HELP_MARKDOWN);
}

/**
 * 渲染 Markdown 为正文 HTML（供导出使用）。
 * @param {string} text 源文本
 * @returns {string} 正文 HTML
 */
export function renderMarkdownBody(text) {
  return md.render(text || '');
}

/**
 * 将 Mermaid 块替换为已缓存的 SVG（导出时使用）。
 * @param {string} bodyHtml 正文 HTML
 * @returns {string}
 */
function processMermaidForExport(bodyHtml) {
  return bodyHtml.replace(
    /<pre class="mermaid-block"><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
    (match, inner) => {
      const source = decodeHtmlEntities(inner);
      const key = source + (currentDark ? ':dark' : ':light');
      const svg = mermaidCache.get(key);
      if (svg) {
        return '<div class="mermaid">' + svg + '</div>';
      }
      return match;
    }
  );
}

/**
 * 获取完整预览 CSS（用于导出 HTML/PDF）。
 * @returns {string}
 */
export function getFullCss() {
  return markdownCss(currentDark) + '\n' + (currentDark ? githubDarkCss : githubCss) + '\n' + katexCss;
}

/**
 * 构造导出载荷（HTML 正文 + 标题 + 完整 CSS）。
 * @param {string} text 源文本
 * @param {string} title 文档标题
 * @returns {{htmlBody: string, title: string, css: string}}
 */
export function getExportPayload(text, title) {
  const bodyHtml = renderMarkdownBody(text);
  return {
    htmlBody: processMermaidForExport(bodyHtml),
    title: title || '未命名',
    css: getFullCss()
  };
}
