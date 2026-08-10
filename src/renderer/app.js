/**
 * YiQi@MD-Editor-wb-DSv4-Flash - 应用入口
 *
 * 组装编辑器（CodeMirror 6）、多标签（TabManager）、预览（markdown-it）、
 * 文件操作、查找/替换面板，并绑定菜单动作、工具栏、拖拽、主题与会话恢复。
 *
 * 多标签架构：单 CodeMirror 实例 + 多 Tab 状态（TabManager 负责切换时
 * setDoc + 滚动/光标恢复），FileOps 共享单例并通过 setActiveTab 指向当前标签。
 */

import { createEditor } from './editor.js';
import {
  initPreview,
  renderPreview,
  setPreviewTheme,
  syncScroll,
  getExportPayload,
  showHelp
} from './preview.js';
import { FileOps } from './fileops.js';
import { TabManager } from './tabbar.js';
import { FindPanel } from './find.js';
import { countStats, isMarkdownFile, debounce, throttle } from './utils.js';

/** 应用显示名（产品名 + 版本号），用于窗口标题拼接 */
const APP_TITLE = 'YiQi@MD-Editor-wb-DSv4-Flash 1.0.0';

// 模块级实例（供各处理函数共享）
let editor = null;
let fileOps = null;
let tabManager = null;
let findPanel = null;

/**
 * 应用启动。
 */
function init() {
  // 防御性检查：preload 未加载时立即暴露问题，避免静默失效
  if (!window.mdAPI) {
    console.error('[app] window.mdAPI 不存在：preload 未成功加载，菜单/IPC 功能将不可用');
  }

  // ---- DOM 引用 ----
  const editorContainer = document.getElementById('editor-container');
  const previewFrame = document.getElementById('preview-frame');

  // ---- 编辑器 ----
  const renderPreviewDebounced = debounce((text) => {
    // 防止旧标签的延迟渲染覆盖当前预览（仅在内容仍与活动标签一致时渲染）
    const active = tabManager ? tabManager.getActiveTab() : null;
    if (active && active.content === text) {
      renderPreview(text);
    }
  }, 300);
  const syncScrollThrottled = throttle((view) => syncScroll(view), 50);

  editor = createEditor({
    container: editorContainer,
    onDocChange: (text) => {
      tabManager.onDocChanged(text);
    },
    onCursorChange: (state) => updateCursor(state),
    onScroll: (view) => syncScrollThrottled(view),
    onRequestFind: () => findPanel.open('find'),
    onRequestReplace: () => findPanel.open('replace')
  });

  // ---- 文件操作（共享单例，TabManager 切换标签时 setActiveTab） ----
  fileOps = new FileOps({
    onMeta: updateMeta,
    onError: (message) => showToast(message, 'error')
  });

  // ---- 多标签管理器 ----
  tabManager = new TabManager({
    container: document.getElementById('tabbar'),
    editor,
    fileOps,
    renderPreview: renderPreviewDebounced,
    renderPreviewNow: (text) => renderPreview(text),
    updateStats,
    updateMeta,
    showToast
  });

  // ---- 查找面板 ----
  findPanel = new FindPanel(editor, {
    panel: document.getElementById('find-panel'),
    input: document.getElementById('find-input'),
    replaceInput: document.getElementById('replace-input'),
    prev: document.getElementById('find-prev'),
    next: document.getElementById('find-next'),
    replace: document.getElementById('replace-one'),
    replaceAll: document.getElementById('replace-all'),
    caseCheck: document.getElementById('find-case'),
    regexCheck: document.getElementById('find-regex'),
    status: document.getElementById('find-status'),
    close: document.getElementById('find-close')
  });

  // ---- 预览 ----
  initPreview(previewFrame);
  renderPreview(editor.getDoc());

  // ---- 工具栏 ----
  document.getElementById('btn-new').addEventListener('click', () => tabManager.newTab());
  document.getElementById('btn-open').addEventListener('click', () => tabManager.openDialog());
  document.getElementById('btn-save').addEventListener('click', () => tabManager.saveActive());
  document.getElementById('btn-export').addEventListener('click', () => doExportMenu());
  document.getElementById('view-editor').addEventListener('click', () => setView('editor'));
  document.getElementById('view-split').addEventListener('click', () => setView('split'));
  document.getElementById('view-preview').addEventListener('click', () => setView('preview'));
  document.getElementById('btn-theme').addEventListener('click', toggleTheme);
  document.getElementById('btn-find').addEventListener('click', () => findPanel.open('find'));

  // ---- 其余初始化 ----
  initDivider();
  initDragDrop();
  applyTheme(getStoredTheme() === 'dark');
  initMenuActions();
  restoreSession();
  updateStats(editor.getDoc());
}

// ===========================================================================
// 状态栏与元信息
// ===========================================================================

