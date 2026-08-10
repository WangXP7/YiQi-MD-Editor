/**
 * YiQi@MD-Editor-wb-DSv4-Flash - 文件操作模块
 *
 * 多标签模式下保持单例：通过 setActiveTab(tab) 将内部状态指向当前活动标签，
 * 每个标签独立维护 path / encoding / dirty。保存 / 另存为 / 导出均作用于
 * 当前活动标签；底层读写经由 preload 暴露的 window.mdAPI
 * （主进程负责编码检测与转换）。
 */

import { basename, encodingLabel } from './utils.js';

/**
 * 文件操作控制器。
 */
export class FileOps {
  /**
   * @param {object} handlers
   * @param {(meta: {name: string, encodingLabel: string, dirty: boolean, path: string|null}) => void} handlers.onMeta
   *        更新界面元信息（窗口标题、编码徽章、脏标记）
   * @param {(message: string) => void} handlers.onError 显示错误信息
   */
  constructor(handlers) {
    this.handlers = handlers;
    /** 当前活动标签（TabManager 切换时通过 setActiveTab 更新） */
    this.tab = null;
    this.currentPath = null;
    this.currentEncoding = 'utf8';
    this.isDirty = false;
    this._suppressDirty = false;
  }

  /** 当前文件路径（null 表示未命名） */
  get path() {
    return this.currentPath;
  }

  /** 当前文件编码 */
  get encoding() {
    return this.currentEncoding;
  }

  /** 是否存在未保存修改 */
  get dirty() {
    return this.isDirty;
  }

  /**
   * 将内部状态指向某个标签（切换标签时由 TabManager 调用）。
   * @param {object} tab
   */
  setActiveTab(tab) {
    this.tab = tab || null;
    this.currentPath = tab ? tab.path : null;
    this.currentEncoding = tab ? tab.encoding : 'utf8';
    this.isDirty = tab ? tab.dirty : false;
  }

  /**
   * 内部更新元信息。
   */
  _updateMeta() {
    const tab = this.tab;
    this.handlers.onMeta({
      name: tab ? tab.name : '未命名.md',
      encodingLabel: encodingLabel(tab ? tab.encoding : this.currentEncoding),
      dirty: tab ? tab.dirty : this.isDirty,
      path: tab ? tab.path : null
    });
  }

  /**
   * 标记文档已修改（由编辑器变化回调经 TabManager 调用）。
   * 脏判定：从未保存的标签在输入内容后才算脏（空未命名标签不算脏）；
   * 已保存的标签以「内容 != 最后保存内容」判定。
   */
  markDirty() {
    if (this._suppressDirty) return;
    this.isDirty = true;
    if (this.tab) {
      const t = this.tab;
      t.dirty = t.lastSavedContent === null ? t.content.length > 0 : t.content !== t.lastSavedContent;
    }
    this._updateMeta();
  }

  /**
   * 保存指定标签；未命名时转入另存为对话框。
   * @param {object} tab 标签对象
   * @returns {Promise<boolean>} 是否保存成功
   */
  async saveTab(tab) {
    if (!tab) return false;
    const content = tab.content;
    if (!tab.path) {
      const result = await window.mdAPI.saveAsDialog(content, tab.encoding);
      if (!result || result.canceled) return false;
      if (!result.ok) {
        this.handlers.onError(result.error || '另存为失败');
        return false;
      }
      tab.path = result.filePath;
      tab.encoding = result.encoding || tab.encoding;
    } else {
      const result = await window.mdAPI.writeFile(tab.path, content, tab.encoding);
      if (!result || !result.ok) {
        this.handlers.onError((result && result.error) || '保存失败');
        return false;
      }
      tab.path = result.filePath || tab.path;
      tab.encoding = result.encoding || tab.encoding;
    }
    tab.name = basename(tab.path);
    tab.dirty = false;
    tab.lastSavedContent = content;
    if (this.tab === tab) {
      this.currentPath = tab.path;
      this.currentEncoding = tab.encoding;
      this.isDirty = false;
      this._updateMeta();
    }
    if (window.mdAPI && window.mdAPI.updateState) {
      window.mdAPI.updateState({ lastFilePath: tab.path });
    }
    return true;
  }

  /**
   * 保存当前活动标签。
   * @returns {Promise<boolean>} 是否保存成功
   */
  async save() {
    return this.saveTab(this.tab);
  }

  /**
   * 当前活动标签另存为（保留当前编码；未命名标签默认 UTF-8）。
   * @returns {Promise<boolean>} 是否保存成功
   */
  async saveAs() {
    const tab = this.tab;
    if (!tab) return false;
    const result = await window.mdAPI.saveAsDialog(tab.content, tab.encoding);
    if (!result || result.canceled) return false;
    if (!result.ok) {
      this.handlers.onError(result.error || '另存为失败');
      return false;
    }
    tab.path = result.filePath;
    tab.encoding = result.encoding || tab.encoding;
    tab.name = basename(tab.path);
    tab.dirty = false;
    tab.lastSavedContent = tab.content;
    this.currentPath = tab.path;
    this.currentEncoding = tab.encoding;
    this.isDirty = false;
    this._updateMeta();
    if (window.mdAPI && window.mdAPI.updateState) {
      window.mdAPI.updateState({ lastFilePath: tab.path });
    }
    return true;
  }

  /**
   * 打开文件（系统对话框）：仅返回结果，由 TabManager 创建新标签。
   * @returns {Promise<object>}
   */
  async openDialog() {
    const result = await window.mdAPI.openDialog();
    if (!result) return { ok: false, canceled: true };
    return result;
  }

  /**
   * 导出为 HTML。
   * @param {object} payload {htmlBody, title, css}
   * @returns {Promise<boolean>}
   */
  async exportHtml(payload) {
    const result = await window.mdAPI.exportHtml(payload);
    if (!result || result.canceled) return false;
    if (!result.ok) {
      this.handlers.onError(result.error || '导出 HTML 失败');
      return false;
    }
    return true;
  }

  /**
   * 导出为 PDF。
   * @param {object} payload {htmlBody, title, css}
   * @returns {Promise<boolean>}
   */
  async exportPdf(payload) {
    const result = await window.mdAPI.exportPdf(payload);
    if (!result || result.canceled) return false;
    if (!result.ok) {
      this.handlers.onError(result.error || '导出 PDF 失败');
      return false;
    }
    return true;
  }
}
