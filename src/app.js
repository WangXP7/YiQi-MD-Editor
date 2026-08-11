import './styles.css';
import { basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { openSearchPanel } from '@codemirror/search';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import attrs from 'markdown-it-attrs';
import container from 'markdown-it-container';
import deflist from 'markdown-it-deflist';
import { full as emoji } from 'markdown-it-emoji';
import footnote from 'markdown-it-footnote';
import ins from 'markdown-it-ins';
import mark from 'markdown-it-mark';
import sub from 'markdown-it-sub';
import sup from 'markdown-it-sup';
import taskLists from 'markdown-it-task-lists';
import texmath from 'markdown-it-texmath';
import katex from 'katex';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';
import mermaid from 'mermaid';
import { createIcons, icons } from 'lucide';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const api = window.yiqiMd || {
  openFile: async () => ({ canceled: true }),
  readFile: async () => ({ canceled: true }),
  saveFile: async () => ({ canceled: true }),
  saveFileAs: async () => ({ canceled: true }),
  confirmUnsaved: async () => (window.confirm('当前文档尚未保存，是否放弃修改？') ? 1 : 2),
  exportHtml: async () => ({ canceled: true }),
  exportPdf: async () => ({ canceled: true }),
  showItem: async () => {},
  openExternal: (url) => window.open(url, '_blank', 'noopener'),
  resolveAsset: async ({ source }) => source,
  getAppInfo: async () => ({ version: '1.1.3' }),
  getPathForFile: (file) => file.path,
  copyText: async (text) => {
    const value = String(text);
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
    const input = document.createElement('textarea');
    input.value = value;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    if (!copied) throw new Error('当前环境不允许访问剪贴板');
  },
  minimize: () => {},
  toggleMaximize: () => {},
  close: () => window.close(),
  onOpenFile: () => {},
  onRequestClose: () => {},
  onMaximized: () => {}
};

const starterDocument = `# 欢迎使用 YiQi@MD-Editor ✨

> 一个专注、优雅、完全离线的 Markdown 创作空间。

YiQi@MD-Editor-GPT5.6SolxHigh 支持 **CommonMark**、**GitHub Flavored Markdown**，并提供数学公式、流程图、脚注和代码高亮等扩展能力。你可以直接编辑这份文档，或按 \`Ctrl + O\` 打开已有文件。

## 让创作更流畅

- [x] 实时双栏预览与大纲导航
- [x] 表格、任务清单、脚注与定义列表
- [x] LaTeX 数学公式与 Mermaid 图表
- [ ] 写下你的下一个好点子

::: tip
所有编辑和渲染都在本机完成。打开、保存、导出，数据始终由你掌控。
:::

## 丰富格式

| 能力 | 语法 | 状态 |
| :--- | :--- | :---: |
| 代码高亮 | fenced code block | ✓ |
| 数学公式 | KaTeX / LaTeX | ✓ |
| 流程图 | Mermaid | ✓ |

行内公式示例：$E = mc^2$，块级公式：

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

\`\`\`javascript
const idea = 'Markdown, but beautiful.';
console.log(idea);
\`\`\`

## 图表支持

\`\`\`mermaid
flowchart LR
    A[灵感] --> B{开始创作}
    B --> C[Markdown]
    C --> D[实时预览]
    D --> E[导出分享]
\`\`\`

## 继续探索

链接、图片、~~删除线~~、==高亮==、上标 X^2^、下标 H~2~O，以及脚注都已准备好。[^note]

[^note]: 这是一个标准的 Markdown 脚注。
`;

let documentSequence = 0;
function createDocument({ filePath = null, name = '未命名.md', content = '', savedContent = content, dirty = false } = {}) {
  documentSequence += 1;
  return {
    id: globalThis.crypto?.randomUUID?.() || `document-${Date.now()}-${documentSequence}`,
    filePath,
    name,
    content,
    savedContent,
    dirty,
    cursor: 0,
    editorScrollTop: 0,
    previewScrollTop: 0
  };
}

const initialDocument = createDocument({ content: starterDocument, savedContent: starterDocument });
const state = {
  documents: [initialDocument],
  activeDocumentId: initialDocument.id,
  renderTimer: null,
  renderRevision: 0,
  suppressChanges: false,
  viewMode: localStorage.getItem('yiqi-md:view') || 'split',
  theme: localStorage.getItem('yiqi-md:theme') || 'dark',
  zoom: Number(localStorage.getItem('yiqi-md:zoom') || 100),
  recent: loadRecent(),
  dragDepth: 0,
  isResizing: false,
  outlineJumping: false,
  get activeDocument() {
    return this.documents.find((documentItem) => documentItem.id === this.activeDocumentId) || this.documents[0];
  },
  get filePath() { return this.activeDocument?.filePath || null; },
  set filePath(value) { if (this.activeDocument) this.activeDocument.filePath = value; },
  get name() { return this.activeDocument?.name || '未命名.md'; },
  set name(value) { if (this.activeDocument) this.activeDocument.name = value; },
  get dirty() { return Boolean(this.activeDocument?.dirty); },
  set dirty(value) { if (this.activeDocument) this.activeDocument.dirty = Boolean(value); },
  get savedContent() { return this.activeDocument?.savedContent || ''; },
  set savedContent(value) { if (this.activeDocument) this.activeDocument.savedContent = value; }
};

document.documentElement.dataset.theme = state.theme;
document.documentElement.style.setProperty('--preview-zoom', String(state.zoom / 100));

const md = createMarkdownEngine();
configureMermaid();

const editor = new EditorView({
  state: EditorState.create({
    doc: starterDocument,
    extensions: [
      basicSetup,
      markdown(),
      oneDark,
      keymap.of([indentWithTab]),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        updateCursorStatus(update.state);
        if (!update.docChanged || state.suppressChanges) return;
        const content = update.state.doc.toString();
        state.activeDocument.content = content;
        setDirty(content !== state.savedContent);
        updateStats(content);
        scheduleRender(content);
      })
    ]
  }),
  parent: $('#editor')
});

