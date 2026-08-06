import { useApp } from '../AppContext'

export default function Sidebar() {
  const { toc, frontmatter } = useApp()

  function scrollTo(id: string) {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const fmEntries = Object.entries(frontmatter || {})

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-title">目录</div>
        <ul className="toc-list">
          {toc.map((t) => (
            <li key={t.id + t.text} style={{ paddingLeft: (t.level - 1) * 12 }}>
              <a onClick={() => scrollTo(t.id)}>{t.text}</a>
            </li>
          ))}
          {toc.length === 0 && <li className="muted">（无标题）</li>}
        </ul>
      </div>
      <div className="sidebar-section">
        <div className="sidebar-title">文档信息</div>
        {fmEntries.length === 0 ? (
          <div className="muted">（无 Frontmatter）</div>
        ) : (
          <dl className="fm-list">
            {fmEntries.map(([k, v]) => (
              <div key={k} className="fm-item">
                <dt>{k}</dt>
                <dd>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </aside>
  )
}
