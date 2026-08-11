import { createContext, useContext } from 'react'
import type {
  DocTab,
  RecentFileItem,
  SyncScrollState,
  ThemeName,
  TocItem,
  UnsavedChoice
} from '../shared/types'

export interface AppState {
  // ---- 多标签文档状态（第三轮新增） ----
  /** 所有打开的文档标签 */
  tabs: DocTab[]
  /** 当前激活标签 id */
  activeTabId: string
  /** 当前激活标签（由 tabs + activeTabId 派生） */
  activeTab: DocTab
  /** 同步滚动运行时状态（scroll-spy / 大纲联动） */
  sync: SyncScrollState
  /** 未保存关闭弹窗的目标标签 id（null 表示不显示） */
  unsavedTabId: string | null

  // ---- 文档操作（按 activeTab 生效） ----
  openFile: () => Promise<void>
  newFile: () => void
  switchTab: (id: string) => void
  closeTab: (id: string) => void
  navigateToc: (tocId: string) => void
  resolveUnsaved: (choice: UnsavedChoice) => void

  // ---- 由 activeTab 派生的便捷字段（仍可被各组件直接消费） ----
  content: string
  setContent: (v: string) => void
  filePath: string | null
  fileName: string
  dirty: boolean

  // ---- 通用应用状态（保持不变） ----
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
