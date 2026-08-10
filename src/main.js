'use strict';

/**
 * YiQi@MD-Editor-wb-DSv4-Flash - Electron 主进程
 *
 * 职责：
 *  - 创建与管理主窗口（记住位置与大小）
 *  - 构建应用菜单（简体中文）
 *  - 文件打开/保存/另存为对话框
 *  - 编码检测（UTF-8 / UTF-8 BOM / GBK / GB18030）
 *  - 导出 HTML / PDF
 *  - 最近打开文件、会话恢复
 *  - 与渲染进程的 IPC 通信
 */

const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const iconv = require('iconv-lite');

// ---------------------------------------------------------------------------
// 常量与全局状态
// ---------------------------------------------------------------------------

const APP_NAME = 'YiQi@MD-Editor-wb-DSv4-Flash';
const CONFIG_FILE = 'config.json';
const RECENT_MAX = 10;

/**
 * 应用显示名（产品名 + 版本号）。
 * 版本号动态取自 package.json（app.getVersion()），避免硬编码。
 * @returns {string}
 */
function appTitle() {
  return APP_NAME + ' ' + app.getVersion();
}

let mainWindow = null;
let windowAllowClose = false;
let appState = {
  windowBounds: { width: 1280, height: 800, x: undefined, y: undefined },
  recentFiles: [],
  lastFilePath: null,
  lastFileContent: null,
  lastFileEncoding: 'utf8'
};

// ---------------------------------------------------------------------------
// 配置持久化（userData/config.json）
// ---------------------------------------------------------------------------

/**
 * 读取持久化配置（窗口位置、最近文件、上次会话文件）。
 * @returns {object} 配置对象
 */
function loadConfig() {
  const configPath = path.join(app.getPath('userData'), CONFIG_FILE);
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      windowBounds: Object.assign({}, appState.windowBounds, parsed.windowBounds || {}),
      recentFiles: Array.isArray(parsed.recentFiles) ? parsed.recentFiles.slice(0, RECENT_MAX) : [],
      lastFilePath: typeof parsed.lastFilePath === 'string' ? parsed.lastFilePath : null
    };
  } catch (err) {
    return {
      windowBounds: Object.assign({}, appState.windowBounds),
      recentFiles: [],
      lastFilePath: null
    };
  }
}

/**
 * 保存持久化配置。
 * @param {object} overrides 覆盖字段
 */
function saveConfig(overrides) {
  const configPath = path.join(app.getPath('userData'), CONFIG_FILE);
  const data = {
    windowBounds: mainWindow ? mainWindow.getBounds() : appState.windowBounds,
    recentFiles: appState.recentFiles,
    lastFilePath: appState.lastFilePath
  };
  Object.assign(data, overrides || {});
  try {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('保存配置失败:', err.message);
  }
}

// ---------------------------------------------------------------------------
// 编码检测工具
// ---------------------------------------------------------------------------

/**
 * 检测文本编码。
 * @param {Buffer} buf 文件字节
 * @returns {{encoding: string, content: string}} 编码与解码后的内容
 */
function detectAndDecode(buf) {
  // 1. UTF-8 BOM（保存时保留 BOM）
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { encoding: 'utf8bom', content: buf.slice(3).toString('utf8') };
  }
  // 2. UTF-16 LE / BE BOM
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return { encoding: 'utf16le', content: iconv.decode(buf.slice(2), 'utf16-le') };
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return { encoding: 'utf16be', content: iconv.decode(buf, 'utf16-be') };
  }
  // 3. 严格 UTF-8 解码
  const utf8 = decodeUtf8Strict(buf);
  if (utf8 !== null) {
    return { encoding: 'utf8', content: utf8 };
  }
  // 4. 回退 GB18030（GBK 超集）
  return { encoding: 'gb18030', content: iconv.decode(buf, 'gb18030') };
}

/**
 * 使用 fatal 模式严格解码 UTF-8，失败返回 null。
 * @param {Buffer} buf
 * @returns {string|null}
 */
function decodeUtf8Strict(buf) {
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    return decoder.decode(buf);
  } catch (err) {
    return null;
  }
}

/**
 * 按指定编码写入文件内容。
 * @param {string} filePath
 * @param {string} content
 * @param {string} encoding utf8 | utf8bom | gb18030 | gbk
 */
