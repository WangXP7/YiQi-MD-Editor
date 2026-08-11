/**
 * 墨览 YiQi@MD-Editor-wb-DSv4-Flash - 左侧大纲栏模块
 *
 * 展示当前活动标签文档的标题大纲（h1-h6 树状缩进），支持：
 *  - 点击大纲项 → 编辑器 + 预览区同步跳转
 *  - 编辑区滚动 / 预览区滚动 → 大纲当前章节高亮
 *  - 折叠/展开（状态持久化 localStorage）+ 宽度拖拽（持久化）
 *
 * 数据来源复用 preview.js 的 scanHeadings / getHeadingElements，
 * 避免重复实现标题解析逻辑（降低耦合）。
 */

import { scanHeadings } from './preview.js';

const STORAGE_COLLAPSED = 'md-outline-collapsed';
const STORAGE_WIDTH = 'md-outline-width';
const MIN_WIDTH = 160;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 240;

/**
 * 大纲栏管理器。
 */
export class OutlineManager {
  /**
   * @param {object} options
   * @param {HTMLElement} options.sidebar 大纲栏容器（#outline-sidebar）
   * @param {HTMLElement} options.list 大纲列表容器（#outline-list）
   * @param {HTMLElement} options.collapseBtn 侧栏头折叠按钮（#outline-collapse）
   * @param {HTMLElement} options.divider 宽度拖拽分隔条（#outline-divider）
   * @param {HTMLElement} options.toggleBtn 工具栏显示/隐藏按钮（#btn-outline）
   * @param {object} options.editor createEditor 返回的编辑器控制句柄（含 view）
   * @param {object} options.preview preview.js 暴露的大纲联动接口
   *        {getHeadingElements, scrollPreviewToHeading, onPreviewScroll, getPreviewScrollTop}
   * @param {() => string} options.getActiveText 获取当前活动标签文本
   * @param {(message: string, type?: string) => void} [options.showToast] 轻量提示
   */
  constructor(options) {
    this.sidebar = options.sidebar;
    this.list = options.list;
    this.collapseBtn = options.collapseBtn;
    this.divider = options.divider;
    this.toggleBtn = options.toggleBtn;
    this.editor = options.editor;
    this.preview = options.preview;
    this.getActiveText = options.getActiveText || (() => '');
    this.showToast = options.showToast || (() => {});

    /** @type {Array<{level:number, text:string, line:number}>} 当前文档标题 */
    this.headings = [];
    /** @type {HTMLElement[]} 大纲项 DOM */
    this.items = [];
    this._activeIndex = -1;
  }

