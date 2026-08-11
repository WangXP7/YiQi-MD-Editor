import type { ReactNode } from 'react'
import CopyButton from './CopyButton'

interface CopyableBlockProps {
  /** 长文本原文（用于复制） */
  text: string
  /** 展示内容 */
  children: ReactNode
  /** 额外的 className，会挂在外层容器上 */
  className?: string
  /** 复制失败时的回调（透传给内部 CopyButton，用于全局轻提示） */
  onError?: () => void
}

/**
 * 只读文本块包裹容器：相对定位，悬浮时右上角浮现复制按钮。
 * 用于关于框描述、状态栏文件路径、错误提示等“展示型”文本。
 * 不影响编辑区（编辑区沿用原生复制）。
 */
export default function CopyableBlock({
  text,
  children,
  className = '',
  onError
}: CopyableBlockProps) {
  return (
    <div className={`copyable-block${className ? ' ' + className : ''}`}>
      <CopyButton text={text} onError={onError} />
      <div className="copyable-block-content">{children}</div>
    </div>
  )
}
