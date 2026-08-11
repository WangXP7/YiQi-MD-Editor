import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import fsPromises from 'fs/promises'
import { randomUUID } from 'crypto'
import { IPC } from '../shared/ipcChannels'
import { APP_NAME, THEME_LIST } from '../shared/constants'

const isDev = !!process.env.VITE_DEV_SERVER_URL

function recentsPath(): string {
  return path.join(app.getPath('userData'), 'recents.json')
}

function loadRecents(): RecentFileItem[] {
  try {
    return JSON.parse(fs.readFileSync(recentsPath(), 'utf-8'))
  } catch {
    return []
  }
}

function saveRecents(list: RecentFileItem[]): void {
  try {
    fs.writeFileSync(recentsPath(), JSON.stringify(list, null, 2))
  } catch {
    /* ignore */
  }
}

interface RecentFileItem {
  path: string
  name: string
  mtime: number
}

// 模块级持有主窗口引用，供菜单重建与标题设置使用
let mainWin: BrowserWindow | null = null

// ---------- IPC 业务处理 ----------
ipcMain.handle(IPC.openFile, async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
  })
  if (canceled || !filePaths[0]) return null
  const filePath = filePaths[0]
  const content = await fsPromises.readFile(filePath, 'utf-8')
  return { path: filePath, content, name: path.basename(filePath) }
})

ipcMain.handle(IPC.openByPath, async (_e, p: string) => {
  try {
    const content = await fsPromises.readFile(p, 'utf-8')
    return { path: p, content, name: path.basename(p) }
  } catch {
    return { error: 'not_found' }
  }
})

