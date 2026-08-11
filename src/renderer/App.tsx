import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorView } from '@codemirror/view'
import TopBar from './components/TopBar'
import EditorPane from './components/EditorPane'
import PreviewPane from './components/PreviewPane'
import Sidebar from './components/Sidebar'
import StatusBar from './components/StatusBar'
import SearchPanel from './components/SearchPanel'
import AboutDialog from './components/AboutDialog'
import UnsavedDialog from './components/UnsavedDialog'
import { AppContext } from './AppContext'
import {
  useTheme,
  useAutoSave,
  useRecentFiles,
  useWordCount,
  useToc,
  useScrollSpy
} from './hooks'
import { parseFrontmatter } from './lib/frontmatter'
import { buildExportDocument } from './lib/exporter'
import { getDir } from './lib/imagePaste'
import { copyText, copyTextSafe } from './lib/clipboard'
import { scrollPreviewToId } from './lib/tocNav'
import CopyableBlock from './components/CopyableBlock'
import { APP_NAME } from '../shared/constants'
import type { DocTab, UnsavedChoice } from '../shared/types'

const DRAFT_KEY = 'md-editor:autosave:untitled'

// 生成唯一标签 id（兼容无 crypto.randomUUID 的环境）
function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'tab-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// 转义预览区锚点选择器
function cssEscape(id: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(id)
  return id.replace(/([^\w-])/g, '\\$1')
}

