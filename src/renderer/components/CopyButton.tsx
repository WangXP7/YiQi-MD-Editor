import { useCallback, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { copyText } from '../lib/clipboard'

interface CopyButtonProps {
  /** 要复制的纯文本 */
  text: string
  /** 无障碍标签，默认 “复制” */
  label?: string
  /** 额外的 className */
  className?: string
}

/**
 * 悬浮圆形复制按钮：悬浮容器时出现，点击写入剪贴板，
 * 成功后短暂变为「✓」反馈（1.5s 自动复位），失败静默回退。
 */
export default function CopyButton({
  text,
  label = '复制',
  className = ''
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)

  const handleClick = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      try {
        await copyText(text)
        setCopied(true)
        if (timer.current) window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setCopied(false), 1500)
      } catch {
        /* 复制失败静默处理 */
      }
    },
    [text]
  )

  return (
    <button
      type="button"
      className={`copy-btn${copied ? ' copied' : ''}${className ? ' ' + className : ''}`}
      onClick={handleClick}
      aria-label={copied ? '已复制' : label}
      title={copied ? '已复制 ✓' : label}
    >
      {copied ? '✓' : '📋'}
    </button>
  )
}
