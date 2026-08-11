import type { MouseEvent } from 'react'
import { useApp } from '../AppContext'

/**
 * 顶部多标签栏：渲染所有打开的文档标签。
 * - 文件名（过长由 CSS 截断），脏标记由 .dirty 样式显示 `*`。
 * - 点击切换；点击关闭按钮 / 中键关闭。
 * - 标签过多时横向滚动（overflow-x:auto），不挤压 TopBar。
 */
export default function TabBar() {
  const { tabs, activeTabId, switchTab, closeTab } = useApp()

  function handleAuxClick(e: MouseEvent, id: string) {
    // 中键关闭
    if (e.button === 1) {
      e.preventDefault()
      closeTab(id)
    }
  }

  return (
    <div className="tab-bar" role="tablist" aria-label="文档标签">
      {tabs.map((t) => {
        const isActive = t.id === activeTabId
        const cls = [
          'tab',
          isActive ? 'active' : '',
          t.dirty ? 'dirty' : ''
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <div
            key={t.id}
            className={cls}
            role="tab"
            aria-selected={isActive}
            title={t.filePath ?? t.fileName}
            onClick={() => switchTab(t.id)}
            onAuxClick={(e) => handleAuxClick(e, t.id)}
          >
            <span className="tab-name">{t.fileName}</span>
            <button
              type="button"
              className="tab-close"
              title="关闭标签"
              aria-label={`关闭 ${t.fileName}`}
              onClick={(e) => {
                e.stopPropagation()
                closeTab(t.id)
              }}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