ipcMain.handle(IPC.saveFile, async (_e, filePath: string | null, content: string) => {
  let p = filePath
  if (!p) {
    const r = await dialog.showSaveDialog({
      defaultPath: 'untitled.md',
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (r.canceled || !r.filePath) return { saved: false }
    p = r.filePath
  }
  await fsPromises.writeFile(p, content, 'utf-8')
  return { saved: true, path: p, name: path.basename(p) }
})

ipcMain.handle(IPC.saveFileAs, async (_e, content: string) => {
  const r = await dialog.showSaveDialog({
    defaultPath: 'untitled.md',
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  })
  if (r.canceled || !r.filePath) return { saved: false }
  await fsPromises.writeFile(r.filePath, content, 'utf-8')
  return { saved: true, path: r.filePath, name: path.basename(r.filePath) }
})

ipcMain.handle(IPC.exportHtml, async (_e, html: string, defaultPath?: string) => {
  const r = await dialog.showSaveDialog({
    defaultPath: defaultPath || 'document.html',
    filters: [{ name: 'HTML', extensions: ['html'] }]
  })
  if (r.canceled || !r.filePath) return { saved: false }
  await fsPromises.writeFile(r.filePath, html, 'utf-8')
  return { saved: true, path: r.filePath }
})

ipcMain.handle(IPC.exportPdf, async (_e, html: string) => {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    const pdf: Uint8Array = await win.webContents.printToPDF({
      printBackground: true,
      landscape: false,
      pageSize: 'A4',
      margins: { top: 24, bottom: 24, left: 24, right: 24 }
    })
    const r = await dialog.showSaveDialog({
      defaultPath: 'document.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (r.canceled || !r.filePath) return { saved: false }
    await fsPromises.writeFile(r.filePath, Buffer.from(pdf))
    return { saved: true, path: r.filePath }
  } finally {
    win.destroy()
  }
})

ipcMain.handle(IPC.getRecents, async () => loadRecents())

ipcMain.handle(IPC.addRecent, async (_e, item: RecentFileItem) => {
  const list = loadRecents().filter((i) => i.path !== item.path)
  list.unshift(item)
  const next = list.slice(0, 12)
  saveRecents(next)
  if (mainWin) buildMenu(mainWin)
  return next
})

ipcMain.handle(IPC.clearRecents, async () => {
  saveRecents([])
  if (mainWin) buildMenu(mainWin)
  return []
})

ipcMain.handle(
  IPC.saveImage,
  async (_e, base64: string, name: string, mdDir: string | null) => {
    const dir =
      mdDir && fs.existsSync(mdDir)
        ? path.join(mdDir, 'images')
        : path.join(app.getPath('userData'), 'images')
    await fsPromises.mkdir(dir, { recursive: true })
    const ext = name.includes('.') ? path.extname(name) : '.png'
    const base = (name.replace(/\.[^.]+$/, '') || 'image').replace(/[^\w.-]/g, '_')
    const fname = `${base}-${randomUUID().slice(0, 8)}${ext}`
    const fpath = path.join(dir, fname)
    await fsPromises.writeFile(fpath, Buffer.from(base64, 'base64'))
    const relativePath = mdDir
      ? path.relative(mdDir, fpath).split(path.sep).join('/')
      : fpath
    return { relativePath, absolutePath: fpath }
  }
)

ipcMain.handle(IPC.openExternal, async (_e, url: string) => {
  try {
    await shell.openExternal(url)
  } catch {
    /* ignore */
  }
})

ipcMain.handle(IPC.setTitle, async (_e, t: string) => {
  mainWin?.setTitle(t)
})

// ---------- 菜单 ----------
function buildMenu(win: BrowserWindow): void {
  const send = (action: string) =>
    win.webContents.send(IPC.menuAction, action)

  // "最近打开"子菜单：取 ≤10 条，每项 label=文件名、tooltip=路径
  const recentItems = loadRecents().slice(0, 10)
  const recentSubmenu: Electron.MenuItemConstructorOptions[] = recentItems.map(
    (item) => ({
      label: item.name,
      toolTip: item.path,
      click: () => send('openRecent:' + encodeURIComponent(item.path))
    })
  )
  recentSubmenu.push({ type: 'separator' })
  recentSubmenu.push({
    label: '清空最近打开',
    click: () => send('clearRecents')
  })

  // "主题"子菜单：遍历 THEME_LIST
  const themeSubmenu: Electron.MenuItemConstructorOptions[] = THEME_LIST.map(
    (t) => ({
      label: t.label,
      click: () => send('theme:' + t.key)
    })
  )

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        { label: '新建', accelerator: 'CmdOrCtrl+N', click: () => send('new') },
        { label: '打开…', accelerator: 'CmdOrCtrl+O', click: () => send('open') },
        { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => send('save') },
        {
          label: '另存为…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => send('saveAs')
        },
        { type: 'separator' },
        { label: '关闭标签', accelerator: 'CmdOrCtrl+W', click: () => send('closeTab') },
        { label: '下一个标签', accelerator: 'CmdOrCtrl+Tab', click: () => send('nextTab') },
        { label: '上一个标签', accelerator: 'CmdOrCtrl+Shift+Tab', click: () => send('prevTab') },
        { type: 'separator' },
        { label: '最近打开', submenu: recentSubmenu },
        { type: 'separator' },
        { label: '导出 HTML', click: () => send('exportHtml') },
        { label: '导出 PDF', click: () => send('exportPdf') }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '搜索 / 替换', accelerator: 'CmdOrCtrl+F', click: () => send('search') },
        { label: '复制为 HTML', click: () => send('copyHtml') }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '专注模式', click: () => send('toggleFocus') },
        { label: '打字机模式', click: () => send('toggleTypewriter') },
        { label: '主题', submenu: themeSubmenu },
        { label: '切换主题', accelerator: 'CmdOrCtrl+T', click: () => send('toggleTheme') },
        { label: '放大', accelerator: 'CmdOrCtrl+=', click: () => send('zoomIn') },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', click: () => send('zoomOut') }
      ]
    },
    {
      label: '帮助',
      submenu: [{ label: '关于', click: () => send('about') }]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ---------- 窗口 ----------
function getAppIcon(): string {
  // 打包后图标随 extraResources 落到 resources/icon.ico；开发态指向项目根 resources/
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(app.getAppPath(), 'resources', 'icon.ico')
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 800,
    minHeight: 600,
    title: APP_NAME,
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  mainWin = win

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // 阻止在应用内跳转到外部链接
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win.webContents.getURL()) e.preventDefault()
  })

  buildMenu(win)
  return win
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
