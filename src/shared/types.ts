import type { MenuAction } from './ipcChannels'

export interface OpenFileResult {
  path: string
  content: string
  name: string
}

export interface SaveResult {
  saved: boolean
  path?: string
  name?: string
}

export interface RecentFileItem {
  path: string
  name: string
  mtime: number
}

export interface ImageInsertResult {
  relativePath: string
  absolutePath: string
}

export interface TocItem {
  level: number
  text: string
  id: string
}

// 主题枚举（单一来源，主进程与渲染层共用）
export type ThemeName = 'light' | 'dark' | 'paper' | 'graphite' | 'midnight'

// 渲染进程通过 preload 暴露的 API 形态
export interface ElectronAPI {
  openFile: () => Promise<OpenFileResult | null>
  saveFile: (filePath: string | null, content: string) => Promise<SaveResult>
  saveFileAs: (content: string) => Promise<SaveResult>
  openByPath: (path: string) => Promise<OpenFileResult | { error: 'not_found' }>
  exportHtml: (html: string, defaultPath?: string) => Promise<SaveResult>
  exportPdf: (html: string) => Promise<SaveResult>
  getRecents: () => Promise<RecentFileItem[]>
  addRecent: (item: RecentFileItem) => Promise<RecentFileItem[]>
  clearRecents: () => Promise<RecentFileItem[]>
  saveImage: (
    base64: string,
    name: string,
    mdDir: string | null
  ) => Promise<ImageInsertResult>
  openExternal: (url: string) => Promise<void>
  setTitle: (title: string) => Promise<void>
  onMenuAction: (cb: (action: MenuAction) => void) => () => void
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}
