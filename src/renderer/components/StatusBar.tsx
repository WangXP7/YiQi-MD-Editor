import { useApp } from '../AppContext'

export default function StatusBar() {
  const { wordCount, dirty, filePath, fileName, zoom, focusMode, typewriterMode } =
    useApp()
  return (
    <footer className="status-bar">
      <span className={dirty ? 'dirty' : 'saved'}>
        {dirty ? '● 未保存' : '✓ 已保存'}
      </span>
      <span className="muted">{fileName}</span>
      <span>{wordCount} 字</span>
      <span>缩放 {Math.round(zoom * 100)}%</span>
      {focusMode && <span className="mode-tag focus">专注</span>}
      {typewriterMode && <span className="mode-tag typewriter">打字</span>}
      <span className="muted grow">{filePath || '未打开文件'}</span>
    </footer>
  )
}
