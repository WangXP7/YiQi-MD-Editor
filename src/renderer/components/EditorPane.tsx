import { useRef } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView, keymap } from '@codemirror/view'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { useApp } from '../AppContext'
import { saveClipboardImage } from '../lib/imagePaste'

interface Props {
  onViewChange?: (view: EditorView | null) => void
}

export default function EditorPane({ onViewChange }: Props) {
  const { content, setContent, theme, filePath, focusMode, typewriterMode } = useApp()
  const cmRef = useRef<any>(null)

  const extensions = [
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    EditorView.lineWrapping,
    closeBrackets(),
    keymap.of(closeBracketsKeymap)
  ]

  // 打字机模式：光标移动时让活动行在编辑区垂直居中（仅编辑区滚动，不影响预览）
  const typewriterListener = EditorView.updateListener.of((update) => {
    if (!update.selectionSet) return
    const view = update.view
    const head = view.state.selection.main.head
    const block = view.lineBlockAt(head)
    view.scrollDOM.scrollTop =
      block.top + block.height / 2 - view.scrollDOM.clientHeight / 2
  })

  async function handlePaste(e: React.ClipboardEvent) {
    const md = await saveClipboardImage(e.clipboardData?.items || null, filePath)
    if (md) {
      e.preventDefault()
      const view = cmRef.current?.view as EditorView | undefined
      if (view) {
        view.dispatch(view.state.replaceSelection(md))
      } else {
        setContent(content + md)
      }
    }
  }

  // 暗色系主题（dark / graphite / midnight）使用 oneDark，其余使用浅色主题，
  // 保证编辑器配色与当前主题一致（原先仅 dark 走 oneDark，新暗色主题会显示白底）。
  const isDarkTheme = theme === 'dark' || theme === 'graphite' || theme === 'midnight'
  return (
    <div className={'editor-pane' + (focusMode ? ' focus-mode' : '')} onPaste={handlePaste}>
      <CodeMirror
        ref={cmRef}
        value={content}
        height="100%"
        theme={isDarkTheme ? oneDark : 'light'}
        extensions={[...extensions, ...(typewriterMode ? [typewriterListener] : [])]}
        onChange={(v) => setContent(v)}
        onCreateEditor={(view) => onViewChange?.(view)}
        basicSetup={{ lineNumbers: true, foldGutter: true }}
      />
    </div>
  )
}
