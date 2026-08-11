import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { copyText } from '../lib/clipboard'

interface CopyButtonProps {
  /** 要复制的纯文本 */
  text: string
  /** 无障碍标签，默认 “复制” */
  label?: string
  /** 额外的 className */
  className?: string
  /** 复制失败时的回调（用于全局轻提示 / toast） */
  onError?: () => void
}

/**
 * 悬浮圆形复制按钮：悬浮容器时出现，点击写入剪贴板，
 * 成功后短暂变为「✓」反馈（1.5s 自动复位），失败置「失败」态并触发 onError。
 * 文本为空 / 纯空白时按钮隐藏（避免复制空串）。
 */
export default function CopyButton({
  text,
  label = '复制',
  className = '',
  onError
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)
  const timer = useRef<number | null>(null)

  // 空文本：隐藏按钮（不渲染）
  const isEmpty = text.trim().length === 0
  useEffect(() => {
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current)
    }
  }, [])

  const handleClick = useCallback(
    async (e: MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      if (isEmpty) return
      try {
        await copyText(text)
        setFailed(false)
        setCopied(true)
        if (timer.current != null) window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setCopied(false), 1500)
      } catch {
        setFailed(true)
        setCopied(false)
        onError?.()
        // 通知全局监听（App 在此弹出 copy-toast 轻提示）
        window.dispatchEvent(new Event('copy-failed'))
        if (timer.current != null) window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setFailed(false), 2000)
      }
    },
    [text, isEmpty, onError]
  )

  if (isEmpty) return null

  const cls = [
    'copy-btn',
    copied ? 'copied' : '',
    failed ? 'failed' : '',
    className
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={cls}
      onClick={handleClick}
      aria-label={copied ? '已复制' : failed ? '复制失败' : label}
      title={failed ? '复制失败，请重试' : copied ? '已复制 ✓' : label}
    >
      {copied ? '✓' : failed ? '!' : '📋'}
    </button>
  )
}
