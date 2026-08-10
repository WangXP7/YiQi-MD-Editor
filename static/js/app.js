/* ═══════════════════════════════════════════════════════════════════
   YiQi@MD-Editor-wb-DSv4-Pro v1.0 — JavaScript Application
   Uses EasyMDE editor + marked.js preview + pywebview bridge
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── Diagnostic log (production: off) ──────────────────────────────
  const DEBUG = false;       // ← FIX: production mode
  function dlog(...args) {
    if (!DEBUG) return;
    const msg = '[MD] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    console.log(msg);
  }

  // ── App constants ─────────────────────────────────────────────────
  const APP_NAME = 'YiQi@MD-Editor-wb-DSv4-Pro';
  const APP_VERSION = '1.0';

  // ── State ────────────────────────────────────────────────────────
  const state = {
    currentFile: null,
    currentPath: null,
    isDirty: false,
    theme: 'dark',
    viewMode: 'split',
    lastSavedContent: '',
    autoSaveTimer: null,
  };

  // ── pywebview bridge helper ──────────────────────────────────────
  const api = () => window.pywebview?.api;

  // ── DOM refs ─────────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    app: $('#app'),
    btnTheme: $('#btn-theme'),
    editorPane: $('#editor-pane'),
    previewPane: $('#preview-pane'),
    splitter: $('#splitter'),
    sbFile: $('#sb-file'),
    sbStats: $('#sb-stats'),
    sbCursor: $('#sb-cursor'),
    sbAuto: $('#sb-auto'),
    sbEncoding: $('#sb-encoding'),
    tbTitle: $('#tb-title'),
    toastContainer: $('#toast-container'),
    previewContainer: $('#preview-container'),
    hljsTheme: $('#hljs-theme'),
  };

  // ── Configure marked.js ──────────────────────────────────────────
  if (typeof marked !== 'undefined') {
    marked.setOptions({
      gfm: true,
      breaks: false,
      pedantic: false,
    });

    const renderer = new marked.Renderer();

    renderer.code = function ({ text, lang }) {
      const validLang = lang && typeof hljs !== 'undefined' && hljs.getLanguage(lang) ? lang : '';
      let highlighted;
      if (validLang) {
        try {
          highlighted = hljs.highlight(text, { language: validLang }).value;
        } catch (e) {
          highlighted = hljs.highlightAuto(text).value;
        }
      } else if (typeof hljs !== 'undefined') {
        highlighted = hljs.highlightAuto(text).value;
      } else {
        highlighted = escapeHtml(text);
      }
      const langLabel = validLang ? `<span class="code-lang">${validLang}</span>` : '';
      return `<div class="code-block-wrapper">${langLabel}<pre><code class="hljs language-${validLang}">${highlighted}</code></pre></div>`;
    };

    renderer.image = function (href, title, text) {
      const titleAttr = title ? ` title="${title}"` : '';
      return `<img src="${href}" alt="${text || ''}"${titleAttr} loading="lazy" onerror="this.style.display='none'" />`;
    };

    renderer.table = function (header, body) {
      return `<div class="table-wrapper"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
    };

    renderer.checkbox = function (checked) {
      return `<input type="checkbox" ${checked ? 'checked' : ''} disabled />`;
    };

    marked.use({ renderer });
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── EasyMDE editor ──────────────────────────────────────────────
  let easyMDE;
  function createEditor() {
    easyMDE = new EasyMDE({
      element: $('#editor'),
      autofocus: false,
      spellChecker: false,
      placeholder: 'Start writing your Markdown here...',
      autoDownloadFontAwesome: false,
      status: false,
      toolbar: false,
      previewRender: function (plainText) {
        try {
          return marked.parse(plainText);
        } catch (e) {
          return `<p class="error">Preview error: ${e.message}</p>`;
        }
      },
    });

    easyMDE.codemirror.on('change', () => {
      state.isDirty = true;
      scheduleAutoSave();
      updatePreview();
      updateStats();
    });

    easyMDE.codemirror.on('cursorActivity', updateCursorPos);
  }

  // ── Preview ──────────────────────────────────────────────────────
  function updatePreview() {
    if (!easyMDE) return;
    const md = easyMDE.value();
    try {
      dom.previewContainer.innerHTML = marked.parse(md);
    } catch (e) {
      dom.previewContainer.innerHTML = `<p class="error">Preview error: ${e.message}</p>`;
    }
  }

  // ── Stats ────────────────────────────────────────────────────────
  function updateStats() {
    if (!easyMDE) return;
    const text = easyMDE.value();
    const lines = text.split('\n').length;
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    dom.sbStats.textContent = `Words: ${words} \u00A0 Lines: ${lines} \u00A0 Chars: ${chars}`;
  }

  function updateCursorPos() {
    if (!easyMDE) return;
    const cm = easyMDE.codemirror;
    const pos = cm.getCursor();
    dom.sbCursor.textContent = `Ln ${pos.line + 1}, Col ${pos.ch + 1}`;
  }

  // ── Window title helper ──────────────────────────────────────────
  function updateWindowTitle(fileLabel) {
    const title = fileLabel
      ? `${APP_NAME} v${APP_VERSION} - ${fileLabel}`
      : `${APP_NAME} v${APP_VERSION}`;
    document.title = title;
    dom.tbTitle.textContent = APP_NAME;
  }

  // ── File operations ──────────────────────────────────────────────
  async function openFile() {
    if (!api()) { showToast('Bridge not available', 'error'); return; }
    try {
      const raw = await api().open_file();
      const result = JSON.parse(raw);
      if (result.cancelled) return;
      if (result.success) {
        applyLoadedFile(result);
        showToast(`Opened: ${result.name}`, 'success');
      } else {
        showToast('Error: ' + (result.error || 'unknown'), 'error');
      }
    } catch (e) {
      showToast('Open failed: ' + e.message, 'error');
    }
  }

  async function openFileByPath(path) {
    if (!api()) return;
    try {
      const result = JSON.parse(await api().load_file(path));
      if (result.success) {
        applyLoadedFile(result);
        showToast(`Opened: ${result.name}`, 'success');
      } else {
        showToast('Error: ' + result.error, 'error');
      }
    } catch (e) {
      showToast('Open failed: ' + e.message, 'error');
    }
  }

  function applyLoadedFile(data) {
    state.currentPath = data.path;
    state.currentFile = data.name;
    state.lastSavedContent = data.content;
    state.isDirty = false;

    easyMDE.value(data.content);

    dom.sbFile.textContent = data.name;
    dom.sbEncoding.textContent = data.encoding || 'UTF-8';
    updateWindowTitle(data.name);
    updateAutoIndicator();
    updatePreview();
    updateStats();
    easyMDE.codemirror.refresh();
  }

  async function saveFile(forceDialog = false) {
    if (!api()) { showToast('Bridge not available', 'error'); return; }
    const content = easyMDE.value();
    let path = state.currentPath;
    if (!path || forceDialog) {
      const defaultName = state.currentFile || 'untitled.md';
      path = await api().save_file_dialog(defaultName);
      if (!path) return;
    }
    try {
      const result = JSON.parse(await api().save_file(path, content));
      if (result.success) {
        state.currentPath = result.path;
        state.currentFile = result.name;
        state.lastSavedContent = content;
        state.isDirty = false;
        dom.sbFile.textContent = result.name;
        updateWindowTitle(result.name);
        updateAutoIndicator();
        showToast('Saved: ' + result.name, 'success');
      } else {
        showToast('Save error: ' + result.error, 'error');
      }
    } catch (e) {
      showToast('Save failed: ' + e.message, 'error');
    }
  }

  async function exportHTML() {
    if (!api()) return;
    const defaultName = (state.currentFile || 'untitled').replace(/\.md$/i, '') + '.html';
    const path = await api().export_html_dialog(defaultName);
    if (!path) return;

    const previewHTML = dom.previewContainer.innerHTML;
    const fullHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${state.currentFile || 'Document'}</title>
<style>
  body { max-width:900px; margin:40px auto; padding:20px 40px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; line-height:1.7; color:#333; background:#faf8f5; }
  pre { background:#282c34; color:#abb2bf; padding:16px; border-radius:8px; overflow-x:auto; }
  code { background:#f0ebe3; padding:2px 6px; border-radius:4px; font-size:0.9em; }
  pre code { background:none; padding:0; }
  table { border-collapse:collapse; width:100%; margin:16px 0; }
  th,td { border:1px solid #ddd; padding:8px 12px; text-align:left; }
  th { background:#f5f5f5; }
  blockquote { border-left:4px solid #d4851e; margin:16px 0; padding:4px 16px; color:#666; background:#faf8f5; }
  img { max-width:100%; border-radius:8px; }
  h1,h2 { border-bottom:1px solid #eee; padding-bottom:8px; }
  .code-lang { display:none; }
  input[type=checkbox] { width:16px; height:16px; }
</style>
</head>
<body>${previewHTML}</body>
</html>`;

    try {
      const result = JSON.parse(await api().export_html(path, fullHTML));
      if (result.success) {
        showToast('Exported: ' + path, 'success');
      } else {
        showToast('Export failed: ' + result.error, 'error');
      }
    } catch (e) {
      showToast('Export failed: ' + e.message, 'error');
    }
  }

  // ── Auto-save ────────────────────────────────────────────────────
  function scheduleAutoSave() {
    clearTimeout(state.autoSaveTimer);
    state.autoSaveTimer = setTimeout(() => {
      if (state.currentPath && state.isDirty) {
        saveFile(false);
      }
    }, 3000);
    updateAutoIndicator();
  }

  function updateAutoIndicator() {
    dom.sbAuto.textContent = state.isDirty ? '\u25CF' : '\u2714';
    dom.sbAuto.title = state.isDirty ? 'Unsaved changes' : 'Saved';
    dom.sbAuto.style.color = state.isDirty ? 'var(--accent)' : 'var(--success)';
  }

  // ── Toast ────────────────────────────────────────────────────────
  function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    dom.toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ── View modes ───────────────────────────────────────────────────
  function setViewMode(mode) {
    state.viewMode = mode;
    const main = $('#main');
    main.classList.remove('view-split', 'view-edit', 'view-preview');
    main.classList.add(`view-${mode}`);
    $$('#btn-view-split, #btn-view-edit, #btn-view-preview').forEach(b => b.classList.remove('active'));
    $(`#btn-view-${mode}`).classList.add('active');
    setTimeout(() => easyMDE?.codemirror?.refresh(), 50);
  }

  // ── Theme ────────────────────────────────────────────────────────
  function setTheme(theme) {
    state.theme = theme;
    dom.app.classList.remove('theme-dark', 'theme-light');
    dom.app.classList.add(`theme-${theme}`);
    dom.btnTheme.innerHTML = theme === 'dark' ? '&#9789;' : '&#9728;';
    dom.btnTheme.title = theme === 'dark' ? 'Switch to Light' : 'Switch to Dark';

    // FIX: use relative path for hljs theme switching
    const hljsPath = theme === 'dark'
      ? '../static/css/vendor/highlight-dark.css'
      : '../static/css/vendor/highlight-light.css';
    dom.hljsTheme.href = hljsPath;

    easyMDE?.codemirror?.refresh();
    localStorage.setItem('yiqi-md-editor-theme', theme);
  }

  // ── Formatting commands ──────────────────────────────────────────
  function execCmd(action) {
    const cm = easyMDE.codemirror;
    if (!cm) return;
    cm.focus();
    switch (action) {
      case 'bold': cm.replaceSelection(`**${cm.getSelection()}**`, 'around'); break;
      case 'italic': cm.replaceSelection(`*${cm.getSelection()}*`, 'around'); break;
      case 'strike': cm.replaceSelection(`~~${cm.getSelection()}~~`, 'around'); break;
      case 'code-inline': cm.replaceSelection(`\`${cm.getSelection()}\``, 'around'); break;
      case 'h1': cm.replaceSelection(`# ${cm.getSelection()}`, 'start'); break;
      case 'h2': cm.replaceSelection(`## ${cm.getSelection()}`, 'start'); break;
      case 'h3': cm.replaceSelection(`### ${cm.getSelection()}`, 'start'); break;
      case 'ul': cm.replaceSelection(`- ${cm.getSelection()}`, 'start'); break;
      case 'ol': cm.replaceSelection(`1. ${cm.getSelection()}`, 'start'); break;
      case 'task': cm.replaceSelection(`- [ ] ${cm.getSelection()}`, 'start'); break;
      case 'quote': cm.replaceSelection(`> ${cm.getSelection()}`, 'start'); break;
      case 'code-block': cm.replaceSelection(`\n\`\`\`\n${cm.getSelection() || 'code'}\n\`\`\`\n`, 'around'); break;
      case 'link': cm.replaceSelection(`[${cm.getSelection() || 'text'}](url)`, 'around'); break;
      case 'image': cm.replaceSelection(`![${cm.getSelection() || 'alt'}](url)`, 'around'); break;
      case 'hr': cm.replaceSelection(`\n---\n`); break;
    }
  }

  // ── New file ─────────────────────────────────────────────────────
  function newFile() {
    // FIX: pywebview doesn't support confirm() native dialog
    // Use a toast-based confirmation instead
    if (state.isDirty) {
      showToast('You have unsaved changes. Use Save or Save As first.', 'error');
      return;
    }
    easyMDE.value('# New Document\n\nStart writing here...\n');
    state.currentFile = null;
    state.currentPath = null;
    state.isDirty = false;
    state.lastSavedContent = easyMDE.value();
    dom.sbFile.textContent = 'Untitled';
    updateWindowTitle('Untitled');
    updateAutoIndicator();
    updatePreview();
    updateStats();
    easyMDE.codemirror.refresh();
  }

  // ── Button handlers ──────────────────────────────────────────────
  function setupButtons() {
    $('#btn-new').onclick = newFile;
    $('#btn-open').onclick = openFile;
    $('#btn-save').onclick = () => saveFile(false);
    $('#btn-save-as').onclick = () => saveFile(true);
    $('#btn-export-html').onclick = exportHTML;

    $('#btn-bold').onclick = () => execCmd('bold');
    $('#btn-italic').onclick = () => execCmd('italic');
    $('#btn-strike').onclick = () => execCmd('strike');
    $('#btn-code-inline').onclick = () => execCmd('code-inline');
    $('#btn-h1').onclick = () => execCmd('h1');
    $('#btn-h2').onclick = () => execCmd('h2');
    $('#btn-h3').onclick = () => execCmd('h3');
    $('#btn-ul').onclick = () => execCmd('ul');
    $('#btn-ol').onclick = () => execCmd('ol');
    $('#btn-task').onclick = () => execCmd('task');
    $('#btn-quote').onclick = () => execCmd('quote');
    $('#btn-code-block').onclick = () => execCmd('code-block');
    $('#btn-link').onclick = () => execCmd('link');
    $('#btn-image').onclick = () => execCmd('image');
    $('#btn-hr').onclick = () => execCmd('hr');

    $('#btn-view-split').onclick = () => setViewMode('split');
    $('#btn-view-edit').onclick = () => setViewMode('edit');
    $('#btn-view-preview').onclick = () => setViewMode('preview');

    $('#btn-theme').onclick = () => setTheme(state.theme === 'dark' ? 'light' : 'dark');
  }

  // ── Keyboard shortcuts ───────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey;
    if (mod && e.key === 's' && !e.shiftKey) { e.preventDefault(); saveFile(false); }
    if (mod && e.key === 's' && e.shiftKey) { e.preventDefault(); saveFile(true); }
    if (mod && e.key === 'o') { e.preventDefault(); openFile(); }
    if (mod && e.key === 'n') { e.preventDefault(); newFile(); }
  });

  // ── Splitter drag ────────────────────────────────────────────────
  function setupSplitter() {
    let dragging = false, startX = 0, startWidth = 0;
    dom.splitter.addEventListener('mousedown', (e) => {
      dragging = true;
      startX = e.clientX;
      startWidth = dom.editorPane.getBoundingClientRect().width;
      dom.splitter.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const mainWidth = $('#main').getBoundingClientRect().width;
      const newWidth = ((startWidth + dx) / mainWidth) * 100;
      const clamped = Math.max(20, Math.min(80, newWidth));
      dom.editorPane.style.flex = `0 0 ${clamped}%`;
      dom.previewPane.style.flex = `1 1 auto`;
      setTimeout(() => easyMDE?.codemirror?.refresh(), 50);
    });
    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      dom.splitter.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    });
  }

  // ── Init ─────────────────────────────────────────────────────────
  function init() {
    try {
      if (typeof EasyMDE === 'undefined') {
        showToast('EasyMDE failed to load — check vendor scripts', 'error');
        return;
      }
      if (typeof marked === 'undefined') {
        showToast('marked.js failed to load', 'error');
        return;
      }

      const savedTheme = localStorage.getItem('yiqi-md-editor-theme') || 'dark';
      createEditor();
      setupButtons();
      setupSplitter();
      setTheme(savedTheme);

      easyMDE.value(`# Welcome to YiQi@MD-Editor-wb-DSv4-Pro v1.0

A beautiful, **standalone native Markdown editor** for Windows.

## Features

- **Live Preview** with split pane
- **Full GFM** support: tables, task lists, code blocks, strikethrough
- **Native window** — no browser popup, powered by Edge WebView2
- **Syntax Highlighting** in both editor and preview
- **Auto-save** after 3s of inactivity
- **Dark & Light** themes
- **Keyboard shortcuts** (Ctrl+S, Ctrl+O, Ctrl+N, etc.)
- **Export** to standalone HTML

## Try it out

\`\`\`python
def hello():
    print("Hello, YiQi Markdown Editor!")
\`\`\`

| Feature | Status |
|---------|--------|
| Tables | ✅ |
| Task Lists | ✅ |
| Code Blocks | ✅ |
| Images | ✅ |
| Export HTML | ✅ |

> "Writing is the painting of the voice." — Voltaire

### Task List

- [x] Create beautiful native editor
- [x] Add live preview with GFM
- [ ] Your next great document 🚀
`);

      updatePreview();
      updateStats();
      easyMDE.codemirror.refresh();

      // Wait for pywebview API
      waitForPywebview();
    } catch (err) {
      showToast('Init error: ' + err.message, 'error');
    }
  }

  // ── Wait for pywebview bridge ────────────────────────────────────
  function waitForPywebview() {
    if (window.pywebview && window.pywebview.api) return;
    // Poll until bridge is ready (pywebview injects asynchronously)
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (window.pywebview && window.pywebview.api) {
        clearInterval(interval);
        return;
      }
      if (attempts > 50) clearInterval(interval); // 5s timeout
    }, 100);
  }

  // ── Global error handler ─────────────────────────────────────────
  window.addEventListener('error', (e) => {
    if (DEBUG) console.error('Global error:', e.message, e.filename, e.lineno);
  });

  // ── Start ────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();