/**
 * 更新统计栏（行数/字数/字符数）。
 * @param {string} text 文档文本
 */
function updateStats(text) {
  const stats = countStats(text || '');
  document.getElementById('stat-lines').textContent = stats.lines + ' 行';
  document.getElementById('stat-words').textContent = stats.words + ' 字';
  document.getElementById('stat-chars').textContent = stats.chars + ' 字符';
}

/**
 * 更新光标位置。
 * @param {object} state CodeMirror EditorState
 */
function updateCursor(state) {
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  document.getElementById('stat-cursor').textContent =
    '行 ' + line.number + '，列 ' + (pos - line.from + 1);
}

/**
 * 更新窗口元信息（编码徽章、状态栏编码、窗口标题）。
 * @param {object} meta
 */
function updateMeta(meta) {
  document.getElementById('encoding-badge').textContent = meta.encodingLabel;
  document.getElementById('stat-encoding').textContent = meta.encodingLabel;
  document.title = (meta.dirty ? '* ' : '') + meta.name + ' - ' + APP_TITLE;
}

// ===========================================================================
// 视图切换
// ===========================================================================

/**
 * 切换视图模式。
 * @param {string} mode 'editor' | 'preview' | 'split'
 */
function setView(mode) {
  document.body.classList.remove('view-editor', 'view-preview', 'view-split');
  document.body.classList.add('view-' + mode);
  const idMap = { editor: 'view-editor', preview: 'view-preview', split: 'view-split' };
  ['view-editor', 'view-split', 'view-preview'].forEach((id) => {
    document.getElementById(id).classList.toggle('active', id === idMap[mode]);
  });
  requestAnimationFrame(() => editor.view.requestMeasure());
}

// ===========================================================================
// 主题
// ===========================================================================

/**
 * 读取持久化主题。
 * @returns {string} 'light' | 'dark'
 */
function getStoredTheme() {
  try {
    return localStorage.getItem('md-theme') || 'light';
  } catch (err) {
    return 'light';
  }
}

/**
 * 应用主题（含预览与编辑器）。
 * @param {boolean} dark
 */
function applyTheme(dark) {
  document.body.setAttribute('data-theme', dark ? 'dark' : 'light');
  try {
    localStorage.setItem('md-theme', dark ? 'dark' : 'light');
  } catch (err) {
    // 忽略持久化失败
  }
  setPreviewTheme(dark);
  document.getElementById('btn-theme').textContent = dark ? '☀️' : '🌙';
}

/**
 * 切换亮/暗主题。
 */
function toggleTheme() {
  applyTheme(document.body.getAttribute('data-theme') !== 'dark');
}

// ===========================================================================
// 导出
// ===========================================================================

/**
 * 导出菜单：HTML 与 PDF。
 * @param {string} kind 'html' | 'pdf'
 */
async function doExport(kind) {
  const tab = tabManager.getActiveTab();
  const title = tab ? tab.name : '未命名';
  const payload = getExportPayload(editor.getDoc(), title);
  let ok = false;
  if (kind === 'html') {
    ok = await fileOps.exportHtml(payload);
  } else {
    ok = await fileOps.exportPdf(payload);
  }
  if (ok) {
    showToast('导出' + (kind === 'html' ? ' HTML' : ' PDF') + '成功');
  }
}

/**
 * 显示导出子菜单（HTML / PDF）。
 */
function doExportMenu() {
  window.mdAPI.showMessage({
    type: 'question',
    title: '导出',
    message: '请选择导出格式',
    buttons: ['导出为 HTML', '导出为 PDF', '取消'],
    defaultId: 0,
    cancelId: 2
  }).then((result) => {
    if (result.response === 0) doExport('html');
    else if (result.response === 1) doExport('pdf');
  });
}

// ===========================================================================
// 窗口关闭确认（多标签：检查所有标签的未保存修改）
// ===========================================================================

/**
 * 处理窗口关闭请求（由主进程 confirm-close 菜单动作触发）。
 * 存在脏标签时询问「保存全部 / 不保存 / 取消」。
 */
async function handleConfirmClose() {
  const dirtyTabs = tabManager.getDirtyTabs();
  if (dirtyTabs.length === 0) {
    window.mdAPI.confirmClose();
    return;
  }
  const result = await window.mdAPI.showMessage({
    type: 'warning',
    title: '未保存的更改',
    message: '有 ' + dirtyTabs.length + ' 个标签页存在未保存的更改。',
    detail: '选择“保存全部”将逐个保存（未命名文档会弹出另存为对话框）。',
    buttons: ['保存全部', '不保存', '取消'],
    defaultId: 0,
    cancelId: 2
  });
  if (result.response === 2) return; // 取消关闭
  if (result.response === 0) {
    for (const tab of dirtyTabs) {
      const ok = await tabManager.saveTabById(tab.id);
      if (!ok) return; // 另存为被取消 → 中止关闭
    }
  }
  window.mdAPI.confirmClose();
}

