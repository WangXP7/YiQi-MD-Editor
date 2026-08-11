import type { DocTab, UnsavedChoice } from '../../shared/types'

interface Props {
  /** 触发关闭的未保存标签 */
  tab: DocTab
  /** 选择：保存后关闭 */
  onSave: () => void
  /** 选择：不保存直接关闭 */
  onDiscard: () => void
  /** 选择：取消关闭 */
  onCancel: () => void
}

/**
 * 关闭未保存标签的三选一模态（渲染层，主题化）。
 * 点击遮罩等同于「取消」。
 */
export default function UnsavedDialog({ tab, onSave, onDiscard, onCancel }: Props) {
  const choice = (c: UnsavedChoice) => (e: React.MouseEvent) => {
    e.stopPropagation()
    if (c === 'save') onSave()
    else if (c === 'discard') onDiscard()
    else onCancel()
  }
  return (
    <div className="about-overlay" onClick={onCancel} role="presentation">
      <div
        className="about-card unsaved-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="未保存的更改"
      >
        <h2>未保存的更改</h2>
        <p>
          文件 <strong>{tab.fileName}</strong> 尚有未保存的修改，是否保存后再关闭？
        </p>
        <div className="unsaved-actions">
          <button type="button" className="unsaved-save" onClick={choice('save')}>
            保存
          </button>
          <button type="button" className="unsaved-discard" onClick={choice('discard')}>
            不保存
          </button>
          <button type="button" className="unsaved-cancel" onClick={choice('cancel')}>
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
