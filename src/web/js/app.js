/* ============================================================
 * YiQi@MD-Editor-千问办公-Qwen3.8-Max v1.0.0 · app.js
 * ============================================================ */
'use strict';

/* ---------- 常量 ---------- */
const APP_NAME = 'YiQi@MD-Editor-千问办公-Qwen3.8-Max';
const APP_VERSION = 'v1.0.0';

/* ---------- DOM ---------- */
const $ = (s) => document.querySelector(s);
const previewPane = $('#previewPane');
const preview = $('#preview');
const outlineEl = $('#outline');
const fileChip = $('#fileChip');
const fileNameEl = $('#fileName');
const stPos = $('#stPos');
const stEnc = $('#stEnc');
const stCount = $('#stCount');
const stSaved = $('#stSaved');

/* ---------- 状态 ---------- */
let cm = null;
let md = null;
let currentPath = null;   // 当前文件绝对路径
let currentDir = null;    // 当前文件所在目录
let currentEncoding = 'UTF-8';
let dirty = false;
let renderTimer = null;
let mermaidTimer = null;
let lastMermaidPromise = null;

/* ---------- pywebview 桥 ---------- */
const hasPy = () => !!(window.pywebview && window.pywebview.api);
function pyCall(name, ...args) {
  if (!hasPy()) return Promise.resolve(null);
  try { return Promise.resolve(window.pywebview.api[name](...args)); }
  catch (e) { return Promise.resolve(null); }
}

/* ---------- 工具 ---------- */
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function slugify(s) {
  return 'h-' + String(s).toLowerCase().replace(/[^\w\u4e00-\u9fa5-]+/g, '-').replace(/^-+|-+$/g, '') || 'h';
}
function baseName(p) { return p ? p.replace(/^.*[/\\]/, '') : ''; }
function dirName(p) { return p ? p.replace(/[/\\][^/\\]*$/, '') : null; }

/* ============================================================
 * Markdown 渲染器初始化
 * ============================================================ */
function initMd() {
  md = window.markdownit({
    html: true,
    linkify: true,
    typographer: true,
    breaks: false,
    highlight: () => '' // 使用自定义 fence 渲染器
  });

  md.use(window.markdownitTaskLists, { enabled: true, label: true });
  md.use(window.markdownitFootnote);
  md.use(window.markdownitSub);
  md.use(window.markdownitSup);
  md.use(window.markdownitMark);
  md.use(window.markdownitIns);
  md.use(window.markdownitDeflist);
  md.use(window.markdownitAbbr);
  md.use(window.markdownitEmoji);

  // 数学公式 KaTeX（含 mhchem 化学式）
  if (window.texmath && window.katex) {
    md.use(window.texmath, {
      engine: window.katex,
      delimiters: 'dollars',
      katexOptions: { throwOnError: false, strict: false, output: 'htmlAndMathml' }
    });
  }

  // 容器块 ::: note / info / tip / warning / danger
  const admMeta = {
    note: ['📘', '笔记'], info: ['ℹ️', '信息'], tip: ['💡', '提示'],
    warning: ['⚠️', '警告'], danger: ['🚫', '危险']
  };
  Object.keys(admMeta).forEach((name) => {
    md.use(window.markdownitContainer, name, {
      validate: (params) => params.trim().split(/\s+/)[0] === name,
      render: (tokens, idx) => {
        if (tokens[idx].nesting === 1) {
          const rest = tokens[idx].info.trim().slice(name.length).trim();
          const title = rest || admMeta[name][1];
          return `<div class="admonition ${name}"><p class="adm-title">${admMeta[name][0]} ${escapeHtml(title)}</p>\n`;
        }
        return '</div>\n';
      }
    });
  });

  // 代码块 / mermaid 自定义 fence
  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const lang = (token.info || '').trim().split(/\s+/)[0] || '';
    const code = token.content;
    if (lang === 'mermaid') {
      return `<div class="mermaid-wrap"><div class="mermaid">${escapeHtml(code)}</div></div>`;
    }
    let html, label = lang || 'text';
    if (lang && window.hljs.getLanguage(lang)) {
      try { html = window.hljs.highlight(code, { language: lang, ignoreIllegals: true }).value; }
      catch (e) { html = escapeHtml(code); }
    } else {
      try { html = window.hljs.highlightAuto(code).value; } catch (e) { html = escapeHtml(code); }
    }
    return `<div class="codeblock"><div class="cb-head"><span>${escapeHtml(label)}</span>` +
      `<button class="cb-copy" data-code="${encodeURIComponent(code)}">复制</button></div>` +
      `<pre><code class="hljs">${html}</code></pre></div>`;
  };

  // 标题 id（供大纲跳转）
  const defHeading = md.renderer.rules.heading_open ||
    ((tokens, idx, opts, env, self) => self.renderToken(tokens, idx, opts));
  md.renderer.rules.heading_open = (tokens, idx, opts, env, self) => {
    const inline = tokens[idx + 1];
    if (inline && inline.content != null) tokens[idx].attrSet('id', slugify(inline.content));
    return defHeading(tokens, idx, opts, env, self);
  };

  // 外链新窗口
  const defLink = md.renderer.rules.link_open ||
    ((tokens, idx, opts, env, self) => self.renderToken(tokens, idx, opts));
  md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
    tokens[idx].attrSet('rel', 'noopener');
    return defLink(tokens, idx, opts, env, self);
  };
}

