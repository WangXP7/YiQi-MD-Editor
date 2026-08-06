import { useState } from 'react'
import { EditorView } from '@codemirror/view'
import { useApp } from '../AppContext'

interface Props {
  view: EditorView | null
  onClose: () => void
}

export default function SearchPanel({ view, onClose }: Props) {
  const { setContent } = useApp()
  const [q, setQ] = useState('')
  const [r, setR] = useState('')
  const [info, setInfo] = useState('')

  function select(from: number, len: number) {
    if (!view) return
    view.dispatch({
      selection: { anchor: from, head: from + len },
      scrollIntoView: true
    })
    view.focus()
  }

  function findNext(from?: number) {
    if (!view || !q) return
    const text = view.state.doc.toString()
    const start = from ?? view.state.selection.main.head + 1
    let idx = text.indexOf(q, start)
    if (idx < 0) idx = text.indexOf(q, 0)
    if (idx < 0) {
      setInfo('未找到')
      return
    }
    select(idx, q.length)
    setInfo(`匹配位置 ${idx}`)
  }

  function replaceOne() {
    if (!view || !q) return
    const sel = view.state.selection.main
    const selText = view.state.sliceDoc(sel.from, sel.to)
    if (selText === q) {
      view.dispatch(view.state.replaceSelection(r))
      setInfo('已替换')
    } else {
      findNext()
    }
  }

  function replaceAll() {
    if (!view || !q) return
    const text = view.state.doc.toString()
    let count = 0
    const next = text.replaceAll(q, () => {
      count++
      return r
    })
    if (count > 0) {
      setContent(next)
      setInfo(`已替换 ${count} 处`)
    } else {
      setInfo('未找到匹配')
    }
  }

  return (
    <div className="search-panel">
      <input
        placeholder="查找"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') findNext()
        }}
        autoFocus
      />
      <button onClick={() => findNext()}>下一个</button>
      <input placeholder="替换为" value={r} onChange={(e) => setR(e.target.value)} />
      <button onClick={replaceOne}>替换</button>
      <button onClick={replaceAll}>全部替换</button>
      <span className="muted">{info}</span>
      <button onClick={onClose}>关闭</button>
    </div>
  )
}