createIcons({ icons });
bindInterface();
applyViewMode(state.viewMode);
renderRecent();
updateStats(starterDocument);
renderMarkdown(starterDocument);
updateDocumentLabels();

api.getAppInfo().then((info) => {
  if (info?.version) $('#version-label').textContent = `YiQi@MD-Editor-GPT5.6SolxHigh-v${info.version} · Windows x64`;
});

api.onOpenFile((filePath) => openPath(filePath));
api.onRequestClose(() => requestClose());

function createMarkdownEngine() {
  const engine = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: false,
    highlight(code, language) {
      if (language && hljs.getLanguage(language)) {
        try {
          return `<pre class="hljs"><code>${hljs.highlight(code, { language, ignoreIllegals: true }).value}</code></pre>`;
        } catch {}
      }
      return `<pre class="hljs"><code>${engine.utils.escapeHtml(code)}</code></pre>`;
    }
  });

  engine.use(anchor, {
    slugify: (value) => slugify(value),
    permalink: anchor.permalink.ariaHidden({
      placement: 'after',
      class: 'heading-anchor',
      symbol: '#'
    })
  });
  engine.use(attrs, { allowedAttributes: ['id', 'class', /^data-.*$/] });
  engine.use(emoji);
  engine.use(footnote);
  engine.use(taskLists, { enabled: false, label: true, labelAfter: true });
  engine.use(deflist);
  engine.use(mark);
  engine.use(ins);
  engine.use(sub);
  engine.use(sup);
  engine.use(texmath, { engine: katex, delimiters: 'dollars', katexOptions: { throwOnError: false, strict: false } });

  for (const type of ['tip', 'info', 'warning', 'danger']) {
    engine.use(container, type, {
      render(tokens, index) {
        return tokens[index].nesting === 1
          ? `<div class="admonition ${type}" data-label="${type}">\n`
          : '</div>\n';
      }
    });
  }
  engine.use(container, 'details', {
    render(tokens, index) {
      if (tokens[index].nesting === 1) {
        const summary = engine.utils.escapeHtml(tokens[index].info.trim().replace(/^details\s*/, '') || '展开详情');
        return `<details><summary>${summary}</summary>\n`;
      }
      return '</details>\n';
    }
  });

  const originalFence = engine.renderer.rules.fence;
  engine.renderer.rules.fence = (tokens, index, options, env, self) => {
    const language = tokens[index].info.trim().split(/\s+/)[0].toLowerCase();
    if (language === 'mermaid') {
      return `<div class="mermaid">${engine.utils.escapeHtml(tokens[index].content)}</div>`;
    }
    return originalFence(tokens, index, options, env, self);
  };

  const originalLinkOpen = engine.renderer.rules.link_open || ((tokens, index, options, env, self) => self.renderToken(tokens, index, options));
  engine.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const href = tokens[index].attrGet('href') || '';
    if (/^https?:\/\//i.test(href)) {
      tokens[index].attrSet('target', '_blank');
      tokens[index].attrSet('rel', 'noopener noreferrer');
    }
    return originalLinkOpen(tokens, index, options, env, self);
  };

  engine.core.ruler.push('source_line_attrs', (parseState) => {
    parseState.tokens.forEach((token) => {
      if (token.type === 'heading_open' && token.map) {
        token.attrSet('data-source-line', String(token.map[0]));
      }
    });
  });

  return engine;
}

