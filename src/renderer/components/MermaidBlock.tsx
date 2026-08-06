import { useEffect, useRef, useState, useId } from 'react'
import mermaid from 'mermaid'
import { useApp } from '../AppContext'

export default function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const rawId = useId()
  const id = 'm' + rawId.replace(/[^a-zA-Z0-9]/g, '')
  const { theme } = useApp()
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose'
    })
    mermaid
      .render(id, code)
      .then(({ svg }) => {
        if (active && ref.current) ref.current.innerHTML = svg
      })
      .catch((e) => {
        if (active)
          setErr(typeof e === 'string' ? e : String((e as Error)?.message || e))
      })
    return () => {
      active = false
    }
  }, [code, theme, id])

  if (err) return <pre className="mermaid-error">Mermaid 渲染错误: {err}</pre>
  return <div className="mermaid-block" ref={ref} />
}
