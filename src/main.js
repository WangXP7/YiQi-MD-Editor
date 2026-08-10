// ============================================================
//  YiQi@MD-Editor-千问-GLM5.2  —  Electron 主进程
//  Author: WangXP7
// ============================================================
const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let currentFile = null; // 当前打开的文件路径
let isDirty = false;    // 是否有未保存的修改

const APP_NAME = 'YiQi@MD-Editor-千问-GLM5.2';
const VERSION = '1.0.0';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 880,
    minHeight: 560,
    show: false,
    backgroundColor: '#1a1a2e',
    title: APP_NAME + ' v' + VERSION,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // 监听渲染进程标题更新
  mainWindow.on('page-title-updated', (e) => e.preventDefault());

  mainWindow.on('close', (e) => {
    if (isDirty) {
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: 'warning',
        buttons: ['保存', '不保存', '取消'],
        defaultId: 0,
        cancelId: 2,
        title: APP_NAME,
        message: '当前文档有未保存的修改，是否保存？'
      });
      if (choice === 0) {
        // 保存后关闭
        e.preventDefault();
        saveFile(true, () => mainWindow.destroy());
      } else if (choice === 2) {
        e.preventDefault();
      }
    }
  });

  buildMenu();
}

// ===== 文件操作 =====
async function openFile() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开 Markdown 文件',
    filters: [
      { name: 'Markdown 文件', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] },
      { name: '所有文件', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths.length) return;
  const fp = result.filePaths[0];
  try {
    const content = fs.readFileSync(fp, 'utf8');
    currentFile = fp;
    isDirty = false;
    mainWindow.webContents.send('file-loaded', { path: fp, content });
    updateTitle();
  } catch (err) {
    dialog.showErrorBox('打开失败', String(err && err.message || err));
  }
}

function saveFile(saveAsFlag, done) {
  mainWindow.webContents.executeJavaScript(`(window.editor && window.editor.getContent()) || ''`)
    .then(content => {
      let target = currentFile;
      const needSaveAs = saveAsFlag || !target;
      const doWrite = (p) => {
        fs.writeFile(p, content, 'utf8', (err) => {
          if (err) {
            dialog.showErrorBox('保存失败', String(err && err.message || err));
            if (done) done(false);
            return;
          }
          currentFile = p;
          isDirty = false;
          updateTitle();
          mainWindow.webContents.send('file-saved', { path: p });
          if (done) done(true);
        });
      };
      if (needSaveAs) {
        dialog.showSaveDialog(mainWindow, {
          title: '保存 Markdown 文件',
          defaultPath: currentFile || '未命名.md',
          filters: [
            { name: 'Markdown 文件', extensions: ['md'] },
            { name: '所有文件', extensions: ['*'] }
          ]
        }).then(r => {
          if (r.canceled || !r.filePath) { if (done) done(false); return; }
          doWrite(r.filePath);
        });
      } else {
        doWrite(target);
      }
    });
}

function newFile() {
  if (isDirty) {
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'warning',
      buttons: ['保存', '不保存', '取消'],
      defaultId: 0, cancelId: 2,
      title: APP_NAME, message: '当前文档有未保存的修改，是否保存？'
    });
    if (choice === 0) { saveFile(false, () => { resetDoc(); }); return; }
    if (choice === 2) return;
  }
  resetDoc();
}

function resetDoc() {
  currentFile = null;
  isDirty = false;
  mainWindow.webContents.send('file-loaded', { path: null, content: '# 新文档\n\n在此开始书写...\n' });
  updateTitle();
}

function updateTitle() {
  const name = currentFile ? path.basename(currentFile) : '未命名.md';
  const flag = isDirty ? ' ●' : '';
  mainWindow.setTitle(`${name}${flag}  —  ${APP_NAME} v${VERSION}`);
}