// ===========================================================================
// 菜单动作
// ===========================================================================

/**
 * 订阅主进程菜单动作。
 */
function initMenuActions() {
  window.mdAPI.onMenuAction(({ action, payload }) => {
    switch (action) {
      case 'new-file':
        tabManager.newTab();
        break;
      case 'open-file-result':
        tabManager.openInTab(payload);
        break;
      case 'open-file-error':
        showToast((payload && payload.error) || '打开文件失败', 'error');
        break;
      case 'save-file':
        tabManager.saveActive();
        break;
      case 'save-file-as':
        tabManager.saveActiveAs();
        break;
      case 'export-html':
        doExport('html');
        break;
      case 'export-pdf':
        doExport('pdf');
        break;
      case 'find':
        findPanel.open('find');
        break;
      case 'replace':
        findPanel.open('replace');
        break;
      case 'view-editor':
        setView('editor');
        break;
      case 'view-preview':
        setView('preview');
        break;
      case 'view-split':
        setView('split');
        break;
      case 'toggle-theme':
        toggleTheme();
        break;
      case 'undo':
        editor.undo();
        break;
      case 'redo':
        editor.redo();
        break;
      case 'help-markdown':
        setView('preview');
        showHelp();
        break;
      case 'confirm-close':
        handleConfirmClose();
        break;
      default:
        break;
    }
  });
}

// ===========================================================================
// 分隔条拖拽
// ===========================================================================

/**
 * 初始化编辑/预览分栏拖拽。
 */
function initDivider() {
  const divider = document.getElementById('divider');
  const editorPane = document.getElementById('editor-pane');
  const previewPane = document.getElementById('preview-pane');
  const workspace = document.getElementById('workspace');
  let dragging = false;

  divider.addEventListener('mousedown', (e) => {
    dragging = true;
    divider.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const rect = workspace.getBoundingClientRect();
    const total = rect.width;
    if (total <= 0) return;
    const left = Math.min(Math.max(e.clientX - rect.left, 200), total - 200);
    const pct = (left / total) * 100;
    editorPane.style.flex = '0 0 ' + pct + '%';
    previewPane.style.flex = '1 1 ' + (100 - pct) + '%';
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    divider.classList.remove('active');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
}

// ===========================================================================
// 拖拽打开文件
// ===========================================================================

/**
 * 判断拖拽事件是否携带文件。
 * @param {DragEvent} e
 * @returns {boolean}
 */
function hasFiles(e) {
  return Boolean(e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files'));
}

/**
 * 初始化窗口级拖拽打开文件（多标签：每次拖入创建新标签）。
 */
function initDragDrop() {
  const overlay = document.getElementById('drop-overlay');
  let dragDepth = 0;

  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    if (!hasFiles(e)) return;
    dragDepth++;
    overlay.classList.remove('hidden');
  });

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) overlay.classList.add('hidden');
  });

  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragDepth = 0;
    overlay.classList.add('hidden');
    const files = e.dataTransfer && e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    let filePath = null;
    if (window.mdAPI.getPathForFile) {
      try {
        filePath = window.mdAPI.getPathForFile(file);
      } catch (err) {
        filePath = file.path || null;
      }
    } else {
      filePath = file.path || null;
    }
    if (!filePath || !isMarkdownFile(filePath)) {
      showToast('仅支持打开 Markdown 文件', 'error');
      return;
    }
    const result = await window.mdAPI.readFile(filePath);
    tabManager.openInTab(result);
  });
}

// ===========================================================================
// 会话恢复
// ===========================================================================

/**
 * 恢复上次会话：优先打开上次文件，其次最近文件列表第一项。
 * 多标签简化策略：仅恢复单个文件作为第一个标签；无可用文件时新建空标签。
 */
async function restoreSession() {
  try {
    const last = await window.mdAPI.getLastFilePath();
    if (last && last.lastFilePath) {
      const result = await window.mdAPI.readFile(last.lastFilePath);
      if (result && result.ok) {
        tabManager.openInTab(result);
        return;
      }
    }
    const recent = await window.mdAPI.getRecentFiles();
    if (recent && recent.recentFiles && recent.recentFiles.length > 0) {
      const result = await window.mdAPI.readFile(recent.recentFiles[0]);
      if (result && result.ok) {
        tabManager.openInTab(result);
        return;
      }
    }
  } catch (err) {
    console.error('会话恢复失败:', err);
  } finally {
    if (tabManager.tabs.length === 0) {
      tabManager.newTab();
    }
  }
}

// ===========================================================================
// Toast 提示
// ===========================================================================

/**
 * 显示轻量提示。
 * @param {string} message 消息文本
 * @param {string} [type] 'info' | 'error'
 */
function showToast(message, type) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.toggle('toast-error', type === 'error');
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ---- 启动 ----
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
