/**
 * YiQi@MD-Editor-wb-DSv4-Flash - 多标签管理模块
 *
 * 采用「单 CodeMirror 实例 + 多 Tab 状态」架构：
 *  - 每个 tab 独立保存 文档内容 / 编码 / 脏标记 / 滚动位置 / 光标位置；
 *  - 切换标签时把当前编辑器状态写回旧 tab，再将新 tab 内容载入同一编辑器
 *    （editor.setDoc + 恢复滚动/光标），避免多实例的内存开销与切换闪烁；
 *  - 顶部 tab 栏为 VS Code 风格：点击切换、✕ 关闭（hover 显示）、脏标记、
 *    横向滚动、关闭最后一个标签自动新建空标签。
 */

import { basename, encodingLabel } from './utils.js';

/**
 * 多标签管理器。
 */
export class TabManager {
  /**
   * @param {object} options
   * @param {HTMLElement} options.container 顶部 tab 栏容器（#tabbar）
   * @param {object} options.editor createEditor 返回的编辑器控制句柄
   * @param {object} options.fileOps FileOps 实例（共享单例，通过 setActiveTab 指向当前 tab）
   * @param {(text: string) => void} [options.renderPreview] 防抖预览渲染（编辑过程用）
   * @param {(text: string) => void} [options.renderPreviewNow] 立即预览渲染（切换标签用）
   * @param {(text: string) => void} [options.updateStats] 更新状态栏统计
   * @param {(meta: {name: string, encodingLabel: string, dirty: boolean, path: string|null}) => void} [options.updateMeta]
   *        更新窗口标题/编码徽章
   * @param {(message: string, type?: string) => void} [options.showToast] 轻量提示
   * @param {(tab: object) => void} [options.onSwitch] 标签切换完成回调（大纲重建等）
   */
  constructor(options) {
    this.container = options.container;
    this.editor = options.editor;
    this.fileOps = options.fileOps;
    this.renderPreview = options.renderPreview || (() => {});
    this.renderPreviewNow = options.renderPreviewNow || this.renderPreview;
    this.updateStats = options.updateStats || (() => {});
    this.updateMeta = options.updateMeta || (() => {});
    this.showToast = options.showToast || (() => {});
    this.onSwitch = options.onSwitch || (() => {});

    /** @type {Array<object>} 全部打开的标签 */
    this.tabs = [];
    /** @type {string|null} 当前活动标签 id */
    this.activeTabId = null;
    /** 载入标签时的内部标记（用于抑制编辑器 docChanged 回调） */
    this._loading = false;
    this._seq = 0;
    this._dragIndex = -1;
  }

  /** 当前活动标签（无则返回 null） */
  getActiveTab() {
    return this.tabs.find((t) => t.id === this.activeTabId) || null;
  }

  /** 所有存在未保存修改的标签 */
  getDirtyTabs() {
    return this.tabs.filter((t) => t.dirty);
  }

  /**
   * 生成唯一标签 id。
   * @returns {string}
   */
  _nextId() {
    this._seq += 1;
    return 'tab-' + Date.now().toString(36) + '-' + this._seq + '-' + Math.random().toString(36).slice(2, 8);
  }

  /**
   * 构造标签状态对象。
   * @param {object} src
   * @returns {object}
   */
  _makeTab(src) {
    const s = src || {};
    return {
      id: this._nextId(),
      path: s.path || null,
      name: s.name || (s.path ? basename(s.path) : '未命名.md'),
      content: String(s.content || ''),
      encoding: s.encoding || 'utf8',
      dirty: !!s.dirty,
      scrollTop: 0,
      cursorPos: 0,
      scrollRatio: 0,
      lastSavedContent: typeof s.lastSavedContent === 'string' ? s.lastSavedContent : null
    };
  }

  /**
   * 新建空标签页（始终新建，不覆盖当前文档）。
   * @returns {object} 新标签
   */
  newTab() {
    const tab = this._makeTab({});
    this.tabs.push(tab);
    this.switchTab(tab.id);
    if (window.mdAPI && window.mdAPI.updateState) {
      window.mdAPI.updateState({ lastFilePath: null });
    }
    return tab;
  }

  /**
   * 打开文件（系统对话框）：成功后在新区打开。
   * @returns {Promise<boolean>} 是否打开成功
   */
  async openDialog() {
    const result = await window.mdAPI.openDialog();
    if (!result || result.canceled) return false;
    if (!result.ok) {
      this.showToast((result.error) || '打开文件失败', 'error');
      return false;
    }
    this.openInTab(result);
    return true;
  }