// ===== 菜单 =====
function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: '文件',
      submenu: [
        { label: '新建', accelerator: 'CmdOrCtrl+N', click: newFile },
        { label: '打开…', accelerator: 'CmdOrCtrl+O', click: openFile },
        { type: 'separator' },
        { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => saveFile(false) },
        { label: '另存为…', accelerator: 'CmdOrCtrl+Shift+S', click: () => saveFile(true) },
        { type: 'separator' },
        { label: '导出 HTML…', accelerator: 'CmdOrCtrl+E', click: exportHtml },
        { label: '导出 PDF…', accelerator: 'CmdOrCtrl+Shift+P', click: exportPdf },
        { type: 'separator' },
        ...(isMac ? [{ role: 'close' }] : [{ role: 'quit' }])
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', click: () => exec('undo') },
        { label: '重做', accelerator: 'CmdOrCtrl+Shift+Z', click: () => exec('redo') },
        { type: 'separator' },
        { label: '查找替换', accelerator: 'CmdOrCtrl+F', click: () => exec('find') },
        { type: 'separator' },
        { label: '插入粗体', accelerator: 'CmdOrCtrl+B', click: () => wrap('**','**') },
        { label: '插入斜体', accelerator: 'CmdOrCtrl+I', click: () => wrap('*','*') },
        { label: '插入删除线', accelerator: 'CmdOrCtrl+D', click: () => wrap('~~','~~') },
        { label: '插入链接', accelerator: 'CmdOrCtrl+K', click: () => wrap('[',']()') },
        { label: '插入代码块', accelerator: 'CmdOrCtrl+Shift+C', click: () => wrap('\n```\n','\n```\n') },
        { label: '插入表格', click: insertTable },
        { label: '插入任务列表', click: insertTaskList }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '编辑模式', click: () => setView('edit') },
        { label: '预览模式', click: () => setView('preview') },
        { label: '分屏模式', accelerator: 'CmdOrCtrl+/', click: () => setView('split') },
        { type: 'separator' },
        { label: '切换主题', click: () => exec('toggle-theme') },
        { label: '大纲导航', accelerator: 'CmdOrCtrl+Shift+O', click: () => exec('toggle-outline') },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { label: '放大', accelerator: 'CmdOrCtrl+=', click: () => zoom(0.1) },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', click: () => zoom(-0.1) },
        { label: '重置缩放', accelerator: 'CmdOrCtrl+0', click: () => zoom(0, true) }
      ]
    },
    {
      label: '帮助',
      submenu: [
        { label: `关于 ${APP_NAME}`, click: showAbout },
        { label: 'Markdown 语法速查', click: showCheatSheet },
        { type: 'separator' },
        { label: '访问 GitHub 仓库', click: () => require('electron').shell.openExternal('https://github.com/WangXP7/YiQi-MD-Editor') }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function exec(cmd) { mainWindow.webContents.send('editor-cmd', cmd); }
function wrap(before, after) { mainWindow.webContents.send('editor-wrap', { before, after }); }
function insertTable() { mainWindow.webContents.send('editor-insert-table'); }
function insertTaskList() { mainWindow.webContents.send('editor-insert-task'); }
function setView(v) { mainWindow.webContents.send('set-view', v); }
function zoom(delta, reset) {
  if (reset) { mainWindow.webContents.setZoomFactor(1); return; }
  const z = mainWindow.webContents.getZoomFactor() + delta;
  mainWindow.webContents.setZoomFactor(Math.max(0.5, Math.min(2.5, z)));
}

function exportHtml() { mainWindow.webContents.send('export-html'); }
function exportPdf() { mainWindow.webContents.send('export-pdf'); }

function showAbout() {
  const { app } = require('electron');
  dialog.showMessageBoxSync(mainWindow, {
    type: 'info',
    title: `关于 ${APP_NAME}`,
    message: APP_NAME + ' v' + VERSION,
    detail: [
      APP_NAME + ' v' + VERSION,
      '一款美观、功能齐全的 Markdown 查看/编辑器',
      '',
      '• 完整 Markdown 协议支持（GFM/脚注/任务列表/数学公式/流程图/图表/Mermaid/Emoji）',
      '• 实时预览 / 分屏 / 纯编辑 / 纯预览',
      '• 多主题切换 / 大纲导航 / 导出 HTML & PDF',
      '',
      'Powered by Electron + markdown-it + CodeMirror + Mermaid + KaTeX',
      'Copyright © 2026 WangXP7'
    ].join('\n')
  });
}

function showCheatSheet() {
  mainWindow.webContents.send('show-cheatsheet');
}

// ===== IPC =====
ipcMain.on('content-changed', () => {
  if (!isDirty) { isDirty = true; updateTitle(); }
});
ipcMain.on('get-app-info', (e) => {
  e.reply('app-info', { name: APP_NAME, version: VERSION });
});
ipcMain.on('save-request', () => saveFile(false));
ipcMain.on('open-file-drop', (e, { path: p }) => {
  try {
    const content = fs.readFileSync(p, 'utf8');
    currentFile = p; isDirty = false;
    mainWindow.webContents.send('file-loaded', { path: p, content });
    updateTitle();
  } catch (err) {
    dialog.showErrorBox('打开失败', String(err));
  }
});
// 导出 HTML：保存对话框 + 写文件
ipcMain.on('pick-save-path', (e, { defaultName }) => {
  dialog.showSaveDialog(mainWindow, {
    title: '导出文件',
    defaultPath: defaultName || '导出.html',
    filters: [
      { name: 'HTML 文件', extensions: ['html'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  }).then(r => e.reply('save-path', r.canceled ? null : r.filePath));
});

ipcMain.on('save-html', (e, { content }) => {
  dialog.showSaveDialog(mainWindow, {
    title: '导出 HTML',
    defaultPath: (currentFile ? path.basename(currentFile, path.extname(currentFile)) : '导出') + '.html',
    filters: [{ name: 'HTML 文件', extensions: ['html'] }, { name: '所有文件', extensions: ['*'] }]
  }).then(r => {
    if (r.canceled || !r.filePath) { e.reply('html-saved', null); return; }
    // 注入完整样式，保证独立可读
    const fullHtml = buildExportHtml(content);
    fs.writeFile(r.filePath, fullHtml, 'utf8', (err) => {
      if (err) { dialog.showErrorBox('导出失败', String(err)); e.reply('html-saved', null); return; }
      e.reply('html-saved', r.filePath);
      dialog.showMessageBox(mainWindow, {
        type: 'info', title: APP_NAME,
        message: '导出成功', detail: '已保存到：' + r.filePath
      });
    });
  });
});

// 导出 PDF
ipcMain.on('export-pdf-req', () => {
  mainWindow.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    margins: { marginType: 2 }
  }).then(buf => {
    dialog.showSaveDialog(mainWindow, {
      title: '导出 PDF',
      defaultPath: (currentFile ? path.basename(currentFile, path.extname(currentFile)) : '导出') + '.pdf',
      filters: [{ name: 'PDF 文件', extensions: ['pdf'] }]
    }).then(r => {
      if (r.canceled || !r.filePath) return;
      fs.writeFile(r.filePath, buf, (err) => {
        if (err) { dialog.showErrorBox('导出失败', String(err)); return; }
        dialog.showMessageBox(mainWindow, { type: 'info', title: APP_NAME, message: '导出成功', detail: '已保存到：' + r.filePath });
      });
    });
  }).catch(err => dialog.showErrorBox('导出失败', String(err)));
});

function buildExportHtml(body) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="generator" content="${APP_NAME} v${VERSION}">
<title>导出文档 — ${APP_NAME}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css@5/github-markdown-dark.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
</head>
<body class="markdown-body" style="max-width:860px;margin:40px auto;padding:24px;border-radius:8px;">
${body}
</body>
</html>`;
}

// ===== 应用生命周期 =====
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); } else {
  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });
  app.on('ready', createWindow);
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}