function configureMermaid() {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: state.theme === 'dark' ? 'dark' : 'neutral',
    fontFamily: 'Segoe UI Variable, Segoe UI, sans-serif',
    flowchart: { curve: 'basis', htmlLabels: true },
    themeVariables: state.theme === 'dark'
      ? { primaryColor: '#6f53db', primaryTextColor: '#f4f1ff', primaryBorderColor: '#a38cff', lineColor: '#7e8aa8', secondaryColor: '#123745', tertiaryColor: '#171b2c', background: '#0e1220' }
      : { primaryColor: '#e6e0ff', primaryTextColor: '#28243a', primaryBorderColor: '#765be4', lineColor: '#7b8194', secondaryColor: '#dff7fa', tertiaryColor: '#f3f4f9', background: '#ffffff' }
  });
}

function bindInterface() {
  $('#window-minimize').addEventListener('click', () => api.minimize());
  $('#window-maximize').addEventListener('click', () => api.toggleMaximize());
  $('#window-close').addEventListener('click', requestClose);
  api.onMaximized((maximized) => {
    $('#window-maximize').innerHTML = maximized ? '<i data-lucide="copy"></i>' : '<i data-lucide="square"></i>';
    createIcons({ icons });
  });

  $('#new-file').addEventListener('click', newDocument);
  $('#new-tab-button').addEventListener('click', newDocument);
  $('#open-file').addEventListener('click', openDocument);
  $('#toggle-sidebar').addEventListener('click', () => $('#sidebar').classList.toggle('collapsed'));
  $('#theme-toggle').addEventListener('click', toggleTheme);
  $('#search-button').addEventListener('click', () => { editor.focus(); openSearchPanel(editor); });
  $('#clear-recent').addEventListener('click', clearRecent);
  $('#about-button').addEventListener('click', () => toggleModal(true));
  $$('[data-close-modal]').forEach((button) => button.addEventListener('click', () => toggleModal(false)));
  $('#about-modal').addEventListener('click', (event) => { if (event.target === $('#about-modal')) toggleModal(false); });

  $$('.side-tab').forEach((tab) => tab.addEventListener('click', () => selectSideTab(tab.dataset.sideTab)));
  $$('.view-switch button').forEach((button) => button.addEventListener('click', () => applyViewMode(button.dataset.view)));
  $$('#format-toolbar [data-format]').forEach((button) => button.addEventListener('click', () => applyFormat(button.dataset.format)));

  $('#export-button').addEventListener('click', (event) => {
    event.stopPropagation();
    $('#export-menu').classList.toggle('open');
  });
  $$('[data-export]').forEach((button) => button.addEventListener('click', () => exportDocument(button.dataset.export)));
  document.addEventListener('click', () => $('#export-menu').classList.remove('open'));

  $('#zoom-in').addEventListener('click', () => changeZoom(10));
  $('#zoom-out').addEventListener('click', () => changeZoom(-10));

  document.addEventListener('keydown', handleKeyboard);
  bindDragAndDrop();
  bindPaneResize();
  bindPreviewInteractions();
  bindScrollSync();
}

function handleKeyboard(event) {
  const ctrl = event.ctrlKey || event.metaKey;
  if (ctrl && event.key.toLowerCase() === 's') {
    event.preventDefault();
    saveDocument(event.shiftKey);
  } else if (ctrl && event.key.toLowerCase() === 'o') {
    event.preventDefault();
    openDocument();
  } else if (ctrl && event.key.toLowerCase() === 'n') {
    event.preventDefault();
    newDocument();
  } else if (ctrl && event.key.toLowerCase() === 'w') {
    event.preventDefault();
    closeDocument(state.activeDocumentId);
  } else if (ctrl && event.key.toLowerCase() === 'b') {
    event.preventDefault();
    applyFormat('bold');
  } else if (ctrl && event.key.toLowerCase() === 'i') {
    event.preventDefault();
    applyFormat('italic');
  } else if (ctrl && event.shiftKey && event.key.toLowerCase() === 'p') {
    event.preventDefault();
    applyViewMode('preview');
  } else if (event.key === 'Escape') {
    toggleModal(false);
    $('#export-menu').classList.remove('open');
  }
}

async function maybeContinue() {
  if (!state.dirty) return true;
  const choice = await api.confirmUnsaved(state.name);
  if (choice === 2) return false;
  if (choice === 0) return await saveDocument(false);
  return true;
}

async function newDocument() {
  const documentItem = createDocument();
  state.documents.push(documentItem);
  activateDocument(documentItem.id);
  editor.focus();
  toast('已新建文档标签');
}

async function openDocument() {
  try {
    const result = await api.openFile();
    if (result?.canceled) return;
    const files = Array.isArray(result.files) ? result.files : [result];
    files.forEach((file) => loadDocument(file));
  } catch (error) {
    toast(`打开失败：${error.message}`, 'error');
  }
}