  /**
   * 初始化：恢复状态、绑定事件、预览滚动联动、首次构建。
   */
  init() {
    // 恢复折叠状态
    let collapsed = false;
    try {
      collapsed = localStorage.getItem(STORAGE_COLLAPSED) === '1';
    } catch (err) {
      collapsed = false;
    }
    // 恢复宽度
    let width = DEFAULT_WIDTH;
    try {
      const stored = parseInt(localStorage.getItem(STORAGE_WIDTH), 10);
      if (stored >= MIN_WIDTH && stored <= MAX_WIDTH) width = stored;
    } catch (err) {
      width = DEFAULT_WIDTH;
    }
    this.sidebar.style.width = width + 'px';
    this.setCollapsed(collapsed);

    // 折叠按钮
    if (this.collapseBtn) {
      this.collapseBtn.addEventListener('click', () => this.toggle());
    }
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => this.toggle());
    }

    // 宽度拖拽（复用 divider 模式）
    this._initDivider();

    // 预览区滚动 → 大纲高亮（回调由 preview.js 在 iframe 滚动时触发）
    if (this.preview && this.preview.onPreviewScroll) {
      this.preview.onPreviewScroll(() => this.onPreviewScroll());
    }

    // 首次构建
    this.rebuild(this.getActiveText());
  }

  /**
   * 当前是否折叠。
   * @returns {boolean}
   */
  isCollapsed() {
    return document.body.classList.contains('outline-collapsed');
  }

  /**
   * 切换折叠状态。
   */
  toggle() {
    this.setCollapsed(!this.isCollapsed());
  }

  /**
   * 设置折叠状态并持久化。
   * @param {boolean} collapsed
   */
  setCollapsed(collapsed) {
    document.body.classList.toggle('outline-collapsed', Boolean(collapsed));
    try {
      localStorage.setItem(STORAGE_COLLAPSED, collapsed ? '1' : '0');
    } catch (err) {
      // 忽略持久化失败
    }
    if (this.collapseBtn) {
      this.collapseBtn.textContent = collapsed ? '»' : '«';
      this.collapseBtn.title = collapsed ? '展开大纲栏' : '隐藏大纲栏';
    }
    if (this.toggleBtn) {
      this.toggleBtn.classList.toggle('active', !collapsed);
    }
  }

  /**
   * 重建大纲（基于活动标签文本）。
   * @param {string} text 当前文档文本
   */
  rebuild(text) {
    this.headings = scanHeadings(text || '');
    this.list.textContent = '';
    this.items = [];
    this._activeIndex = -1;

    if (this.headings.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'outline-empty';
      empty.textContent = '无章节';
      this.list.appendChild(empty);
      return;
    }

    this.headings.forEach((heading, index) => {
      const item = document.createElement('div');
      item.className = 'outline-item outline-lv-' + heading.level;
      item.textContent = heading.text;
      item.title = heading.text + '（第 ' + heading.line + ' 行）';
      item.dataset.index = String(index);
      item.addEventListener('click', () => this.jumpToHeading(index));
      this.list.appendChild(item);
      this.items.push(item);
    });
  }

  /**
   * 点击大纲项：编辑器 + 预览区一起跳转。
   * @param {number} index 标题索引
   */
  jumpToHeading(index) {
    const heading = this.headings[index];
    if (!heading) return;
    const view = this.editor.view;
    if (view) {
      const line = Math.min(Math.max(heading.line, 1), view.state.doc.lines);
      const pos = view.state.doc.line(line).from;
      view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
      view.focus();
    }
    if (this.preview && this.preview.scrollPreviewToHeading) {
      this.preview.scrollPreviewToHeading(index);
    }
    this.setActive(index);
  }

  /**
   * 编辑区滚动 → 高亮「当前编辑行之前最后一个标题」。
   * @param {object} view CodeMirror 视图
   */
  onEditorScroll(view) {
    if (!view) return;
    const scrollEl = view.scrollDOM;
    let topLine = 1;
    // lineBlockAtHeight 接受「内容坐标」（即 scrollTop），不依赖视口渲染，精确可靠；
    // posAtCoords 需要 client 坐标且在未渲染视口返回 null，仅作兜底。
    try {
      const block = view.lineBlockAtHeight(scrollEl.scrollTop + 2);
      topLine = view.state.doc.lineAt(block.from).number;
    } catch (err) {
      const pos = view.posAtCoords({ x: 0, y: 2 });
      if (pos !== null) {
        topLine = view.state.doc.lineAt(pos).number;
      }
    }
    let idx = -1;
    for (let i = 0; i < this.headings.length; i++) {
      if (this.headings[i].line <= topLine) {
        idx = i;
      } else {
        break;
      }
    }
    this.setActive(idx);
  }

  /**
   * 预览区滚动 → 高亮「视口顶部之前最后一个标题」。
   */
  onPreviewScroll() {
    const elements = this.preview ? this.preview.getHeadingElements() : [];
    if (!elements || elements.length === 0) {
      this.setActive(-1);
      return;
    }
    const scrollTop = this.preview ? this.preview.getPreviewScrollTop() : 0;
    let idx = -1;
    for (let i = 0; i < elements.length; i++) {
      if (elements[i].offsetTop <= scrollTop + 12) {
        idx = i;
      } else {
        break;
      }
    }
    this.setActive(idx);
  }

  /**
   * 设置当前高亮项。
   * @param {number} index 标题索引（-1 表示无）
   */
  setActive(index) {
    if (index === this._activeIndex) return;
    this._activeIndex = index;
    for (let k = 0; k < this.items.length; k++) {
      this.items[k].classList.toggle('active', k === index);
    }
    if (index >= 0 && this.items[index] && this.items[index].scrollIntoView) {
      this.items[index].scrollIntoView({ block: 'nearest' });
    }
  }

  /**
   * 初始化宽度拖拽（复用现有 divider 模式）。
   */
  _initDivider() {
    const divider = this.divider;
    if (!divider) return;
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
      const parent = this.sidebar.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const w = Math.min(Math.max(e.clientX - rect.left, MIN_WIDTH), MAX_WIDTH);
      this.sidebar.style.width = w + 'px';
      try {
        localStorage.setItem(STORAGE_WIDTH, String(w));
      } catch (err) {
        // 忽略持久化失败
      }
    });

    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      divider.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    });
  }
}