/* ============================================================
 * Mermaid
 * ============================================================ */
function initMermaid() {
  if (!window.mermaid) return;
  const dark = document.documentElement.dataset.theme === 'dark';
  window.mermaid.initialize({
    startOnLoad: false,
    theme: dark ? 'dark' : 'default',
    securityLevel: 'loose',
    fontFamily: '"Segoe UI","Microsoft YaHei",sans-serif',
    suppressErrors: true
  });
}
function runMermaid() {
  if (!window.mermaid) return;
  const nodes = Array.from(preview.querySelectorAll('.mermaid'));
  if (!nodes.length) return;
  lastMermaidPromise = window.mermaid.run({ nodes }).catch((err) => {
    nodes.forEach((n) => {
      const wrap = n.closest('.mermaid-wrap');
      if (wrap) {
        wrap.classList.add('mermaid-error');
        wrap.textContent = 'Mermaid 渲染错误：' + ((err && err.message) || err) + '\n' + n.textContent;
      }
    });
  });
}

/* ============================================================
 * 渲染管线
 * ============================================================ */
function splitFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
  if (!m) return { fm: null, body: src };
  return { fm: m[1], body: src.slice(m[0].length) };
}
function fmHtml(fm) {
  const rows = fm.split(/\r?\n/).map((l) => {
    const i = l.indexOf(':');
    if (i < 0 || !l.trim()) return '';
    return `<tr><td>${escapeHtml(l.slice(0, i).trim())}</td><td>${escapeHtml(l.slice(i + 1).trim())}</td></tr>`;
  }).join('');
  if (!rows) return '';
  return `<div class="fm-panel"><div class="fm-title">Frontmatter · YAML</div><table>${rows}</table></div>`;
}

function renderNow() {
  const src = cm.getValue();
  const { fm, body } = splitFrontmatter(src);
  let html;
  try { html = md.render(body); }
  catch (e) { html = `<p style="color:#f0506e">渲染错误：${escapeHtml(String(e))}</p>`; }
  preview.innerHTML = (fm ? fmHtml(fm) : '') + html;
  runMermaid();
  resolveImages();
  buildOutline(src);
  updateStats(src);
}
function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(renderNow, 160);
}

/* 图片本地路径 → data URI（pywebview 环境） */
async function resolveImages() {
  if (!hasPy() || !currentDir) return;
  const imgs = Array.from(preview.querySelectorAll('img'));
  for (const img of imgs) {
    const src = img.getAttribute('src') || '';
    if (/^(data:|https?:|blob:)/i.test(src)) continue;
    const uri = await pyCall('image_data_uri', currentDir, src);
    if (uri) img.src = uri;
  }
}