function writeFileWithEncoding(filePath, content, encoding) {
  let buf;
  switch (encoding) {
    case 'utf8bom':
      buf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(content, 'utf8')]);
      break;
    case 'gbk':
      buf = iconv.encode(content, 'gbk');
      break;
    case 'gb18030':
      buf = iconv.encode(content, 'gb18030');
      break;
    case 'utf16le':
      buf = Buffer.concat([Buffer.from([0xff, 0xfe]), iconv.encode(content, 'utf16-le')]);
      break;
    case 'utf16be':
      buf = Buffer.concat([Buffer.from([0xfe, 0xff]), iconv.encode(content, 'utf16-be')]);
      break;
    default:
      buf = Buffer.from(content, 'utf8');
  }
  fs.writeFileSync(filePath, buf);
}

// ---------------------------------------------------------------------------
// 窗口创建
// ---------------------------------------------------------------------------

/**
 * 创建主窗口。
 */
function createWindow() {
  const config = loadConfig();
  appState.recentFiles = config.recentFiles;
  appState.lastFilePath = config.lastFilePath;

  mainWindow = new BrowserWindow({
    title: appTitle(),
    width: config.windowBounds.width || 1280,
    height: config.windowBounds.height || 800,
    minWidth: 900,
    minHeight: 600,
    x: config.windowBounds.x,
    y: config.windowBounds.y,
    show: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // 修复：sandbox:true 时沙箱化 preload 的 require 受限，
      // 可能导致 preload.js 未成功执行、window.mdAPI 缺失，
      // 进而引发「语法速查无效 / 打开按钮无效 / 关闭窗口无效」。
      // 关闭 renderer sandbox，保留 contextIsolation:true + nodeIntegration:false
      // 作为安全基线（渲染进程仍无法访问 Node，页面与 preload 世界隔离）。
      sandbox: false,
      spellcheck: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 转发渲染进程/preload 的 console 输出到主进程终端，便于诊断
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const lvl = ['verbose', 'info', 'warning', 'error'][level] || 'log';
    console.log('[renderer:' + lvl + ']', message, '(line ' + line + ')');
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 记忆窗口位置与大小
  mainWindow.on('resize', debounceWindowSave);
  mainWindow.on('move', debounceWindowSave);

  // 关闭前确认：若渲染进程有未保存修改，先询问用户
  mainWindow.on('close', (event) => {
    if (windowAllowClose) {
      // 已获准关闭：保存最终窗口边界
      appState.windowBounds = mainWindow.getBounds();
      saveConfig();
      return;
    }
    event.preventDefault();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('menu-action', { action: 'confirm-close' });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 外部链接交给系统浏览器
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

let windowSaveTimer = null;
function debounceWindowSave() {
  if (windowSaveTimer) clearTimeout(windowSaveTimer);
  windowSaveTimer = setTimeout(() => {
    if (mainWindow) {
      appState.windowBounds = mainWindow.getBounds();
      saveConfig();
    }
  }, 500);
}

// ---------------------------------------------------------------------------
// 最近文件管理
// ---------------------------------------------------------------------------

/**
 * 将文件加入最近列表（去重、保留前 N 个）。
 * @param {string} filePath
 */
function addRecentFile(filePath) {
  if (!filePath) return;
  appState.recentFiles = appState.recentFiles.filter((f) => f !== filePath);
  appState.recentFiles.unshift(filePath);
  if (appState.recentFiles.length > RECENT_MAX) {
    appState.recentFiles = appState.recentFiles.slice(0, RECENT_MAX);
  }
  appState.lastFilePath = filePath;
  saveConfig();
  rebuildMenu();
}

/**
 * 打开文件并返回内容信息。
 * @param {string} filePath
 * @returns {{ok: boolean, error?: string, filePath?: string, content?: string, encoding?: string}}
 */
function openFileByPath(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return { ok: false, error: '不是有效的文件' };
    }
    const buf = fs.readFileSync(filePath);
    const detected = detectAndDecode(buf);
    addRecentFile(filePath);
    if (mainWindow) {
      mainWindow.setTitle(`${path.basename(filePath)} - ${appTitle()}`);
    }
    return {
      ok: true,
      filePath,
      content: detected.content,
      encoding: detected.encoding
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * 弹出打开文件对话框。
 * @returns {Promise<object>}
 */
async function dialogOpenFile() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开 Markdown 文件',
    filters: [
      { name: 'Markdown 文件', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] },
      { name: '所有文件', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false, canceled: true };
  }
  return openFileByPath(result.filePaths[0]);
}

/**
 * 保存文件。
 * @param {string} filePath
 * @param {string} content
 * @param {string} encoding
 * @returns {{ok: boolean, error?: string, filePath?: string, encoding?: string}}
 */
function saveFileByPath(filePath, content, encoding) {
  try {
    writeFileWithEncoding(filePath, content, encoding || 'utf8');
    addRecentFile(filePath);
    if (mainWindow) {
      mainWindow.setTitle(`${path.basename(filePath)} - ${appTitle()}`);
    }
    return { ok: true, filePath, encoding: encoding || 'utf8' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * 弹出另存为对话框。
 * @param {string} content
 * @param {string} encoding
 * @returns {Promise<object>}
 */
async function dialogSaveFileAs(content, encoding) {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '另存为',
    defaultPath: appState.lastFilePath || '未命名.md',
    filters: [
      { name: 'Markdown 文件', extensions: ['md'] },
      { name: '纯文本文件', extensions: ['txt'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });
  if (result.canceled || !result.filePath) {
    return { ok: false, canceled: true };
  }
  return saveFileByPath(result.filePath, content, encoding);
}

/**
 * 打开文件选择对话框（供渲染进程调用）。
 */
async function handleOpenDialog() {
  return dialogOpenFile();
}

/**
 * 打开另存为对话框（供渲染进程调用）。
 * @param {Electron.IpcMainInvokeEvent} event
 * @param {string} content
 * @param {string} encoding
 */
async function handleSaveAsDialog(event, content, encoding) {
  return dialogSaveFileAs(content, encoding);
}

// ---------------------------------------------------------------------------
// 导出 HTML / PDF
// ---------------------------------------------------------------------------

/**
 * 导出 HTML：将渲染后的预览 HTML 包装为独立文档。
 * @param {string} htmlBody 预览区内部 HTML
 * @param {string} title 文档标题
 * @param {string} css 内嵌样式
 * @returns {string} 完整 HTML 文档
 */
function buildStandaloneHtml(htmlBody, title, css) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>${css}</style>
</head>
<body>
<article class="markdown-body">${htmlBody}</article>
</body>
</html>`;
}

/**
 * HTML 转义。
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 选择导出 HTML 路径并写入。
 * @param {Electron.IpcMainInvokeEvent} event
 * @param {object} payload {htmlBody, title, css}
 */
async function handleExportHtml(event, payload) {
  const { htmlBody, title, css } = payload || {};
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出为 HTML',
    defaultPath: '未命名.html',
    filters: [{ name: 'HTML 文件', extensions: ['html'] }]
  });
  if (result.canceled || !result.filePath) {
    return { ok: false, canceled: true };
  }
  try {
    const full = buildStandaloneHtml(htmlBody || '', title || '未命名', css || '');
    fs.writeFileSync(result.filePath, full, 'utf8');
    return { ok: true, filePath: result.filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * 打印 / 导出 PDF：通过隐藏窗口加载 HTML 后调用打印。
 * @param {Electron.IpcMainInvokeEvent} event
 * @param {object} payload {htmlBody, title, css}
 */
async function handleExportPdf(event, payload) {
  const { htmlBody, title, css } = payload || {};
  const full = buildStandaloneHtml(htmlBody || '', title || '未命名', css || '');
  try {
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
    await printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(full));

    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出为 PDF',
      defaultPath: '未命名.pdf',
      filters: [{ name: 'PDF 文件', extensions: ['pdf'] }]
    });
    if (result.canceled || !result.filePath) {
      printWindow.destroy();
      return { ok: false, canceled: true };
    }

    const pdfData = await printWindow.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0.6, bottom: 0.6, left: 0.5, right: 0.5 }
    });
    fs.writeFileSync(result.filePath, pdfData);
    printWindow.destroy();
    return { ok: true, filePath: result.filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// 菜单
// ---------------------------------------------------------------------------

/**
 * 构建应用菜单。
 */
function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac
      ? [
          {
            label: APP_NAME,
            submenu: [
              { role: 'about', label: '关于' },
              { type: 'separator' },
              { role: 'hide', label: '隐藏' },
              { role: 'quit', label: '退出' }
            ]
          }
        ]
      : []),
    {
      label: '文件',
      submenu: [
        {
          label: '新建',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendMenuAction('new-file')
        },
        {
          label: '打开…',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialogOpenFile();
            if (result.ok && mainWindow) {
              mainWindow.webContents.send('menu-action', { action: 'open-file-result', payload: result });
            } else if (!result.canceled && mainWindow) {
              mainWindow.webContents.send('menu-action', { action: 'open-file-error', payload: result });
            }
          }
        },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendMenuAction('save-file')
        },
        {
          label: '另存为…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendMenuAction('save-file-as')
        },
        { type: 'separator' },
        {
          label: '导出为 HTML…',
          click: () => sendMenuAction('export-html')
        },
        {
          label: '导出为 PDF…',
          click: () => sendMenuAction('export-pdf')
        },
        { type: 'separator' },
        {
          label: '最近打开的文件',
          submenu:
            appState.recentFiles.length > 0
              ? appState.recentFiles.map((filePath) => ({
                  label: filePath,
                  click: () => {
                    const result = openFileByPath(filePath);
                    if (mainWindow) {
                      mainWindow.webContents.send('menu-action', {
                        action: result.ok ? 'open-file-result' : 'open-file-error',
                        payload: result
                      });
                    }
                  }
                }))
              : [{ label: '（无）', enabled: false }]
        },
        { type: 'separator' },
        isMac ? { role: 'close', label: '关闭窗口' } : { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        {
          label: '撤销',
          accelerator: 'CmdOrCtrl+Z',
          click: () => sendMenuAction('undo')
        },
        {
          label: '重做',
          accelerator: 'CmdOrCtrl+Y',
          click: () => sendMenuAction('redo')
        },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
        { type: 'separator' },
        {
          label: '查找…',
          accelerator: 'CmdOrCtrl+F',
          click: () => sendMenuAction('find')
        },
        {
          label: '替换…',
          accelerator: 'CmdOrCtrl+H',
          click: () => sendMenuAction('replace')
        }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '仅编辑视图',
          accelerator: 'CmdOrCtrl+1',
          click: () => sendMenuAction('view-editor')
        },
        {
          label: '仅预览视图',
          accelerator: 'CmdOrCtrl+2',
          click: () => sendMenuAction('view-preview')
        },
        {
          label: '分屏视图',
          accelerator: 'CmdOrCtrl+3',
          click: () => sendMenuAction('view-split')
        },
        { type: 'separator' },
        {
          label: '切换主题（亮/暗）',
          accelerator: 'CmdOrCtrl+T',
          click: () => sendMenuAction('toggle-theme')
        },
        { type: 'separator' },
        { role: 'reload', label: '重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: 'Markdown 语法速查',
          click: () => sendMenuAction('help-markdown')
        },
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于',
              message: appTitle(),
              detail: '版本 ' + app.getVersion() + '\n一款美观、全格式支持的 Markdown 查看/编辑桌面应用。\n基于 Electron + CodeMirror 6 + markdown-it 构建。',
              buttons: ['确定']
            });
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/**
 * 重建菜单（最近文件变化后调用）。
 */
function rebuildMenu() {
  buildMenu();
}

/**
 * 向渲染进程发送菜单动作。
 * @param {string} action
 */
function sendMenuAction(action) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu-action', { action });
  }
}

// ---------------------------------------------------------------------------
// IPC 注册
// ---------------------------------------------------------------------------

/**
 * 注册所有 IPC 通道。
 */
function registerIpc() {
  ipcMain.handle('file:open-dialog', handleOpenDialog);
  ipcMain.handle('file:save-as-dialog', handleSaveAsDialog);
  ipcMain.handle('file:read', (event, filePath) => {
    const result = openFileByPath(filePath);
    return result;
  });
  ipcMain.handle('file:write', (event, filePath, content, encoding) => {
    const result = saveFileByPath(filePath, content, encoding);
    return result;
  });
  ipcMain.handle('file:recent', () => {
    return { recentFiles: appState.recentFiles };
  });
  ipcMain.handle('file:get-last', () => {
    return { lastFilePath: appState.lastFilePath };
  });
  ipcMain.handle('export:html', handleExportHtml);
  ipcMain.handle('export:pdf', handleExportPdf);

  // 通用消息对话框（渲染进程请求，主进程弹出原生对话框）
  ipcMain.handle('dialog:message', async (event, options) => {
    if (!mainWindow) return { response: -1 };
    const result = await dialog.showMessageBox(mainWindow, options || {});
    return { response: result.response };
  });

  // 渲染进程确认关闭（已处理未保存修改）后真正关闭窗口
  ipcMain.on('window:allow-close', () => {
    windowAllowClose = true;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  });
  ipcMain.handle('app:state-update', (event, payload) => {
    if (payload && Object.prototype.hasOwnProperty.call(payload, 'lastFilePath')) {
      appState.lastFilePath = typeof payload.lastFilePath === 'string' ? payload.lastFilePath : null;
      saveConfig();
    }
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// 生命周期
// ---------------------------------------------------------------------------

// 单实例锁：避免重复启动
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerIpc();
    buildMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
