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
  /** 标题层级 1–6 */
  level: number
  /** 标题文本（已去尾 #） */
  text: string
  /** 与 rehype-slug 生成的预览锚点一致（github-slugger 算法） */
  id: string
  /** 源码行号（0-based），用于编辑区光标定位 */
  line: number
}

/**
 * 多标签文档状态：标签页中单个文档的完整信息与视图位置。
 */
export interface DocTab {
  /** 唯一 id（crypto.randomUUID()） */
  id: string
  /** 已保存文件的绝对路径；未保存为 null */
  filePath: string | null
  /** 显示名，如 'untitled.md' */
  fileName: string
  /** 文档内容（Markdown 源码） */
  content: string
  /** 是否有未保存修改 */
  dirty: boolean
  /** 切换标签时恢复的视图位置（可选，优化体验） */
  viewState?: {
    scrollTop?: number
    cursor?: number
  }
}

/**
 * 同步滚动运行时状态（scroll-spy / 大纲联动共用）。
 */
export interface SyncScrollState {
  /** 当前高亮章节 id（scroll-spy 输出） */
  activeId: string | null
  /** 程序化滚动进行中，抑制 scroll 监听回环 */
  locked: boolean
  /** 最近一次滚动来源：编辑区 / 预览区 / 大纲点击 */
  lastSource: 'editor' | 'preview' | 'toc'
}

/**
 * 由 TocItem 派生的对齐锚点，用于点击联动与 scroll-spy。
 */
export interface TocAnchor {
  /** = TocItem.id */
  tocId: string
  /** = TocItem.line（编辑区行定位） */
  editorLine: number
  /** = '#' + TocItem.id（预览区选择器） */
  previewSelector: string
}

// 主题枚举（单一来源，主进程与渲染层共用）
export type ThemeName = 'light' | 'dark' | 'paper' | 'graphite' | 'midnight'

/** 未保存关闭弹窗的用户选择 */
export type UnsavedChoice = 'save' | 'discard' | 'cancel'

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
