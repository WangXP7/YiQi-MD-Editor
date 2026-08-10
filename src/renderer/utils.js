/**
 * YiQi@MD-Editor-wb-DSv4-Flash - 工具函数（ESM）
 *
 * 提供防抖、字数统计、路径处理、HTML 转义等通用能力。
 */

/**
 * 防抖函数：在等待期内多次调用只执行最后一次。
 * @param {Function} func 目标函数
 * @param {number} wait 等待毫秒数
 * @returns {Function} 防抖包装函数
 */
export function debounce(func, wait) {
  let timer = null;
  return function debounced(...args) {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      func.apply(this, args);
    }, wait);
  };
}

/**
 * 节流函数：保证在间隔期内最多执行一次。
 * @param {Function} func 目标函数
 * @param {number} limit 间隔毫秒数
 * @returns {Function} 节流包装函数
 */
export function throttle(func, limit) {
  let inThrottle = false;
  let lastArgs = null;
  let lastThis = null;
  return function throttled(...args) {
    if (inThrottle) {
      lastArgs = args;
      lastThis = this;
      return;
    }
    inThrottle = true;
    func.apply(this, args);
    setTimeout(() => {
      inThrottle = false;
      if (lastArgs) {
        const savedArgs = lastArgs;
        const savedThis = lastThis;
        lastArgs = null;
        lastThis = null;
        throttled.apply(savedThis, savedArgs);
      }
    }, limit);
  };
}

/**
 * 统计文本的 行数 / 字数（中文按字计数）/ 字符数。
 * @param {string} text 文本内容
 * @returns {{lines: number, words: number, chars: number}}
 */
export function countStats(text) {
  const lines = text === '' ? 0 : text.split('\n').length;
  // 字符数：去除换行符后的字符总数
  const chars = text.replace(/\r\n/g, '').replace(/\n/g, '').length;
  // 字数：连续汉字/字母数字块为一个词，中文按单个汉字计数
  const chineseChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const asciiWords = (text.match(/[A-Za-z0-9_]+(?:[''-][A-Za-z0-9_]+)*/g) || []).length;
  const words = chineseChars + asciiWords;
  return { lines, words, chars };
}

/**
 * 获取文件的基础名（不含目录）。
 * @param {string} filePath 文件路径
 * @returns {string}
 */
export function basename(filePath) {
  if (!filePath) return '未命名';
  const parts = String(filePath).split(/[\\/]/);
  return parts[parts.length - 1] || '未命名';
}

/**
 * 获取文件的扩展名（小写，不含点）。
 * @param {string} filePath 文件路径
 * @returns {string}
 */
export function extname(filePath) {
  const base = basename(filePath);
  const idx = base.lastIndexOf('.');
  return idx > 0 ? base.slice(idx + 1).toLowerCase() : '';
}

/**
 * 将文本安全地转义为 HTML 实体（防止注入）。
 * @param {string} text 原始文本
 * @returns {string}
 */
export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 将 HTML 实体解码回原始文本。
 * @param {string} text 含实体的文本
 * @returns {string}
 */
export function decodeHtmlEntities(text) {
  return String(text)
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * 是否为 Markdown 文件（按扩展名判断）。
 * @param {string} filePath 文件路径
 * @returns {boolean}
 */
export function isMarkdownFile(filePath) {
  const ext = extname(filePath);
  return ['md', 'markdown', 'mdown', 'mkd', 'txt'].includes(ext);
}

/**
 * 将内部编码标识转换为界面显示文本。
 * @param {string} encoding 内部编码标识
 * @returns {string}
 */
export function encodingLabel(encoding) {
  const map = {
    'utf8': 'UTF-8',
    'utf8bom': 'UTF-8 BOM',
    'gbk': 'GBK',
    'gb18030': 'GB18030',
    'utf16le': 'UTF-16 LE',
    'utf16be': 'UTF-16 BE'
  };
  return map[encoding] || 'UTF-8';
}

/**
 * 获取当前时间字符串（用于导出文件名）。
 * @returns {string} YYYYMMDD-HHmmss
 */
export function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '-' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}