/* 大纲 */
function buildOutline(src) {
  let tokens = [];
  try { tokens = md.parse(splitFrontmatter(src).body, {}); } catch (e) { /* noop */ }
  const items = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'heading_open' && t.map) {
      const text = (tokens[i + 1] && tokens[i + 1].content) || '';
      items.push({ level: +t.tag.slice(1), line: t.map[0], text });
    }
  }
  if (!items.length) {
    outlineEl.innerHTML = '<div class="ol-empty">暂无标题</div>';
    return;
  }
  outlineEl.innerHTML = items.map((it, i) =>
    `<button class="ol-item lv${it.level}" data-line="${it.line}" data-i="${i}" title="${escapeHtml(it.text)}">${escapeHtml(it.text)}</button>`
  ).join('');
}
outlineEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.ol-item');
  if (!btn) return;
  const line = +btn.dataset.line;
  cm.setCursor({ line, ch: 0 });
  cm.scrollIntoView({ line, ch: 0 }, 80);
  cm.focus();
  const id = slugify(btn.textContent);
  const target = preview.querySelector('#' + CSS.escape(id));
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

/* 统计 */
function updateStats(src) {
  const chars = src.replace(/\s/g, '').length;
  const cjk = (src.match(/[\u4e00-\u9fa5]/g) || []).length;
  const words = cjk + ((src.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[A-Za-z0-9_'-]+/g) || []).length);
  const lines = src.split('\n').length;
  stCount.textContent = `${chars} 字 · ${words} 词 · ${lines} 行`;
}

/* ============================================================
 * CodeMirror 编辑器
 * ============================================================ */
function initCM() {
  cm = CodeMirror.fromTextArea($('#editor'), {
    mode: { name: 'markdown', highlightFormatting: true, xml: true },
    theme: 'yiqi',
    lineNumbers: true,
    lineWrapping: true,
    styleActiveLine: true,
    indentUnit: 4,
    tabSize: 4,
    extraKeys: {
      'Enter': 'newlineAndIndentContinueMarkdownList',
      'Ctrl-S': () => save(), 'Cmd-S': () => save(),
      'Ctrl-B': () => act('bold'),
      'Ctrl-I': () => act('italic'),
      'Ctrl-K': () => act('link'),
      'Ctrl-1': () => setView('edit'),
      'Ctrl-2': () => setView('split'),
      'Ctrl-3': () => setView('preview'),
      'Ctrl-\\': () => toggleSidebar(),
      'F1': () => $('#aboutModal').classList.add('show')
    }
  });
  cm.on('change', () => {
    setDirty(true);
    scheduleRender();
  });
  cm.on('cursorActivity', () => {
    const c = cm.getCursor();
    stPos.textContent = `行 ${c.line + 1}, 列 ${c.ch + 1}`;
  });
}

/* 同步滚动 */
let scrollLock = 0; // 1=editor 驱动, 2=preview 驱动
function bindSyncScroll() {
  cm.on('scroll', () => {
    if (scrollLock === 2) { scrollLock = 0; return; }
    scrollLock = 1;
    const si = cm.getScrollInfo();
    const r = si.top / Math.max(1, si.height - si.clientHeight);
    previewPane.scrollTop = r * (previewPane.scrollHeight - previewPane.clientHeight);
    setTimeout(() => { if (scrollLock === 1) scrollLock = 0; }, 60);
  });
  previewPane.addEventListener('scroll', () => {
    if (scrollLock === 1) { scrollLock = 0; return; }
    scrollLock = 2;
    const r = previewPane.scrollTop / Math.max(1, previewPane.scrollHeight - previewPane.clientHeight);
    const si = cm.getScrollInfo();
    cm.scrollTo(null, r * (si.height - si.clientHeight));
    setTimeout(() => { if (scrollLock === 2) scrollLock = 0; }, 60);
  });
}

/* ============================================================
 * 文档管理
 * ============================================================ */
function setDirty(v) {
  dirty = v;
  fileChip.classList.toggle('dirty', v);
  if (v) stSaved.textContent = '未保存';
}
function setDoc(path, content, enc) {
  currentPath = path;
  currentDir = path ? dirName(path) : null;
  currentEncoding = enc || 'UTF-8';
  stEnc.textContent = currentEncoding;
  fileNameEl.textContent = path ? baseName(path) : '未命名文档.md';
  fileChip.title = path || '';
  const t = path ? `${baseName(path)} — ${APP_NAME} ${APP_VERSION}` : `${APP_NAME} ${APP_VERSION}`;
  document.title = t;
  pyCall('set_title', t);
  cm.setValue(content);
  cm.clearHistory();
  cm.setCursor({ line: 0, ch: 0 });
  setDirty(false);
  stSaved.textContent = '已就绪';
  renderNow();
}

async function newDoc() {
  if (dirty && !confirm('当前文档尚未保存，确定放弃修改并新建吗？')) return;
  setDoc(null, '', 'UTF-8');
}
async function openFile() {
  if (hasPy()) {
    const path = await pyCall('open_dialog');
    if (path) await loadPath(path);
  } else {
    $('#fileInput').click();
  }
}
async function loadPath(path) {
  const r = await pyCall('read_file', path);
  if (r && r.ok) {
    if (dirty && !confirm('当前文档尚未保存，确定放弃修改并打开新文件吗？')) return;
    setDoc(path, r.content, r.encoding);
  } else {
    alert('无法读取文件：' + path + '\n' + ((r && r.error) || ''));
  }
}
async function save() {
  if (!currentPath) return saveAs();
  const r = await pyCall('write_file', currentPath, cm.getValue());
  if (r && r.ok) {
    setDirty(false);
    stSaved.textContent = '已保存 ' + new Date().toTimeString().slice(0, 5);
  } else {
    alert('保存失败：' + ((r && r.error) || '未知错误'));
  }
}
async function saveAs() {
  const def = currentPath ? baseName(currentPath) : '未命名文档.md';
  const p = await pyCall('save_dialog', def);
  if (!p) return;
  currentPath = p;
  currentDir = dirName(p);
  fileNameEl.textContent = baseName(p);
  await save();
}
async function exportHtml() {
  renderNow();
  if (lastMermaidPromise) { try { await lastMermaidPromise; } catch (e) {} }
  const body = preview.innerHTML;
  const def = (currentPath ? baseName(currentPath).replace(/\.[^.]+$/, '') : 'document') + '.html';
  const p = await pyCall('save_dialog', def);
  if (!p) return;
  const r = await pyCall('export_html', p, body, document.documentElement.dataset.theme, document.title);
  if (r && r.ok) stSaved.textContent = '已导出 HTML';
  else alert('导出失败：' + ((r && r.error) || ''));
}

/* ============================================================
 * 排版操作
 * ============================================================ */
function wrapSel(pre, suf, ph) {
  const sel = cm.getSelection() || ph;
  const from = cm.getCursor('from');
  cm.replaceSelection(pre + sel + suf);
  cm.setSelection({ line: from.line, ch: from.ch + pre.length },
                  { line: from.line, ch: from.ch + pre.length + sel.length });
  cm.focus();
}
function insertText(text) { cm.replaceSelection(text); cm.focus(); }
function setHeading(level) {
  const { from, to } = cm.findSelections ? { from: cm.getCursor('from'), to: cm.getCursor('to') } : {};
  const s = cm.getCursor('from').line, e = cm.getCursor('to').line;
  cm.operation(() => {
    for (let i = s; i <= e; i++) {
      const line = cm.getLine(i);
      const stripped = line.replace(/^#{1,6}\s+/, '');
      cm.replaceRange('#'.repeat(level) + ' ' + stripped, { line: i, ch: 0 }, { line: i, ch: line.length });
    }
  });
  cm.focus();
}
function prefixLines(prefixFn) {
  const s = cm.getCursor('from').line, e = cm.getCursor('to').line;
  cm.operation(() => {
    for (let i = s; i <= e; i++) {
      const line = cm.getLine(i);
      const p = typeof prefixFn === 'function' ? prefixFn(i - s) : prefixFn;
      const stripped = line.replace(/^(\s*)(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+\.\s+|>\s+)?/, '$1');
      cm.replaceRange(p + stripped.replace(/^\s*/, ''), { line: i, ch: 0 }, { line: i, ch: line.length });
    }
  });
  cm.focus();
}

function act(name) {
  switch (name) {
    case 'new': newDoc(); break;
    case 'open': openFile(); break;
    case 'save': save(); break;
    case 'saveas': saveAs(); break;
    case 'export': exportHtml(); break;
    case 'print': window.print(); break;
    case 'h1': setHeading(1); break;
    case 'h2': setHeading(2); break;
    case 'h3': setHeading(3); break;
    case 'bold': wrapSel('**', '**', '加粗文本'); break;
    case 'italic': wrapSel('*', '*', '斜体文本'); break;
    case 'strike': wrapSel('~~', '~~', '删除线文本'); break;
    case 'mark': wrapSel('==', '==', '高亮文本'); break;
    case 'code': wrapSel('`', '`', 'code'); break;
    case 'quote': prefixLines('> '); break;
    case 'ul': prefixLines('- '); break;
    case 'ol': prefixLines((i) => `${i + 1}. `); break;
    case 'task': prefixLines('- [ ] '); break;
    case 'codeblock': insertText('\n```python\nprint("Hello, YiQi@MD-Editor!")\n```\n'); break;
    case 'table': insertText('\n| 表头1 | 表头2 | 表头3 |\n| :--- | :---: | ---: |\n| 内容 | 内容 | 内容 |\n'); break;
    case 'link': wrapSel('[', '](https://example.com)', '链接文字'); break;
    case 'image': insertText('![图片描述](image.png)'); break;
    case 'math': insertText('\n$$\nE = mc^2\n$$\n'); break;
    case 'mermaid': insertText('\n```mermaid\nflowchart TD\n    A[开始] --> B{是否继续?}\n    B -- 是 --> C[执行任务]\n    B -- 否 --> D[结束]\n```\n'); break;
    case 'hr': insertText('\n---\n'); break;
    case 'note': insertText('\n::: tip 提示\n这里是一段提示内容。\n:::\n'); break;
  }
}

/* ============================================================
 * UI 绑定
 * ============================================================ */
function setView(v) {
  document.body.dataset.view = v;
  document.querySelectorAll('#viewSeg button').forEach((b) =>
    b.classList.toggle('active', b.dataset.view === v));
  try { localStorage.setItem('yiqi-view', v); } catch (e) {}
  cm.refresh();
}
function toggleSidebar() {
  const on = document.body.dataset.sidebar === 'on';
  document.body.dataset.sidebar = on ? 'off' : 'on';
  try { localStorage.setItem('yiqi-sidebar', on ? 'off' : 'on'); } catch (e) {}
  setTimeout(() => cm.refresh(), 240);
}
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  $('#hljs-light').disabled = (t !== 'light');
  $('#hljs-dark').disabled = (t !== 'dark');
  try { localStorage.setItem('yiqi-theme', t); } catch (e) {}
  initMermaid();
  renderNow();
}

function wireUI() {
  $('#toolbar').addEventListener('click', (e) => {
    const btn = e.target.closest('.tbtn');
    if (btn) act(btn.dataset.act);
  });
  $('#viewSeg').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn) setView(btn.dataset.view);
  });
  $('#btnSidebar').addEventListener('click', toggleSidebar);
  $('#btnTheme').addEventListener('click', () =>
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  $('#btnAbout').addEventListener('click', () => $('#aboutModal').classList.add('show'));
  $('#btnAboutClose').addEventListener('click', () => $('#aboutModal').classList.remove('show'));
  $('#aboutModal').addEventListener('click', (e) => { if (e.target.id === 'aboutModal') e.target.classList.remove('show'); });

  /* 预览区点击：复制按钮 / 链接 / 图片放大 */
  preview.addEventListener('click', async (e) => {
    const copyBtn = e.target.closest('.cb-copy');
    if (copyBtn) {
      const code = decodeURIComponent(copyBtn.dataset.code || '');
      try { await navigator.clipboard.writeText(code); } catch (err) {
        const ta = document.createElement('textarea');
        ta.value = code; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); ta.remove();
      }
      copyBtn.textContent = '已复制';
      setTimeout(() => { copyBtn.textContent = '复制'; }, 1200);
      return;
    }
    const img = e.target.closest('img');
    if (img && !img.closest('.mermaid')) {
      $('#lightboxImg').src = img.src;
      $('#lightbox').classList.add('show');
      return;
    }
    const a = e.target.closest('a');
    if (a) {
      const href = a.getAttribute('href') || '';
      if (href.startsWith('#')) {
        e.preventDefault();
        const target = preview.querySelector(CSS.escape(href));
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      } else if (/^(https?:|mailto:)/i.test(href)) {
        e.preventDefault();
        pyCall('open_external', href);
      } else {
        e.preventDefault();
        pyCall('open_local', href, currentDir);
      }
    }
  });
  $('#lightbox').addEventListener('click', () => $('#lightbox').classList.remove('show'));

  /* 拖拽打开文件 */
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    if (f.path) { await loadPath(f.path); return; }
    const text = await f.text();
    if (dirty && !confirm('当前文档尚未保存，确定放弃修改吗？')) return;
    setDoc(null, text, 'UTF-8');
    fileNameEl.textContent = f.name;
  });

  /* 浏览器环境打开文件回退 */
  $('#fileInput').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const text = await f.text();
    setDoc(null, text, 'UTF-8');
    fileNameEl.textContent = f.name;
  });

  /* 全局快捷键 */
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) { if (e.key === 'F1') { e.preventDefault(); $('#aboutModal').classList.add('show'); } return; }
    const k = e.key.toLowerCase();
    if (k === 's' && e.shiftKey) { e.preventDefault(); saveAs(); }
    else if (k === 's') { e.preventDefault(); save(); }
    else if (k === 'o') { e.preventDefault(); openFile(); }
    else if (k === 'n') { e.preventDefault(); newDoc(); }
    else if (k === 'e') { e.preventDefault(); exportHtml(); }
    else if (k === 'p') { e.preventDefault(); window.print(); }
  });

  /* 分割线拖动 */
  const divider = $('#divider');
  let dragging = false;
  divider.addEventListener('mousedown', () => { dragging = true; divider.classList.add('drag'); });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const main = document.querySelector('.main');
    const rect = main.getBoundingClientRect();
    let pct = ((e.clientX - rect.left) / rect.width) * 100;
    pct = Math.min(78, Math.max(22, pct));
    $('#editorPane').style.flex = `0 0 ${pct}%`;
    $('#previewPane').style.flex = '1 1 auto';
  });
  document.addEventListener('mouseup', () => { dragging = false; divider.classList.remove('drag'); cm.refresh(); });

  window.addEventListener('beforeunload', (e) => {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });
}

/* ============================================================
 * 启动
 * ============================================================ */
async function loadWelcome() {
  let content = null;
  if (hasPy()) content = await pyCall('get_welcome');
  if (!content) content = '# 欢迎使用 YiQi@MD-Editor\n\n> 请在桌面应用中体验完整功能。';
  setDoc(null, content, 'UTF-8');
}

function init() {
  initMd();
  initMermaid();
  initCM();
  bindSyncScroll();
  wireUI();

  try {
    const t = localStorage.getItem('yiqi-theme');
    if (t) { document.documentElement.dataset.theme = t; }
    const v = localStorage.getItem('yiqi-view');
    if (v) setView(v);
    const sb = localStorage.getItem('yiqi-sidebar');
    if (sb) document.body.dataset.sidebar = sb;
  } catch (e) {}
  $('#hljs-light').disabled = document.documentElement.dataset.theme !== 'light';
  $('#hljs-dark').disabled = document.documentElement.dataset.theme !== 'dark';

  if (hasPy()) {
    loadWelcome();
  } else {
    window.addEventListener('pywebviewready', () => { if (!currentPath && !dirty) loadWelcome(); }, { once: true });
    loadWelcome();
  }
}
init();