export default function App() {
  // 初始标签（含未保存草稿恢复）
  const initialRef = useRef<{ tabs: DocTab[]; activeId: string }>()
  if (!initialRef.current) {
    const id = makeId()
    let initialContent =
      `# 欢迎使用 ${APP_NAME}\n\n左侧编辑，右侧实时预览。\n\n- 支持 **GFM 表格**、*删除线*、~~任务列表~~\n- 支持 $E=mc^2$ 数学公式与 Mermaid 图\n`
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null')
      if (d && typeof d.content === 'string') initialContent = d.content
    } catch {
      /* ignore */
    }
    initialRef.current = {
      tabs: [{ id, filePath: null, fileName: 'untitled.md', content: initialContent, dirty: false }],
      activeId: id
    }
  }

  const [tabs, setTabs] = useState<DocTab[]>(initialRef.current.tabs)
  const [activeTabId, setActiveTabId] = useState<string>(initialRef.current.activeId)
  const [sync, setSync] = useState<{
    activeId: string | null
    locked: boolean
    lastSource: 'editor' | 'preview' | 'toc'
  }>({ activeId: null, locked: false, lastSource: 'preview' })
  const [unsavedTabId, setUnsavedTabId] = useState<string | null>(null)

  const [zoom, setZoom] = useState<number>(1)
  const [searchOpen, setSearchOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [typewriterMode, setTypewriterMode] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [copyErrMsg, setCopyErrMsg] = useState<string | null>(null)

  const editorViewRef = useRef<EditorView | null>(null)
  const [editorScrollEl, setEditorScrollEl] = useState<HTMLElement | null>(null)
  const [previewEl, setPreviewEl] = useState<HTMLDivElement | null>(null)
  const previewContainerRef = useRef<HTMLDivElement | null>(null)

  // 同步 refs（供事件回调读取最新值，避免闭包陈旧）
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs
  const activeTabIdRef = useRef(activeTabId)
  activeTabIdRef.current = activeTabId
  const unsavedTabIdRef = useRef(unsavedTabId)
  unsavedTabIdRef.current = unsavedTabId

  const { theme, setTheme, toggleTheme } = useTheme()
  const { recents, add, clear } = useRecentFiles()

  // 当前激活标签（由 tabs + activeTabId 派生）
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0]
  const content = activeTab?.content ?? ''
  const filePath = activeTab?.filePath ?? null
  const fileName = activeTab?.fileName ?? 'untitled.md'
  const dirty = activeTab?.dirty ?? false

  const wordCount = useWordCount(content)
  const toc = useToc(content)
  const frontmatter = useMemo(() => parseFrontmatter(content).data, [content])
  useAutoSave(content, filePath)

  const toggleFocusMode = useCallback(() => setFocusMode((v) => !v), [])
  const toggleTypewriterMode = useCallback(() => setTypewriterMode((v) => !v), [])

  // 轻量错误提示（可复制长错误文案），4s 后自动消失
  const showError = useCallback((msg: string) => {
    setErrorMsg(msg)
    window.setTimeout(() => {
      setErrorMsg((cur) => (cur === msg ? null : cur))
    }, 4000)
  }, [])

  // 复制失败全局轻提示（CopyButton 失败时会派发 'copy-failed' 事件）
  useEffect(() => {
    const handler = () => {
      setCopyErrMsg('复制失败，请重试')
      window.setTimeout(() => setCopyErrMsg((cur) => (cur ? null : cur)), 2500)
    }
    window.addEventListener('copy-failed', handler as EventListener)
    return () => window.removeEventListener('copy-failed', handler as EventListener)
  }, [])

  // 统一窗口标题：文件名 — APP_NAME（随激活标签变化）
  useEffect(() => {
    window.api.setTitle((fileName || 'untitled.md') + ' — ' + APP_NAME)
  }, [fileName])

  // ---- 标签内容更新（按 activeTab 生效） ----
  const setContent = useCallback((v: string) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabIdRef.current ? { ...t, content: v, dirty: true } : t
      )
    )
  }, [])

  // ---- 文件操作 ----
  const openFile = useCallback(async () => {
    const r = await window.api.openFile()
    if (!r) return
    const existing = tabsRef.current.find((t) => t.filePath === r.path)
    if (existing) {
      setActiveTabId(existing.id)
      return
    }
    const id = makeId()
    setTabs((prev) => [
      ...prev,
      { id, filePath: r.path, fileName: r.name, content: r.content, dirty: false }
    ])
    setActiveTabId(id)
    add({ path: r.path, name: r.name, mtime: Date.now() })
  }, [add])

  const openByPath = useCallback(
    async (p: string) => {
      const r = await window.api.openByPath(p)
      if ('error' in r) {
        showError('文件不存在或已被移动：' + p)
        return
      }
      const existing = tabsRef.current.find((t) => t.filePath === r.path)
      if (existing) {
        setActiveTabId(existing.id)
        return
      }
      const id = makeId()
      setTabs((prev) => [
        ...prev,
        { id, filePath: r.path, fileName: r.name, content: r.content, dirty: false }
      ])
      setActiveTabId(id)
      add({ path: r.path, name: r.name, mtime: Date.now() })
    },
    [add, showError]
  )

  const saveFile = useCallback(async () => {
    const tab = tabsRef.current.find((t) => t.id === activeTabIdRef.current)
    if (!tab) return
    const res = await window.api.saveFile(tab.filePath, tab.content)
    if (res.saved) {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tab.id
            ? { ...t, filePath: res.path || t.filePath, fileName: res.name || t.fileName, dirty: false }
            : t
        )
      )
      if (res.path) add({ path: res.path, name: res.name!, mtime: Date.now() })
    }
  }, [add])

  const saveAs = useCallback(async () => {
    const tab = tabsRef.current.find((t) => t.id === activeTabIdRef.current)
    if (!tab) return
    const res = await window.api.saveFileAs(tab.content)
    if (res.saved && res.path) {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tab.id
            ? { ...t, filePath: res.path, fileName: res.name || t.fileName, dirty: false }
            : t
        )
      )
      add({ path: res.path, name: res.name!, mtime: Date.now() })
    }
  }, [add])

  const newFile = useCallback(() => {
    const id = makeId()
    setTabs((prev) => [
      ...prev,
      { id, filePath: null, fileName: 'untitled.md', content: '', dirty: false }
    ])
    setActiveTabId(id)
  }, [])

  const switchTab = useCallback((id: string) => {
    // 保存当前激活标签的视图位置（滚动 / 光标）
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === activeTabIdRef.current) {
          const view = editorViewRef.current
          return {
            ...t,
            viewState: view
              ? {
                  scrollTop: view.scrollDOM.scrollTop,
                  cursor: view.state.selection.main.head
                }
              : t.viewState
          }
        }
        return t
      })
    )
    setActiveTabId(id)
  }, [])

  const removeTab = useCallback((id: string) => {
    const cur = tabsRef.current
    let next = cur.filter((t) => t.id !== id)
    let newActive: string
    if (next.length === 0) {
      // 保留一个空白 untitled.md 标签，不关闭窗口（PRD §八 Q1）
      const blankId = makeId()
      next = [{ id: blankId, filePath: null, fileName: 'untitled.md', content: '', dirty: false }]
      newActive = blankId
    } else {
      newActive =
        id === activeTabIdRef.current ? next[next.length - 1].id : activeTabIdRef.current
    }
    setTabs(next)
    setActiveTabId(newActive)
  }, [])

  const closeTab = useCallback(
    (id: string) => {
      const tab = tabsRef.current.find((t) => t.id === id)
      if (!tab) return
      if (tab.dirty) {
        setUnsavedTabId(id)
        return
      }
      removeTab(id)
    },
    [removeTab]
  )

  const resolveUnsaved = useCallback(
    (choice: UnsavedChoice) => {
      const id = unsavedTabIdRef.current
      setUnsavedTabId(null)
      if (choice === 'cancel' || id == null) return
      if (choice === 'discard') {
        removeTab(id)
        return
      }
      // 保存后关闭
      const tab = tabsRef.current.find((t) => t.id === id)
      if (!tab) return
      window.api.saveFile(tab.filePath, tab.content).then((res) => {
        if (res.saved) {
          if (res.path) {
            setTabs((prev) =>
              prev.map((t) =>
                t.id === id
                  ? { ...t, filePath: res.path || t.filePath, fileName: res.name || t.fileName }
                  : t
              )
            )
          }
          removeTab(id)
        }
        // 保存被取消（res.saved === false）则保留标签，等效取消
      })
    },
    [removeTab]
  )

  // ---- 大纲联动：编辑区行定位 + 预览区锚点滚动 ----
  const navigateToc = useCallback(
    (tocId: string) => {
      const item = toc.find((t) => t.id === tocId)
      if (!item) {
        showError('该标题已失效，请刷新大纲')
        return
      }
      setSync((prev) => ({ ...prev, locked: true, lastSource: 'toc' }))
      const view = editorViewRef.current
      if (view) {
        const pos = view.state.doc.line(Math.min(item.line + 1, view.state.doc.lines)).from
        // CodeMirror 6：scrollIntoView 为静态方法，需作为 effect 下发，
        // 同时设置选区锚点并滚动到章节顶部。
        view.dispatch({
          selection: { anchor: pos },
          effects: EditorView.scrollIntoView(pos, { y: 'start' })
        })
      }
      const container = previewContainerRef.current
      if (container) {
        scrollPreviewToId(container, tocId)
      }
      window.setTimeout(() => setSync((prev) => ({ ...prev, locked: false })), 350)
    },
    [toc, showError]
  )

  // ---- 复制为 HTML（失败回退纯文本，再失败提示） ----
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
      const ok = await copyTextSafe(text)
      if (!ok) showError('复制失败，请重试')
    }
  }, [showError])

  const getPreviewHtml = useCallback(() => {
    const el = document.querySelector('.markdown-body')
    return el ? el.innerHTML : ''
  }, [])

  const exportHtml = useCallback(async () => {
    const html = buildExportDocument(getPreviewHtml(), theme)
    await window.api.exportHtml(html, (fileName || 'document').replace(/\.md$/i, '') + '.html')
  }, [theme, fileName])

  const exportPdf = useCallback(async () => {
    const html = buildExportDocument(getPreviewHtml(), theme)
    await window.api.exportPdf(html)
  }, [theme])

  // ---- 菜单动作处理 ----
  const handleMenuAction = useCallback(
    (action: string) => {
      if (action.startsWith('openRecent:')) {
        const p = decodeURIComponent(action.slice('openRecent:'.length))
        openByPath(p)
        return
      }
      if (action.startsWith('theme:')) {
        setTheme(action.slice('theme:'.length) as any)
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
        case 'closeTab':
          closeTab(activeTabIdRef.current)
          break
        case 'nextTab': {
          const list = tabsRef.current
          const i = list.findIndex((t) => t.id === activeTabIdRef.current)
          const next = list[(i + 1) % list.length]
          if (next) switchTab(next.id)
          break
        }
        case 'prevTab': {
          const list = tabsRef.current
          const i = list.findIndex((t) => t.id === activeTabIdRef.current)
          const prev = list[(i - 1 + list.length) % list.length]
          if (prev) switchTab(prev.id)
          break
        }
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
      clear,
      closeTab,
      switchTab
    ]
  )

  useEffect(() => {
    const off = window.api.onMenuAction(handleMenuAction)
    return off
  }, [handleMenuAction])

  // ---- 拖拽打开 / 图片拖入 ----
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const isImage =
      file.type.startsWith('image/') ||
      /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name)
    if (isImage) {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
      const base64 = btoa(binary)
      const mdDir = getDir(activeTab.filePath)
      const res = await window.api.saveImage(base64, file.name || 'image.png', mdDir)
      setContent((activeTab.content || '') + `\n![](${res.relativePath})\n`)
      return
    }
    if (!/\.(md|markdown|txt)$/i.test(file.name)) return
    const text = await file.text()
    const name = file.name
    const id = makeId()
    setTabs((prev) => [
      ...prev,
      { id, filePath: (file as any).path || null, fileName: name, content: text, dirty: false }
    ])
    setActiveTabId(id)
    if ((file as any).path) {
      add({ path: (file as any).path, name, mtime: Date.now() })
    }
  }

  // ---- scroll-spy：预览区 / 编辑区滚动时高亮当前章节 ----
  const handleActiveToc = useCallback(
    (id: string | null) => {
      setSync((prev) =>
        prev.locked ? prev : prev.activeId === id ? prev : { ...prev, activeId: id }
      )
    },
    []
  )

  useScrollSpy(
    previewEl,
    toc,
    () => previewEl?.scrollTop ?? 0,
    (id) => {
      const el = previewEl?.querySelector('#' + cssEscape(id)) as HTMLElement | null
      return el ? el.offsetTop : null
    },
    handleActiveToc,
    sync.locked
  )

  useScrollSpy(
    editorScrollEl,
    toc,
    () => {
      const view = editorViewRef.current
      if (!view) return 0
      const top = Math.min(view.scrollDOM.scrollTop, view.scrollDOM.scrollHeight)
      const from = view.lineBlockAt(top).from
      return view.state.doc.lineAt(from).number - 1
    },
    (id) => {
      const item = toc.find((t) => t.id === id)
      return item ? item.line : null
    },
    handleActiveToc,
    sync.locked
  )

  const unsavedTab = unsavedTabId ? tabs.find((t) => t.id === unsavedTabId) ?? null : null

  const ctx = {
    tabs,
    activeTabId,
    activeTab,
    sync,
    unsavedTabId,
    openFile,
    newFile,
    switchTab,
    closeTab,
    navigateToc,
    resolveUnsaved,
    content,
    setContent,
    filePath,
    fileName,
    dirty,
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
            <EditorPane
              onViewChange={(v) => {
                editorViewRef.current = v
                setEditorScrollEl(v?.scrollDOM ?? null)
              }}
            />
            <PreviewPane
              containerRef={(el: HTMLDivElement | null) => {
                previewContainerRef.current = el
                setPreviewEl(el)
              }}
            />
          </div>
        </div>
        <StatusBar />
        {searchOpen && (
          <SearchPanel view={editorViewRef.current} onClose={() => setSearchOpen(false)} />
        )}
        {aboutOpen && (
          <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
        )}
        {unsavedTab && (
          <UnsavedDialog
            tab={unsavedTab}
            onSave={() => resolveUnsaved('save')}
            onDiscard={() => resolveUnsaved('discard')}
            onCancel={() => resolveUnsaved('cancel')}
          />
        )}
        {errorMsg && (
          <div className="error-toast" role="alert">
            <CopyableBlock text={errorMsg}>
              <span>{errorMsg}</span>
            </CopyableBlock>
            <button
              type="button"
              className="error-toast-close"
              onClick={() => setErrorMsg(null)}
              aria-label="关闭提示"
              title="关闭"
            >
              ×
            </button>
          </div>
        )}
        {copyErrMsg && (
          <div className="copy-toast" role="alert">
            {copyErrMsg}
          </div>
        )}
      </div>
    </AppContext.Provider>
  )
}
