import { useApp } from '../AppContext'
import { APP_NAME, THEME_LIST } from '../../shared/constants'

interface Props {
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
  onExportHtml: () => void
  onExportPdf: () => void
  onSearch: () => void
}

export default function TopBar(p: Props) {
  const { theme, toggleTheme, zoom, setZoom } = useApp()
  const themeLabel = THEME_LIST.find((t) => t.key === theme)?.label ?? theme
  return (
    <header className="top-bar">
      <div className="brand">📝 {APP_NAME}</div>
      <div className="toolbar">
        <button onClick={p.onNew} title="新建 (Ctrl+N)">
          新建
        </button>
        <button onClick={p.onOpen} title="打开 (Ctrl+O)">
          打开
        </button>
        <button onClick={p.onSave} title="保存 (Ctrl+S)">
          保存
        </button>
        <button onClick={p.onSaveAs} title="另存为">
          另存为
        </button>
        <span className="divider" />
        <button onClick={p.onExportHtml}>导出 HTML</button>
        <button onClick={p.onExportPdf}>导出 PDF</button>
        <span className="divider" />
        <button onClick={p.onSearch} title="搜索 (Ctrl+F)">
          搜索
        </button>
        <button
          onClick={() => setZoom(Math.max(0.5, +(zoom - 0.1).toFixed(2)))}
          title="缩小"
        >
          －
        </button>
        <button
          onClick={() => setZoom(Math.min(2, +(zoom + 0.1).toFixed(2)))}
          title="放大"
        >
          ＋
        </button>
        <span className="divider" />
        <button onClick={toggleTheme} title="切换主题 (Ctrl+T)">
          🎨 {themeLabel}
        </button>
      </div>
    </header>
  )
}