  /**
   * 将打开结果载入新标签页；若该路径已在某标签打开则切换过去。
   * @param {object} result {ok, filePath, content, encoding, error?}
   * @returns {object|null} 激活的标签
   */
  openInTab(result) {
    if (!result || !result.ok) {
      this.showToast((result && result.error) || '打开文件失败', 'error');
      return null;
    }
    const existing = this.tabs.find((t) => t.path && t.path === result.filePath);
    if (existing) {
      this.switchTab(existing.id);
      return existing;
    }
    const tab = this._makeTab({
      path: result.filePath,
      content: result.content,
      encoding: result.encoding || 'utf8',
      lastSavedContent: result.content || ''
    });
    this.tabs.push(tab);
    this.switchTab(tab.id);
    if (window.mdAPI && window.mdAPI.updateState) {
      window.mdAPI.updateState({ lastFilePath: result.filePath });
    }
    return tab;
  }

  /**
   * 切换活动标签：保存当前标签状态，载入目标标签。
   * @param {string} id
   */
  switchTab(id) {
    if (id === this.activeTabId) return;
    const next = this.tabs.find((t) => t.id === id);
    if (!next) return;
    this._saveEditorState();
    this.activeTabId = id;
    this._loadTabToEditor(next);
    this.fileOps.setActiveTab(next);
    this._updateMeta();
    this._render();
    this.onSwitch(next);
  }

  /**
   * 切换到下一个标签（Ctrl+Tab）。
   */
  nextTab() {
    if (this.tabs.length < 2) return;
    const idx = this.tabs.findIndex((t) => t.id === this.activeTabId);
    const next = this.tabs[(idx + 1) % this.tabs.length];
    this.switchTab(next.id);
  }

  /**
   * 切换到上一个标签（Ctrl+Shift+Tab）。
   */
  prevTab() {
    if (this.tabs.length < 2) return;
    const idx = this.tabs.findIndex((t) => t.id === this.activeTabId);
    const next = this.tabs[(idx - 1 + this.tabs.length) % this.tabs.length];
    this.switchTab(next.id);
  }

  /**
   * 关闭标签页；未保存时弹原生「保存 / 不保存 / 取消」对话框。
   * 关闭当前标签后激活相邻标签；关闭最后一个标签自动新建空标签。
   * @param {string} id
   * @returns {Promise<boolean>} 是否已关闭
   */
  async closeTab(id) {
    const idx = this.tabs.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    const tab = this.tabs[idx];

    if (tab.dirty) {
      const result = await window.mdAPI.showMessage({
        type: 'warning',
        title: '未保存的更改',
        message: '是否保存对“' + tab.name + '”的更改？',
        detail: '如果不保存，更改将丢失。',
        buttons: ['保存', '不保存', '取消'],
        defaultId: 0,
        cancelId: 2
      });
      if (result.response === 2) return false; // 取消关闭
      if (result.response === 0) {
        const saved = await this.fileOps.saveTab(tab);
        if (!saved) return false; // 另存为被取消 → 中止关闭
      }
    }

    const wasActive = tab.id === this.activeTabId;
    if (wasActive) {
      this._saveEditorState();
    }
    this.tabs.splice(idx, 1);

    if (this.tabs.length === 0) {
      this.newTab();
      return true;
    }
    if (wasActive) {
      const next = this.tabs[Math.min(idx, this.tabs.length - 1)];
      this.switchTab(next.id);
    } else {
      this._render();
    }
    return true;
  }

  /**
   * 保存当前活动标签。
   * @returns {Promise<boolean>}
   */
  async saveActive() {
    const tab = this.getActiveTab();
    if (!tab) return false;
    const ok = await this.fileOps.save();
    if (ok) {
      const current = this.getActiveTab();
      if (current) this._refreshTabElement(current);
    }
    return ok;
  }

  /**
   * 当前活动标签另存为。
   * @returns {Promise<boolean>}
   */
  async saveActiveAs() {
    const tab = this.getActiveTab();
    if (!tab) return false;
    const ok = await this.fileOps.saveAs();
    if (ok) {
      const current = this.getActiveTab();
      if (current) this._refreshTabElement(current);
    }
    return ok;
  }

  /**
   * 按标签 id 保存（窗口关闭前遍历脏标签用）。
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async saveTabById(id) {
    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return false;
    const ok = await this.fileOps.saveTab(tab);
    if (ok) this._refreshTabElement(tab);
    return ok;
  }

  /**
   * 编辑器文档变化回调（由 app.js 的 onDocChange 转发）。
   * @param {string} text 最新文档文本
   */
  onDocChanged(text) {
    if (this._loading) return;
    const tab = this.getActiveTab();
    if (!tab) return;
    tab.content = text;
    this.fileOps.markDirty();
    this.renderPreview(text);
    this.updateStats(text);
    this._refreshTabElement(tab);
  }

