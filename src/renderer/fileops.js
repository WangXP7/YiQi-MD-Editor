/**
 * YiQi@MD-Editor-V4-Flash - 文件操作模块
 *
 * 封装新建 / 打开 / 保存 / 另存为 / 导出，维护当前文件路径、
 * 编码与脏标记。所有底层读写均经由 preload 暴露的 window.mdAPI
 * （主进程负责编码检测与转换）。
 */

import { basename, encodingLabel } from './utils.js';

/**
 * 文件操作控制器。
 */
export class FileOps {
  /**
   * @param {object} handlers
   * @param {() => string} handlers.getDoc 获取编辑器文档
   * @param {(text: string) => void} handlers.setDoc 设置编辑器文档
   * @param {(meta: {name: string, encodingLabel: string, dirty: boolean, path: string|null}) => void} handlers.onMeta
   *        更新界面元信息（标题、编码徽章、脏标记）
   * @param {() => void} handlers.onPreviewRefresh 触发预览刷新
   * @param {(message: string) => void} handlers.onError 显示错误信息
   * @param {() => Promise<boolean>} handlers.confirmDiscard 打开新文件前确认放弃未保存修改
   */
  constructor(handlers) {
    this.handlers = handlers;
    this.currentPath = null;
    this.currentEncoding = 'utf-8';
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
   * 内部更新元信息。
   */
  _updateMeta() {
    this.handlers.onMeta({
      name: basename(this.currentPath) + (this.currentPath ? '' : '.md'),
      encodingLabel: encodingLabel(this.currentEncoding),
      dirty: this.isDirty,
      path: this.currentPath
    });
  }

  /**
   * 标记文档已修改（由编辑器变化回调调用）。
   */
  markDirty() {
    if (this._suppressDirty) return;
    this.isDirty = true;
    this._updateMeta();
  }

  /**
   * 标记已保存（保存成功后调用）。
   */
  markSaved() {
    this.isDirty = false;
    this._updateMeta();
  }

  /**
   * 新建文件。
   * @returns {Promise<boolean>} 是否成功新建
   */
  async newFile() {
    if (this.isDirty) {
      const proceed = await this.handlers.confirmDiscard();
      if (!proceed) return false;
    }
    this._suppressDirty = true;
    this.handlers.setDoc('');
    this._suppressDirty = false;
    this.currentPath = null;
    this.currentEncoding = 'utf-8';
    this.isDirty = false;
    this._updateMeta();
    this.handlers.onPreviewRefresh();
    if (window.mdAPI && window.mdAPI.updateState) {
      window.mdAPI.updateState({ lastFilePath: null });
    }
    return true;
  }

  /**
   * 打开文件（系统对话框）。
   * @returns {Promise<boolean>} 是否成功打开
   */
  async openDialog() {
    if (this.isDirty) {
      const proceed = await this.handlers.confirmDiscard();
      if (!proceed) return false;
    }
    const result = await window.mdAPI.openDialog();
    if (!result || result.canceled) return false;
    if (!result.ok) {
      this.handlers.onError(result.error || '打开文件失败');
      return false;
    }
    this.applyOpenResult(result);
    return true;
  }

  /**
   * 应用打开结果（菜单路径由主进程读好文件后通过菜单动作传入）。
   * @param {object} result {ok, filePath, content, encoding}
   */
  applyOpenResult(result) {
    if (!result || !result.ok) {
      this.handlers.onError((result && result.error) || '打开文件失败');
      return;
    }
    this._suppressDirty = true;
    this.handlers.setDoc(result.content || '');
    this._suppressDirty = false;
    this.currentPath = result.filePath;
    this.currentEncoding = result.encoding || 'utf-8';
    this.isDirty = false;
    this._updateMeta();
    this.handlers.onPreviewRefresh();
    if (window.mdAPI && window.mdAPI.updateState) {
      window.mdAPI.updateState({ lastFilePath: result.filePath });
    }
  }

  /**
   * 保存文件；未命名时转入另存为。
   * @returns {Promise<boolean>} 是否保存成功
   */
  async save() {
    if (!this.currentPath) {
      return this.saveAs();
    }
    const result = await window.mdAPI.writeFile(this.currentPath, this.handlers.getDoc(), this.currentEncoding);
    if (!result || !result.ok) {
      this.handlers.onError((result && result.error) || '保存失败');
      return false;
    }
    this.currentPath = result.filePath || this.currentPath;
    this.currentEncoding = result.encoding || this.currentEncoding;
    this.markSaved();
    return true;
  }

  /**
   * 另存为（保留当前非 UTF-8 编码；新文件默认 UTF-8）。
   * @returns {Promise<boolean>} 是否保存成功
   */
  async saveAs() {
    const result = await window.mdAPI.saveAsDialog(this.handlers.getDoc(), this.currentEncoding);
    if (!result || result.canceled) return false;
    if (!result.ok) {
      this.handlers.onError(result.error || '另存为失败');
      return false;
    }
    this.currentPath = result.filePath;
    this.currentEncoding = result.encoding || this.currentEncoding;
    this.markSaved();
    if (window.mdAPI && window.mdAPI.updateState) {
      window.mdAPI.updateState({ lastFilePath: result.filePath });
    }
    return true;
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
