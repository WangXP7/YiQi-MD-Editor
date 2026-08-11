/**
 * 墨览 YiQi@MD-Editor-wb-DSv4-Flash - 选区悬浮复制按钮
 *
 * 当 CodeMirror 编辑器存在非空选区时，在选区右上角显示「复制」按钮：
 *  - 位置：view.coordsAtPos(from/to) 获取屏幕坐标后定位（position:fixed）
 *  - 复制：优先走主进程 clipboard（preload 暴露 clipboardWriteText，IPC 调
 *    electron clipboard.writeText），file:// 下 navigator.clipboard 受限时仍可靠；
 *    失败回退 navigator.clipboard / execCommand('copy')
 *  - 反馈：复制成功 showToast「已复制 N 字符」，失败 showToast「复制失败」
 *  - 选区为空时自动隐藏
 */

/**
 * 选区悬浮复制按钮管理器。
 */
export class CopyButtonManager {
  /**
   * @param {object} options
   * @param {object} options.editor createEditor 返回的编辑器控制句柄（含 view）
   * @param {(message: string, type?: string) => void} [options.showToast] 轻量提示
   */
  constructor(options) {
    this.editor = options.editor;
    this.showToast = options.showToast || (() => {});
    this.btn = null;
    this._text = '';
    this._visible = false;
  }

  /**
   * 初始化：创建按钮 DOM 并绑定点击。
   */
  init() {
    this.btn = document.createElement('button');
    this.btn.id = 'copy-float-btn';
    this.btn.className = 'copy-float-btn hidden';
    this.btn.textContent = '📋 复制';
    this.btn.title = '复制选中内容';
    this.btn.type = 'button';
    document.body.appendChild(this.btn);

    // 阻止 mousedown 抢焦点（避免编辑器失焦导致选区视觉消失）
    this.btn.addEventListener('mousedown', (e) => e.preventDefault());
    this.btn.addEventListener('click', () => this._copy());
  }

  /**
   * 由编辑器 updateListener 在 selectionSet/docChanged 时调用。
   * @param {object} state CodeMirror EditorState
   */
  update(state) {
    if (!state || !this.btn) return;
    const sel = state.selection.main;
    if (sel.empty) {
      this.hide();
      return;
    }
    const text = state.sliceDoc(sel.from, sel.to);
    if (!text) {
      this.hide();
      return;
    }
    this._text = text;
    this._position(sel);
  }

  /**
   * 隐藏按钮（选区清空 / 滚动 / 切换标签时调用）。
   */
  hide() {
    this._visible = false;
    if (this.btn) {
      this.btn.classList.add('hidden');
    }
  }

  /**
   * 依据选区坐标定位按钮（显示在选区右上角）。
   * @param {object} sel CodeMirror selection range
   */
  _position(sel) {
    const view = this.editor.view;
    if (!view) return;
    const from = view.coordsAtPos(sel.from);
    const to = view.coordsAtPos(sel.to);
    if (!from || !to) {
      this.hide();
      return;
    }
    // 先显示以取得真实尺寸
    this.btn.classList.remove('hidden');
    this._visible = true;

    const btnW = this.btn.offsetWidth || 64;
    const btnH = this.btn.offsetHeight || 30;
    const right = Math.max(from.right, to.right);
    const top = Math.min(from.top, to.top);

    let left = right - btnW - 6;
    let posTop = top - btnH - 6;
    // 视口内钳制
    left = Math.max(8, Math.min(left, window.innerWidth - btnW - 8));
    posTop = Math.max(8, Math.min(posTop, window.innerHeight - btnH - 8));

    this.btn.style.left = left + 'px';
    this.btn.style.top = posTop + 'px';
  }

  /**
   * 执行复制：主进程 clipboard → navigator.clipboard → execCommand 回退。
   */
  async _copy() {
    const text = this._text || '';
    if (!text) return;
    let ok = false;

    // 1) 主进程 clipboard（file:// 下最可靠）
    if (window.mdAPI && typeof window.mdAPI.clipboardWriteText === 'function') {
      try {
        const res = await window.mdAPI.clipboardWriteText(text);
        ok = !!(res && res.ok);
      } catch (err) {
        ok = false;
      }
    }

    // 2) navigator.clipboard（HTTP/HTTPS 或已授权环境）
    if (!ok) {
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch (err) {
        ok = false;
      }
    }

    // 3) 经典 execCommand 回退
    if (!ok) {
      ok = this._fallbackCopy(text);
    }

    if (ok) {
      this.hide();
      this.showToast('已复制 ' + text.length + ' 字符');
    } else {
      this.showToast('复制失败', 'error');
    }
  }

  /**
   * execCommand 复制回退（textarea 中转）。
   * @param {string} text
   * @returns {boolean}
   */
  _fallbackCopy(text) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch (err) {
      return false;
    }
  }
}