  /**
   * 将当前编辑器状态（内容/滚动/光标）写入活动标签。
   */
  _saveEditorState() {
    const tab = this.getActiveTab();
    if (!tab || !this.editor) return;
    const view = this.editor.view;
    tab.content = this.editor.getDoc();
    tab.scrollTop = view.scrollDOM.scrollTop;
    tab.cursorPos = view.state.selection.main.head;
    const max = view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight;
    tab.scrollRatio = max > 0 ? view.scrollDOM.scrollTop / max : 0;
    // 空未命名标签不算脏（与 VS Code 一致）；已保存标签按内容比对
    tab.dirty = tab.lastSavedContent === null ? tab.content.length > 0 : tab.content !== tab.lastSavedContent;
  }

  /**
   * 将标签内容载入编辑器并恢复滚动/光标。
   * @param {object} tab
   */
  _loadTabToEditor(tab) {
    this._loading = true;
    try {
      this.editor.setDoc(tab.content);
    } finally {
      this._loading = false;
    }
    const view = this.editor.view;
    requestAnimationFrame(() => {
      view.scrollDOM.scrollTop = tab.scrollTop || 0;
      const pos = Math.min(tab.cursorPos || 0, view.state.doc.length);
      view.dispatch({ selection: { anchor: pos }, scrollIntoView: false });
      view.focus();
      // scrollTop 可能未变化（无 scroll 事件），手动派发一次以联动预览
      view.scrollDOM.dispatchEvent(new Event('scroll'));
    });
    this.renderPreviewNow(tab.content);
    this.updateStats(tab.content);
  }

  /**
   * 刷新窗口标题/编码徽章（切换标签后）。
   */
  _updateMeta() {
    const tab = this.getActiveTab();
    if (!tab) return;
    this.updateMeta({
      name: tab.name,
      encodingLabel: encodingLabel(tab.encoding),
      dirty: tab.dirty,
      path: tab.path
    });
  }

  /**
   * 刷新单个标签元素（名称/脏标记/tooltip）。
   * @param {object} tab
   */
  _refreshTabElement(tab) {
    if (!this.container) return;
    const el = this.container.querySelector('.tab[data-id="' + tab.id + '"]');
    if (!el) return;
    const nameEl = el.querySelector('.tab-name');
    if (nameEl) {
      nameEl.textContent = (tab.dirty ? '* ' : '') + tab.name;
    }
    el.title = tab.path || tab.name;
  }

  /**
   * 重建整个 tab 栏 DOM。
   */
  _render() {
    if (!this.container) return;
    this.container.textContent = '';
    for (const tab of this.tabs) {
      const el = document.createElement('div');
      el.className = 'tab' + (tab.id === this.activeTabId ? ' active' : '');
      el.dataset.id = tab.id;
      el.title = tab.path || tab.name;

      const nameEl = document.createElement('span');
      nameEl.className = 'tab-name';
      nameEl.textContent = (tab.dirty ? '* ' : '') + tab.name;

      const closeEl = document.createElement('button');
      closeEl.className = 'tab-close';
      closeEl.title = '关闭标签页';
      closeEl.setAttribute('aria-label', '关闭标签页');
      closeEl.textContent = '✕';
      closeEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeTab(tab.id);
      });

      el.appendChild(nameEl);
      el.appendChild(closeEl);

      el.addEventListener('click', () => this.switchTab(tab.id));
      // 中键点击关闭
      el.addEventListener('auxclick', (e) => {
        if (e.button === 1) {
          e.preventDefault();
          this.closeTab(tab.id);
        }
      });

      // 拖拽排序（HTML5 Drag & Drop）：拖到目标标签上释放即重排
      el.draggable = true;
      el.addEventListener('dragstart', (e) => {
        this._dragIndex = this.tabs.findIndex((t) => t.id === tab.id);
        try {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', tab.id);
        } catch (err) {
          // 忽略 dataTransfer 异常
        }
        el.classList.add('dragging');
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        this._dragIndex = -1;
        this._render();
      });
      el.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        el.classList.add('drag-over');
      });
      el.addEventListener('dragleave', () => {
        el.classList.remove('drag-over');
      });
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove('drag-over');
        const from = this._dragIndex;
        const to = this.tabs.findIndex((t) => t.id === tab.id);
        if (from >= 0 && to >= 0 && from !== to) {
          const moved = this.tabs.splice(from, 1)[0];
          this.tabs.splice(to, 0, moved);
          this._render();
        }
      });

      this.container.appendChild(el);
    }
    const activeEl = this.container.querySelector('.tab.active');
    if (activeEl && activeEl.scrollIntoView) {
      activeEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }
}
