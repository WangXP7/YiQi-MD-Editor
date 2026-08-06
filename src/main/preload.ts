import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type MenuAction } from '../shared/ipcChannels'
import type {
  ElectronAPI,
  ImageInsertResult,
  OpenFileResult,
  RecentFileItem,
  SaveResult
} from '../shared/types'

const api: ElectronAPI = {
  openFile: (): Promise<OpenFileResult | null> =>
    ipcRenderer.invoke(IPC.openFile),
  saveFile: (filePath: string | null, content: string): Promise<SaveResult> =>
    ipcRenderer.invoke(IPC.saveFile, filePath, content),
  saveFileAs: (content: string): Promise<SaveResult> =>
    ipcRenderer.invoke(IPC.saveFileAs, content),
  openByPath: (path: string): Promise<OpenFileResult | { error: 'not_found' }> =>
    ipcRenderer.invoke(IPC.openByPath, path),
  exportHtml: (html: string, defaultPath?: string): Promise<SaveResult> =>
    ipcRenderer.invoke(IPC.exportHtml, html, defaultPath),
  exportPdf: (html: string): Promise<SaveResult> =>
    ipcRenderer.invoke(IPC.exportPdf, html),
  getRecents: (): Promise<RecentFileItem[]> => ipcRenderer.invoke(IPC.getRecents),
  addRecent: (item: RecentFileItem): Promise<RecentFileItem[]> =>
    ipcRenderer.invoke(IPC.addRecent, item),
  clearRecents: (): Promise<RecentFileItem[]> =>
    ipcRenderer.invoke(IPC.clearRecents),
  saveImage: (
    base64: string,
    name: string,
    mdDir: string | null
  ): Promise<ImageInsertResult> =>
    ipcRenderer.invoke(IPC.saveImage, base64, name, mdDir),
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke(IPC.openExternal, url),
  setTitle: (title: string): Promise<void> =>
    ipcRenderer.invoke(IPC.setTitle, title),
  onMenuAction: (cb: (action: MenuAction) => void): (() => void) => {
    const listener = (_e: unknown, action: MenuAction) => cb(action)
    ipcRenderer.on(IPC.menuAction, listener)
    return () => ipcRenderer.removeListener(IPC.menuAction, listener)
  }
}

// 仅暴露白名单 API，绝不暴露 require / process / fs
contextBridge.exposeInMainWorld('api', api)