async function openPath(filePath) {
  if (!filePath) return;
  try {
    const result = await api.readFile(filePath);
    if (result?.error) throw new Error(result.error);
    if (!result?.canceled) loadDocument(result);
  } catch (error) {
    toast(`无法打开文件：${error.message}`, 'error');
  }
}

function loadDocument({ filePath, name, content }) {
  const existingDocument = filePath
    ? state.documents.find((documentItem) => documentItem.filePath?.toLowerCase() === filePath.toLowerCase())
    : null;
  if (existingDocument) {
    activateDocument(existingDocument.id);
    toast(`${existingDocument.name} 已在标签中打开`);
    return;
  }

  const currentDocument = state.activeDocument;
  const canReuseCurrent = state.documents.length === 1
    && !currentDocument.filePath
    && !currentDocument.dirty
    && (currentDocument.content === starterDocument || currentDocument.content === '');
  const documentItem = canReuseCurrent
    ? currentDocument
    : createDocument();

  if (!canReuseCurrent) state.documents.push(documentItem);
  documentItem.filePath = filePath || null;
  documentItem.name = name || (filePath ? filePath.split(/[\\/]/).pop() : '未命名.md');
  documentItem.content = content;
  documentItem.savedContent = content;
  documentItem.dirty = false;
  documentItem.cursor = 0;
  documentItem.editorScrollTop = 0;
  documentItem.previewScrollTop = 0;
  activateDocument(documentItem.id, { force: true, skipCapture: canReuseCurrent });
  if (documentItem.filePath) addRecent(documentItem.filePath, documentItem.name);
  toast(`已打开 ${documentItem.name}`);
}

function captureActiveDocumentState() {
  const documentItem = state.activeDocument;
  if (!documentItem || !editor) return;
  documentItem.content = editor.state.doc.toString();
  documentItem.cursor = editor.state.selection.main.head;
  documentItem.editorScrollTop = $('.cm-scroller', editor.dom)?.scrollTop || 0;
  documentItem.previewScrollTop = $('#preview-scroll')?.scrollTop || 0;
}

