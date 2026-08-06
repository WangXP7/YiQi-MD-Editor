import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorView } from '@codemirror/view'
import TopBar from './components/TopBar'
import EditorPane from './components/EditorPane'
import PreviewPane from './components/PreviewPane'
import Sidebar from './components/Sidebar'
import StatusBar from './components/StatusBar'
import SearchPanel from './components/SearchPanel'
import AboutDialog from './components/AboutDialog'
import { AppContext } from './AppContext'
import { useTheme, useAutoSave, useRecentFiles, useWordCount, useToc } from './hooks'
import { parseFrontmatter } from './lib/frontmatter'
import { buildExportDocument } from './lib/exporter'
import { getDir } from './lib/imagePaste'
import { APP_NAME } from '../shared/constants'
import type { ThemeName } from '../shared/types'

const DRAFT_KEY = 'md-editor:autosave:untitled'

export default function App() {
  const [content, setContent] = useState<string>(() => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null')
      if (d && typeof d.content === 'string') return d.content
    } catch {
      /* ignore */
    }
    return `# 欢迎使用 ${APP_NAME}\n\n左侧编辑，右侧实时预览。\n\n- 支持 **GFM 表格**、*删除线*、~~任务列表~~\n- 支持 $E=mc^2$ 数学公式与 Mermaid 图\n`
  })
  const [filePath, setFilePath] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>('untitled.md')
  const [dirty, setDirty] = useState<boolean>(false)
  const [zoom, setZoom] = useState<number>(1)
  const [searchOpen, setSearchOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [typewriterMode, setTypewriterMode] = useState(false)
  const editorViewRef = useRef<EditorView | null>(null)

  const { theme, setTheme, toggleTheme } = useTheme()
  const { recents, add, clear } = useRecentFiles()
  const wordCount = useWordCount(content)
  const toc = useToc(content)
  const frontmatter = useMemo(() => parseFrontmatter(content).data, [content])
  useAutoSave(content, filePath)

  const toggleFocusMode = useCallback(() => setFocusMode((v) => !v), [])
  const toggleTypewriterMode = useCallback(() => setTypewriterMode((v) => !v), [])

  const updateContent = useCallback((v: string) => {
    setContent(v)
    setDirty(true)
  }, [])

  // 统一窗口标题：文件名 — APP_NAME
  const updateWinTitle = useCallback(
    (name?: string) => {
      const n = name ?? fileName
      window.api.setTitle((n || 'untitled.md') + ' — ' + APP_NAME)
    },
    [fileName]
  )

  const openFile = useCallback(async () => {
    const r = await window.api.openFile()
    if (!r) return
    setContent(r.content)
    setFilePath(r.path)
    setFileName(r.name)
    setDirty(false)
    add({ path: r.path, name: r.name, mtime: Date.now() })
    updateWinTitle(r.name)
  }, [add, updateWinTitle])

  const openByPath = useCallback(
    async (p: string) => {
      const r = await window.api.openByPath(p)
      if ('error' in r) {
        alert('文件不存在或已被移动：' + p)
        return
      }
      setContent(r.content)
      setFilePath(r.path)
      setFileName(r.name)
      setDirty(false)
      add({ path: r.path, name: r.name, mtime: Date.now() })
      updateWinTitle(r.name)
    },
    [add, updateWinTitle]
  )

  const saveFile = useCallback(async () => {
    const res = await window.api.saveFile(filePath, content)
    if (res.saved) {
      setFilePath(res.path || filePath)
      setFileName(res.name || fileName)
      setDirty(false)
      if (res.path) add({ path: res.path, name: res.name!, mtime: Date.now() })
      updateWinTitle(res.name || fileName)
    }
  }, [filePath, content, fileName, add, updateWinTitle])

  const saveAs = useCallback(async () => {
    const res = await window.api.saveFileAs(content)
    if (res.saved && res.path) {
      setFilePath(res.path)
      setFileName(res.name || fileName)
      setDirty(false)
      add({ path: res.path, name: res.name!, mtime: Date.now() })
      updateWinTitle(res.name || fileName)
    }
  }, [content, fileName, add, updateWinTitle])

  const newFile = useCallback(() => {
    setContent('')
    setFilePath(null)
    setFileName('untitled.md')
    setDirty(false)
    updateWinTitle('untitled.md')
  }, [updateWinTitle])

  const getPreviewHtml = () => {
    const el = document.querySelector('.markdown-body')
    return el ? el.innerHTML : ''
  }

  const copyHtml = useCallback(async () => {
    const el = document.querySelector('.markdown-body')
    if (!el) return
    const html = el.innerHTML
    const text = el.textContent || ''
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' })
        })
      ])
    } catch {
      // 回退：仅复制纯文本
      try {
        await navigator.clipboard.writeText(text)
      } catch {
        /* ignore */
      }
    }
  }, [])

  const exportHtml = useCallback(async () => {
    const html = buildExportDocument(getPreviewHtml(), theme)
    await window.api.exportHtml(
      html,
      (fileName || 'document').replace(/\.md$/i, '') + '.html'
    )
  }, [theme, fileName])

  const exportPdf = useCallback(async () => {
    const html = buildExportDocument(getPreviewHtml(), theme)
    await window.api.exportPdf(html)
  }, [theme])

  const handleMenuAction = useCallback(
    (action: string) => {
      // 动态前缀解析：最近打开
      if (action.startsWith('openRecent:')) {
        const p = decodeURIComponent(action.slice('openRecent:'.length))
        openByPath(p)
        return
      }
      // 动态前缀解析：主题切换
      if (action.startsWith('theme:')) {
        setTheme(action.slice('theme:'.length) as ThemeName)
        return
      }
      switch (action) {
        case 'new':
          newFile()
          break
        case 'open':
          openFile()
          break
        case 'save':
          saveFile()
          break
        case 'saveAs':
          saveAs()
          break
        case 'exportHtml':
          exportHtml()
          break
        case 'exportPdf':
          exportPdf()
          break
        case 'toggleTheme':
          toggleTheme()
          break
        case 'toggleFocus':
          toggleFocusMode()
          break
        case 'toggleTypewriter':
          toggleTypewriterMode()
          break
        case 'copyHtml':
          copyHtml()
          break
        case 'clearRecents':
          clear()
          break
        case 'zoomIn':
          setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))
          break
        case 'zoomOut':
          setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))
          break
        case 'search':
          setSearchOpen(true)
          break
        case 'about':
          setAboutOpen(true)
          break
      }
    },
    [
      openByPath,
      setTheme,
      newFile,
      openFile,
      saveFile,
      saveAs,
      exportHtml,
      exportPdf,
      toggleTheme,
      toggleFocusMode,
      toggleTypewriterMode,
      copyHtml,
      clear
    ]
  )

  useEffect(() => {
    const off = window.api.onMenuAction(handleMenuAction)
    return off
  }, [handleMenuAction])

  // 初始化窗口标题
  useEffect(() => {
    updateWinTitle()
  }, [])

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    // 图片分支：拖入图片 → 落盘并返回相对引用
    const isImage =
      file.type.startsWith('image/') ||
      /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name)
    if (isImage) {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
      const base64 = btoa(binary)
      const mdDir = getDir(filePath)
      const res = await window.api.saveImage(base64, file.name || 'image.png', mdDir)
      updateContent((content || '') + `\n![](${res.relativePath})\n`)
      return
    }
    // Markdown 分支：原误用 file.name 写入 recents，改为绝对路径 file.path
    if (!/\.(md|markdown|txt)$/i.test(file.name)) return
    const text = await file.text()
    setContent(text)
    setFilePath(null)
    setFileName(file.name)
    setDirty(false)
    add({ path: file.path, name: file.name, mtime: Date.now() })
    updateWinTitle(file.name)
  }

  const ctx = {
    content,
    setContent: updateContent,
    filePath,
    setFilePath,
    fileName,
    setFileName,
    dirty,
    setDirty,
    theme,
    setTheme,
    toggleTheme,
    focusMode,
    typewriterMode,
    toggleFocusMode,
    toggleTypewriterMode,
    aboutOpen,
    zoom,
    setZoom,
    recents,
    addRecent: add,
    clearRecents: clear,
    toc,
    frontmatter,
    wordCount,
    searchOpen,
    setSearchOpen
  }

  return (
    <AppContext.Provider value={ctx}>
      <div
        className="app"
        style={{ fontSize: `${zoom}em` }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <TopBar
          onNew={newFile}
          onOpen={openFile}
          onSave={saveFile}
          onSaveAs={saveAs}
          onExportHtml={exportHtml}
          onExportPdf={exportPdf}
          onSearch={() => setSearchOpen(true)}
        />
        <div className="body">
          <Sidebar />
          <div className="panes">
            <EditorPane onViewChange={(v) => (editorViewRef.current = v)} />
            <PreviewPane />
          </div>
        </div>
        <StatusBar />
        {searchOpen && (
          <SearchPanel
            view={editorViewRef.current}
            onClose={() => setSearchOpen(false)}
          />
        )}
        {aboutOpen && (
          <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
        )}
      </div>
    </AppContext.Provider>
  )
}
