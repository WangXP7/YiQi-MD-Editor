'use strict';

/**
 * 墨览 YiQi@MD-Editor-wb-DSv4-Flash - Preload 脚本
 *
 * 通过 contextBridge 向渲染进程暴露安全的 IPC API。
 * 渲染进程只能访问 window.mdAPI 中声明的白名单方法。
 */

const { contextBridge, ipcRenderer, webUtils } = require('electron');

/**
 * 渲染进程可用的安全 API。
 * 所有方法均封装为 Promise，错误统一以 {ok:false,error} 形式返回。
 */
try {
  contextBridge.exposeInMainWorld('mdAPI', {
  /**
   * 弹出系统打开文件对话框并读取文件。
   * @returns {Promise<{ok:boolean, canceled?:boolean, filePath?:string, content?:string, encoding?:string, error?:string}>}
   */
  openDialog: () => ipcRenderer.invoke('file:open-dialog'),

  /**
   * 按路径读取文件（自动检测编码）。
   * @param {string} filePath
   * @returns {Promise<object>}
   */
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),

  /**
   * 按路径保存文件。
   * @param {string} filePath
   * @param {string} content
   * @param {string} encoding
   * @returns {Promise<object>}
   */
  writeFile: (filePath, content, encoding) =>
    ipcRenderer.invoke('file:write', filePath, content, encoding),

  /**
   * 弹出另存为对话框并保存。
   * @param {string} content
   * @param {string} encoding
   * @returns {Promise<object>}
   */
  saveAsDialog: (content, encoding) =>
    ipcRenderer.invoke('file:save-as-dialog', content, encoding),

  /**
   * 获取最近打开文件列表。
   * @returns {Promise<{recentFiles: string[]}>}
   */
  getRecentFiles: () => ipcRenderer.invoke('file:recent'),

  /**
   * 获取上次会话打开的文件路径。
   * @returns {Promise<{lastFilePath: string|null}>}
   */
  getLastFilePath: () => ipcRenderer.invoke('file:get-last'),

  /**
   * 更新主进程状态（如当前文件路径），用于会话恢复。
   * @param {object} payload
   * @returns {Promise<object>}
   */
  updateState: (payload) => ipcRenderer.invoke('app:state-update', payload),

  /**
   * 导出为 HTML。
   * @param {{htmlBody:string, title:string, css:string}} payload
   * @returns {Promise<object>}
   */
  exportHtml: (payload) => ipcRenderer.invoke('export:html', payload),

  /**
   * 导出为 PDF。
   * @param {{htmlBody:string, title:string, css:string}} payload
   * @returns {Promise<object>}
   */
  exportPdf: (payload) => ipcRenderer.invoke('export:pdf', payload),

  /**
   * 订阅主进程菜单动作。
   * @param {(payload: {action:string, payload?:object}) => void} callback
   * @returns {() => void} 取消订阅函数
   */
  onMenuAction: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('menu-action', listener);
    return () => {
      ipcRenderer.removeListener('menu-action', listener);
    };
  },

  /**
   * 获取拖拽 File 对象的磁盘路径（Electron 官方推荐方式）。
   * @param {File} file 拖拽文件对象
   * @returns {string}
   */
  getPathForFile: (file) => webUtils.getPathForFile(file),

  /**
   * 弹出通用消息对话框。
   * @param {object} options 原生对话框选项（title/message/buttons 等）
   * @returns {Promise<{response: number}>} 用户点击的按钮索引
   */
  showMessage: (options) => ipcRenderer.invoke('dialog:message', options),

  /**
   * 通知主进程：未保存修改已处理完毕，允许关闭窗口。
   */
  confirmClose: () => {
    ipcRenderer.send('window:allow-close');
  },

  /**
   * 获取应用标题与版本号（主进程下发，避免渲染层硬编码）。
   * @returns {Promise<{title: string, version: string}>}
   */
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),

  /**
   * 将文本写入系统剪贴板（走主进程 electron clipboard，file:// 下可靠）。
   * @param {string} text 要复制的文本
   * @returns {Promise<{ok: boolean}>}
   */
  clipboardWriteText: (text) => ipcRenderer.invoke('clipboard:write-text', text)
});
} catch (err) {
  // 若 sandbox/contextIsolation 配置导致 preload 初始化失败，
  // 立即在主进程控制台暴露原因（main.js 会转发 console-message）。
  console.error('[preload] mdAPI 暴露失败:', err && err.message ? err.message : String(err));
}