function activateDocument(documentId, { force = false, skipCapture = false } = {}) {
  const documentItem = state.documents.find((candidate) => candidate.id === documentId);
  if (!documentItem) return;
  if (!force && state.activeDocumentId === documentId) return;
  if (!skipCapture && state.activeDocumentId !== documentId) captureActiveDocumentState();

  state.activeDocumentId = documentId;
  state.suppressChanges = true;
  const cursor = Math.min(documentItem.cursor || 0, documentItem.content.length);
  editor.dispatch({
    changes: { from: 0, to: editor.state.doc.length, insert: documentItem.content },
    selection: { anchor: cursor }
  });
  state.suppressChanges = false;
  updateDocumentLabels();
  updateStats(documentItem.content);
  window.clearTimeout(state.renderTimer);
  state.renderTimer = null;
  renderMarkdown(documentItem.content, documentItem.filePath);
  $('#save-status').textContent = documentItem.dirty ? '尚未保存' : '已就绪';

  requestAnimationFrame(() => {
    const cmScroll = $('.cm-scroller', editor.dom);
    if (cmScroll) cmScroll.scrollTop = documentItem.editorScrollTop || 0;
    $('#preview-scroll').scrollTop = documentItem.previewScrollTop || 0;
    editor.requestMeasure();
    $(`.document-tab[data-document-id="${documentId}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
}

async function saveDocument(forceSaveAs = false) {
  const content = editor.state.doc.toString();
  state.activeDocument.content = content;
  try {
    let result;
    if (state.filePath && !forceSaveAs) {
      result = await api.saveFile({ filePath: state.filePath, content });
    } else {
      result = await api.saveFileAs({ defaultName: state.name, content });
    }
    if (!result || result.canceled) return false;
    state.filePath = result.filePath;
    state.name = result.name || result.filePath.split(/[\\/]/).pop();
    state.savedContent = content;
    setDirty(false);
    updateDocumentLabels();
    addRecent(state.filePath, state.name);
    $('#save-status').textContent = '已保存';
    toast(`已保存 ${state.name}`);
    window.setTimeout(() => { if (!state.dirty) $('#save-status').textContent = '已就绪'; }, 1800);
    return true;
  } catch (error) {
    toast(`保存失败：${error.message}`, 'error');
    return false;
  }
}

async function requestClose() {
  captureActiveDocumentState();
  for (const documentItem of [...state.documents]) {
    if (!documentItem.dirty) continue;
    activateDocument(documentItem.id);
    if (!(await maybeContinue())) return;
  }
  api.close();
}

async function closeDocument(documentId) {
  const documentIndex = state.documents.findIndex((documentItem) => documentItem.id === documentId);
  if (documentIndex < 0) return;
  const documentItem = state.documents[documentIndex];

  if (documentItem.dirty) {
    activateDocument(documentId);
    if (!(await maybeContinue())) return;
  }

  const wasActive = state.activeDocumentId === documentId;
  state.documents.splice(documentIndex, 1);
  if (!state.documents.length) state.documents.push(createDocument());

  if (wasActive) {
    const nextDocument = state.documents[Math.min(documentIndex, state.documents.length - 1)];
    activateDocument(nextDocument.id, { force: true, skipCapture: true });
  } else {
    renderDocumentTabs();
  }
}

function setDirty(value) {
  state.dirty = value;
  $('#save-status').textContent = value ? '尚未保存' : '已就绪';
  updateDocumentLabels();
}

function updateDocumentLabels() {
  renderDocumentTabs();
  $('#window-title').textContent = `${state.dirty ? '● ' : ''}${state.name}`;
  document.title = `${state.dirty ? '● ' : ''}${state.name} — YiQi@MD-Editor-GPT5.6SolxHigh-v1.1.3`;
}

function renderDocumentTabs() {
  const tabs = $('#document-tabs');
  if (!tabs) return;
  tabs.innerHTML = '';

  state.documents.forEach((documentItem) => {
    const tab = document.createElement('div');
    tab.className = `document-tab${documentItem.id === state.activeDocumentId ? ' active' : ''}`;
    tab.dataset.documentId = documentItem.id;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(documentItem.id === state.activeDocumentId));
    tab.title = documentItem.filePath || documentItem.name;
    tab.innerHTML = `
      <i data-lucide="file-text"></i>
      <span class="document-tab-name">${escapeHtml(documentItem.name)}</span>
      ${documentItem.dirty ? '<span class="dirty-dot" title="未保存"></span>' : ''}
      <button class="tab-close" title="关闭标签 (Ctrl+W)" aria-label="关闭 ${escapeHtml(documentItem.name)}"><i data-lucide="x"></i></button>`;
    tab.addEventListener('click', () => activateDocument(documentItem.id));
    $('.tab-close', tab).addEventListener('click', (event) => {
      event.stopPropagation();
      closeDocument(documentItem.id);
    });
    tabs.appendChild(tab);
  });
  createIcons({ icons });
}

function scheduleRender(content) {
  window.clearTimeout(state.renderTimer);
  const documentId = state.activeDocumentId;
  state.renderTimer = window.setTimeout(() => {
    if (state.activeDocumentId === documentId) renderMarkdown(content, state.filePath);
  }, 160);
}

async function renderMarkdown(content, documentPath = state.filePath) {
  const revision = ++state.renderRevision;
  const preview = $('#preview');
  let rendered;
  try {
    rendered = md.render(content);
  } catch (error) {
    rendered = `<div class="admonition danger" data-label="渲染错误"><p>${escapeHtml(error.message)}</p></div>`;
  }
  preview.innerHTML = DOMPurify.sanitize(rendered, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true, mathMl: true },
    ADD_ATTR: ['target', 'rel', 'data-label', 'data-source-line', 'checked', 'disabled', 'aria-hidden']
  });

  await resolveLocalImages(documentPath);
  if (revision !== state.renderRevision) return;
  buildOutline();
  try {
    await mermaid.run({ nodes: $$('.mermaid', preview), suppressErrors: true });
  } catch (error) {
    console.warn('Mermaid render skipped:', error.message);
  }
  if (revision !== state.renderRevision) return;
  decorateCopyButtons();
}

function decorateCopyButtons() {
  const preview = $('#preview');
  const blocks = $$(':scope > p, :scope > pre, :scope > blockquote, :scope > table, :scope > ul, :scope > ol, :scope > dl, :scope > details, :scope > .admonition', preview);

  blocks.forEach((block) => {
    const copyValue = getBlockCopyText(block);
    if (!copyValue.trim()) return;

    block.classList.add('copyable-block');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'block-copy-button';
    button.setAttribute('aria-label', '复制此内容块');
    button.title = '复制此内容块';
    button.innerHTML = '<i data-lucide="copy"></i><span>复制</span>';
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      try {
        await api.copyText(copyValue);
        button.classList.add('copied');
        button.innerHTML = '<i data-lucide="check"></i><span>已复制</span>';
        createIcons({ icons });
        window.setTimeout(() => {
          button.classList.remove('copied');
          button.innerHTML = '<i data-lucide="copy"></i><span>复制</span>';
          createIcons({ icons });
        }, 1500);
      } catch (error) {
        toast(`复制失败：${error.message}`, 'error');
      }
    });
    block.appendChild(button);
  });
  createIcons({ icons });
}

function getBlockCopyText(block) {
  if (block.tagName === 'PRE') {
    return block.querySelector('code')?.textContent || block.textContent;
  }
  if (block.tagName === 'TABLE') {
    return $$('tr', block)
      .map((row) => $$('th, td', row).map((cell) => cell.textContent.trim()).join('\t'))
      .join('\n');
  }
  return block.textContent.trim();
}

async function resolveLocalImages(documentPath) {
  if (!documentPath) return;
  const images = $$('img', $('#preview'));
  await Promise.all(images.map(async (image) => {
    const source = image.getAttribute('src');
    if (!source || /^(https?:|data:|file:|#)/i.test(source)) return;
    image.src = await api.resolveAsset({ documentPath, source });
  }));
}

function buildOutline() {
  const headings = $$('h1, h2, h3, h4, h5, h6', $('#preview'));
  const list = $('#outline-list');
  $('#heading-count').textContent = `${headings.length} 项`;
  if (!headings.length) {
    list.innerHTML = '<div class="side-empty"><i data-lucide="list-tree"></i><p>输入标题后，这里将生成大纲</p></div>';
    createIcons({ icons });
    return;
  }
  list.innerHTML = '';
  headings.forEach((heading) => {
    const button = document.createElement('button');
    button.className = 'outline-item';
    button.dataset.level = heading.tagName.slice(1);
    button.innerHTML = `<span>${escapeHtml(heading.textContent.replace(/#$/, '').trim())}</span>`;
    button.addEventListener('click', () => {
      if (state.viewMode !== 'split') applyViewMode('split');

      state.outlineJumping = true;
      const sourceLine = Number.parseInt(heading.dataset.sourceLine || '', 10);
      if (Number.isFinite(sourceLine)) {
        const lineNumber = Math.max(1, Math.min(editor.state.doc.lines, sourceLine + 1));
        const position = editor.state.doc.line(lineNumber).from;
        editor.dispatch({
          selection: { anchor: position },
          effects: EditorView.scrollIntoView(position, { y: 'start', yMargin: 48 })
        });
      }

      heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => { state.outlineJumping = false; }, 500);
    });
    list.appendChild(button);
  });
}

function updateStats(content) {
  const trimmed = content.trim();
  const hanCount = (trimmed.match(/[\u3400-\u9fff]/g) || []).length;
  const latinCount = (trimmed.replace(/[\u3400-\u9fff]/g, ' ').match(/[\p{L}\p{N}_'-]+/gu) || []).length;
  const words = hanCount + latinCount;
  $('#word-count').textContent = `${words.toLocaleString()} 字`;
  $('#char-count').textContent = `${content.length.toLocaleString()} 字符`;
  $('#read-time').textContent = `阅读约 ${Math.max(1, Math.ceil(words / 350))} 分钟`;
}

function updateCursorStatus(editorState) {
  const position = editorState.selection.main.head;
  const line = editorState.doc.lineAt(position);
  $('#cursor-position').textContent = `第 ${line.number} 行，第 ${position - line.from + 1} 列`;
}

function applyViewMode(mode) {
  state.viewMode = ['editor', 'split', 'preview'].includes(mode) ? mode : 'split';
  localStorage.setItem('yiqi-md:view', state.viewMode);
  const workbench = $('#workbench');
  workbench.classList.remove('editor-view', 'split-view', 'preview-view');
  workbench.classList.add(`${state.viewMode}-view`);
  $$('.view-switch button').forEach((button) => button.classList.toggle('active', button.dataset.view === state.viewMode));
  requestAnimationFrame(() => editor.requestMeasure());
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = state.theme;
  localStorage.setItem('yiqi-md:theme', state.theme);
  $('#theme-toggle').innerHTML = state.theme === 'dark' ? '<i data-lucide="moon-star"></i>' : '<i data-lucide="sun"></i>';
  createIcons({ icons });
  configureMermaid();
  renderMarkdown(editor.state.doc.toString());
}

function changeZoom(delta) {
  state.zoom = Math.max(70, Math.min(160, state.zoom + delta));
  localStorage.setItem('yiqi-md:zoom', state.zoom);
  document.documentElement.style.setProperty('--preview-zoom', String(state.zoom / 100));
  $('#zoom-value').textContent = `${state.zoom}%`;
}

function selectSideTab(name) {
  $$('.side-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.sideTab === name));
  $$('.side-panel').forEach((panel) => panel.classList.remove('active'));
  $(`#${name}-panel`).classList.add('active');
}

function loadRecent() {
  try { return JSON.parse(localStorage.getItem('yiqi-md:recent') || '[]'); }
  catch { return []; }
}

function addRecent(filePath, name) {
  state.recent = [
    { filePath, name, openedAt: Date.now() },
    ...state.recent.filter((item) => item.filePath !== filePath)
  ].slice(0, 12);
  localStorage.setItem('yiqi-md:recent', JSON.stringify(state.recent));
  renderRecent();
}

function clearRecent() {
  state.recent = [];
  localStorage.removeItem('yiqi-md:recent');
  renderRecent();
}

function renderRecent() {
  const list = $('#recent-list');
  if (!state.recent.length) {
    list.innerHTML = '<div class="side-empty"><i data-lucide="history"></i><p>打开过的文档将出现在这里</p></div>';
    createIcons({ icons });
    return;
  }
  list.innerHTML = '';
  state.recent.forEach((item) => {
    const button = document.createElement('button');
    button.className = 'recent-item';
    button.innerHTML = `<i data-lucide="file-text"></i><span><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.filePath)}</small></span>`;
    button.addEventListener('click', () => openPath(item.filePath));
    list.appendChild(button);
  });
  createIcons({ icons });
}

function applyFormat(type) {
  const selection = editor.state.selection.main;
  const selected = editor.state.sliceDoc(selection.from, selection.to);
  const formats = {
    bold: ['**', '**', '粗体文本'],
    italic: ['*', '*', '斜体文本'],
    strike: ['~~', '~~', '删除文本'],
    mark: ['==', '==', '高亮文本'],
    code: ['`', '`', 'code'],
    link: ['[', '](https://example.com)', '链接文字'],
    image: ['![', '](image.png)', '图片描述']
  };
  if (formats[type]) {
    const [before, after, placeholder] = formats[type];
    replaceSelection(`${before}${selected || placeholder}${after}`, before.length, (selected || placeholder).length);
    return;
  }

  if (type === 'codeblock') {
    replaceSelection(`\`\`\`\n${selected || '在这里输入代码'}\n\`\`\``, 4, (selected || '在这里输入代码').length);
  } else if (type === 'table') {
    replaceSelection('| 列 1 | 列 2 | 列 3 |\n| :--- | :--- | :--- |\n| 内容 | 内容 | 内容 |', 2, 3);
  } else if (type === 'rule') {
    replaceSelection(`${selection.from > 0 ? '\n' : ''}---\n`, 5, 0);
  } else if (type === 'heading') {
    prefixSelectedLines('## ');
  } else if (type === 'quote') {
    prefixSelectedLines('> ');
  } else if (type === 'bullet') {
    prefixSelectedLines('- ');
  } else if (type === 'number') {
    prefixSelectedLines('1. ');
  } else if (type === 'task') {
    prefixSelectedLines('- [ ] ');
  }
  editor.focus();
}

function replaceSelection(insert, selectionOffset = 0, selectionLength = 0) {
  const range = editor.state.selection.main;
  editor.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: { anchor: range.from + selectionOffset, head: range.from + selectionOffset + selectionLength },
    scrollIntoView: true
  });
  editor.focus();
}

function prefixSelectedLines(prefix) {
  const range = editor.state.selection.main;
  const startLine = editor.state.doc.lineAt(range.from);
  const endLine = editor.state.doc.lineAt(range.to);
  const text = editor.state.sliceDoc(startLine.from, endLine.to);
  const insert = text.split('\n').map((line) => `${prefix}${line}`).join('\n');
  editor.dispatch({
    changes: { from: startLine.from, to: endLine.to, insert },
    selection: { anchor: startLine.from + prefix.length, head: startLine.from + insert.length },
    scrollIntoView: true
  });
}

function bindDragAndDrop() {
  document.addEventListener('dragenter', (event) => {
    event.preventDefault();
    state.dragDepth += 1;
    $('#drop-overlay').classList.add('visible');
  });
  document.addEventListener('dragover', (event) => event.preventDefault());
  document.addEventListener('dragleave', (event) => {
    event.preventDefault();
    state.dragDepth = Math.max(0, state.dragDepth - 1);
    if (!state.dragDepth) $('#drop-overlay').classList.remove('visible');
  });
  document.addEventListener('drop', async (event) => {
    event.preventDefault();
    state.dragDepth = 0;
    $('#drop-overlay').classList.remove('visible');
    const files = [...(event.dataTransfer?.files || [])];
    if (!files.length) return;
    const markdownFiles = files.filter((file) => /\.(md|markdown|mdown|mkd|txt)$/i.test(file.name));
    if (!markdownFiles.length) {
      toast('请选择 Markdown 或文本文件', 'error');
      return;
    }
    for (const file of markdownFiles) {
      const filePath = api.getPathForFile(file);
      if (filePath) await openPath(filePath);
    }
  });
}

function bindPaneResize() {
  const resizer = $('#pane-resizer');
  const workbench = $('#workbench');
  const editorPane = $('#editor-pane');
  const previewPane = $('#preview-pane');

  resizer.addEventListener('pointerdown', (event) => {
    if (state.viewMode !== 'split') return;
    state.isResizing = true;
    resizer.classList.add('dragging');
    resizer.setPointerCapture(event.pointerId);
  });
  resizer.addEventListener('pointermove', (event) => {
    if (!state.isResizing) return;
    const box = workbench.getBoundingClientRect();
    const percentage = Math.max(25, Math.min(75, ((event.clientX - box.left) / box.width) * 100));
    editorPane.style.flexBasis = `${percentage}%`;
    previewPane.style.flexBasis = `${100 - percentage}%`;
    editor.requestMeasure();
  });
  const stop = () => { state.isResizing = false; resizer.classList.remove('dragging'); };
  resizer.addEventListener('pointerup', stop);
  resizer.addEventListener('pointercancel', stop);
}

function bindPreviewInteractions() {
  $('#preview').addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (/^https?:\/\//i.test(href)) {
      event.preventDefault();
      api.openExternal(href);
    }
  });
}

function bindScrollSync() {
  let syncing = false;
  const previewScroll = $('#preview-scroll');
  const cmScroll = $('.cm-scroller', editor.dom);
  cmScroll.addEventListener('scroll', () => {
    if (syncing || state.outlineJumping || state.viewMode !== 'split') return;
    const sourceMax = cmScroll.scrollHeight - cmScroll.clientHeight;
    const targetMax = previewScroll.scrollHeight - previewScroll.clientHeight;
    if (sourceMax <= 0 || targetMax <= 0) return;
    syncing = true;
    previewScroll.scrollTop = (cmScroll.scrollTop / sourceMax) * targetMax;
    requestAnimationFrame(() => { syncing = false; });
  }, { passive: true });
}

async function exportDocument(type) {
  $('#export-menu').classList.remove('open');
  const title = state.name.replace(/\.(md|markdown|mdown|mkd|txt)$/i, '') || 'document';
  const payload = { title, html: $('#preview').innerHTML, css: getExportStyles() };
  try {
    const result = type === 'pdf' ? await api.exportPdf(payload) : await api.exportHtml(payload);
    if (!result?.canceled) {
      toast(`已导出 ${type.toUpperCase()} 文件`);
      if (result.filePath) api.showItem(result.filePath);
    }
  } catch (error) {
    toast(`导出失败：${error.message}`, 'error');
  }
}

function getExportStyles() {
  return `
  *{box-sizing:border-box}body{margin:0;background:#fff;color:#343942;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei UI",sans-serif}.markdown-body{max-width:860px;margin:0 auto;padding:48px 54px;font-size:15px;line-height:1.75;word-wrap:break-word}.markdown-body h1,.markdown-body h2,.markdown-body h3,.markdown-body h4{color:#171a1f;line-height:1.3}.markdown-body h1{font-size:2.2em;padding-bottom:.35em;border-bottom:1px solid #d8dee8}.markdown-body h2{font-size:1.55em;margin-top:1.6em;padding-bottom:.25em;border-bottom:1px solid #e6e9ef}.markdown-body a{color:#086fa1}.markdown-body blockquote{margin:1.2em 0;padding:.5em 1em;border-left:4px solid #765be4;background:#f5f2ff;color:#565b67}.markdown-body code{font-family:Consolas,monospace;font-size:.88em;background:#f0edf9;color:#6448c6;border-radius:4px;padding:.16em .38em}.markdown-body pre{padding:17px 19px;overflow:auto;background:#10131c;border-radius:9px;color:#d8dceb}.markdown-body pre code{padding:0;background:none;color:inherit}.markdown-body table{width:100%;border-collapse:collapse;margin:1.2em 0}.markdown-body th,.markdown-body td{padding:.55em .8em;border:1px solid #dce1e9;text-align:left}.markdown-body th{background:#f3f5f8}.markdown-body img{max-width:100%}.markdown-body .admonition{border:1px solid #d8ddea;border-left:4px solid #765be4;border-radius:8px;padding:.75em 1em;background:#fafaff}.markdown-body .admonition:before{content:attr(data-label);display:block;font-weight:700;text-transform:uppercase;margin-bottom:.3em}.markdown-body .mermaid{text-align:center;margin:1.4em 0}.markdown-body .mermaid svg{max-width:100%}.task-list-item{list-style:none}@page{size:A4;margin:14mm}`;
}

function toggleModal(open) {
  $('#about-modal').classList.toggle('open', open);
  $('#about-modal').setAttribute('aria-hidden', String(!open));
}

function toast(message, type = 'success') {
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.innerHTML = `<i data-lucide="${type === 'error' ? 'circle-alert' : 'circle-check'}"></i><span>${escapeHtml(message)}</span>`;
  $('#toast-stack').appendChild(item);
  createIcons({ icons });
  window.setTimeout(() => {
    item.classList.add('out');
    window.setTimeout(() => item.remove(), 220);
  }, 2600);
}

function slugify(value) {
  return value.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-').replace(/-+/g, '-');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
