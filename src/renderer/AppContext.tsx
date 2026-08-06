import { createContext, useContext } from 'react'
import type { RecentFileItem, TocItem, ThemeName } from '../shared/types'

export interface AppState {
  content: string
  setContent: (v: string) => void
  filePath: string | null
  setFilePath: (p: string | null) => void
  fileName: string
  setFileName: (n: string) => void
  dirty: boolean
  setDirty: (b: boolean) => void
  theme: ThemeName
  setTheme: (name: ThemeName) => void
  toggleTheme: () => void
  focusMode: boolean
  typewriterMode: boolean
  toggleFocusMode: () => void
  toggleTypewriterMode: () => void
  aboutOpen: boolean
  zoom: number
  setZoom: (n: number) => void
  recents: RecentFileItem[]
  addRecent: (i: RecentFileItem) => void
  clearRecents: () => void
  toc: TocItem[]
  frontmatter: Record<string, unknown>
  wordCount: number
  searchOpen: boolean
  setSearchOpen: (b: boolean) => void
}

export const AppContext = createContext<AppState | null>(null)

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp 必须在 AppContext.Provider 内使用')
  return ctx
}
