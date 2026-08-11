import { useEffect, useMemo, useRef, useState } from 'react'
import type { RecentFileItem, ThemeName, TocItem } from '../shared/types'
import { THEME_LIST } from '../shared/constants'
import { extractToc } from './lib/toc'
import { computeActiveTocId } from './lib/tocNav'

export function useApi() {
  return window.api
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeName>(() => {
    const saved = localStorage.getItem('md-editor:theme')
    return THEME_LIST.find((t) => t.key === saved)?.key ?? 'light'
  })
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('md-editor:theme', theme)
  }, [theme])
  // 在 THEME_LIST 中循环切换（保留 Ctrl+T 行为）
  const toggleTheme = () =>
    setTheme((t) => {
      const idx = THEME_LIST.findIndex((item) => item.key === t)
      const next = THEME_LIST[(idx + 1) % THEME_LIST.length]
      return next.key
    })
  return { theme, setTheme, toggleTheme }
}

export function useDebounce<T>(value: T, delay = 280): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return v
}

export function useWordCount(content: string): number {
  return useMemo(() => {
    const body = content.replace(/^---[\s\S]*?---/, '')
    const m = body.match(/[一-龥]|[A-Za-z0-9_]+/g)
    return m ? m.length : 0
  }, [content])
}

export function useToc(content: string) {
  return useMemo(() => extractToc(content), [content])
}

/**
 * 自动保存：对传入的 content（当前激活标签内容）与 filePath 生效。
 * - 有 filePath 时按路径持久化；未保存（null）时落到 untitled 草稿键。
 * - 设计上仅保存「当前激活标签」，切换即存上一份。
 */
export function useAutoSave(content: string, filePath: string | null) {
  useEffect(() => {
    const key = filePath
      ? `md-editor:autosave:${filePath}`
      : 'md-editor:autosave:untitled'
    localStorage.setItem(
      key,
      JSON.stringify({ path: filePath, content, ts: Date.now() })
    )
  }, [content, filePath])
}

export function useRecentFiles() {
  const [recents, setRecents] = useState<RecentFileItem[]>([])
  useEffect(() => {
    window.api
      .getRecents()
      .then(setRecents)
      .catch(() => setRecents([]))
  }, [])
  const add = (item: RecentFileItem) =>
    window.api.addRecent(item).then(setRecents)
  const clear = () => window.api.clearRecents().then(setRecents)
  return { recents, add, clear }
}

/**
 * rAF 节流的滚动高亮（scroll-spy）。
 *
 * 监听 target 的 scroll 事件，节流经 requestAnimationFrame，
 * 调用 computeActiveTocId 计算当前可见章节并回调 onActive。
 * - locked 为 true（程序化滚动中）时跳过，避免点击大纲引发监听回环。
 *
 * @param target       绑定 scroll 监听的滚动容器（预览区 DOM / 编辑区 scrollDOM）
 * @param items        当前文档 TOC 项（按出现顺序）
 * @param getScrollTop 取当前滚动位置的纯函数（预览区返回 scrollTop 像素；编辑区返回可见顶行 0-based 行号）
 * @param getAnchorTop 由 id 解析锚点位置的纯函数（预览区返回 offsetTop；编辑区返回 line）
 * @param onActive     高亮 id 变化时的回调（传 null 表示无高亮）
 * @param locked       是否处于程序化滚动锁定期
 */
export function useScrollSpy(
  target: HTMLElement | null,
  items: TocItem[],
  getScrollTop: () => number,
  getAnchorTop: (id: string) => number | null,
  onActive: (id: string | null) => void,
  locked: boolean
): void {
  const rafRef = useRef<number | null>(null)
  const onActiveRef = useRef(onActive)
  onActiveRef.current = onActive
  const lockedRef = useRef(locked)
  lockedRef.current = locked
  const getScrollTopRef = useRef(getScrollTop)
  getScrollTopRef.current = getScrollTop
  const getAnchorTopRef = useRef(getAnchorTop)
  getAnchorTopRef.current = getAnchorTop

  useEffect(() => {
    if (!target) return
    const handler = () => {
      if (rafRef.current != null) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        if (lockedRef.current) return
        const top = getScrollTopRef.current()
        const id = computeActiveTocId(top, items, getAnchorTopRef.current)
        onActiveRef.current(id)
      })
    }
    target.addEventListener('scroll', handler, { passive: true })
    return () => {
      target.removeEventListener('scroll', handler)
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [target, items])
}
