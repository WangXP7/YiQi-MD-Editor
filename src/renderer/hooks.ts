import { useEffect, useMemo, useState } from 'react'
import type { RecentFileItem, ThemeName } from '../shared/types'
import { THEME_LIST } from '../shared/constants'
import { extractToc } from './lib/toc'

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
