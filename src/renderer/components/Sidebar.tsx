import { useApp } from '../AppContext'

export default function Sidebar() {
  const { toc, frontmatter, sync, navigateToc } = useApp()

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-title">目录</div>
        <ul className="toc-list">
          {toc.map((t) => {
            const isActive = sync.activeId === t.id
            return (
              <li
                key={t.id + t.text}
                className={isActive ? 'active' : ''}
                style={{ paddingLeft: (t.level - 1) * 12 }}
              >
                <a
                  onClick={() => navigateToc(t.id)}
                  title={t.text}
                >
                  {t.text}
                </a>
              </li>
            )
          })}
          {toc.length === 0 && <li className="muted">暂无目录</li>}
        </ul>
      </div>
      <div className="sidebar-section">
        <div className="sidebar-title">文档信息</div>
        {Object.entries(frontmatter || {}).length === 0 ? (
          <div className="muted">（无 Frontmatter）</div>
        ) : (
          <dl className="fm-list">
            {Object.entries(frontmatter).map(([k, v]) => (
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
