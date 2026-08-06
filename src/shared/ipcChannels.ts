// 所有 IPC channel 名称唯一来源，禁止在别处使用字符串字面量
export const IPC = {
  openFile: 'file:open',
  saveFile: 'file:save',
  saveFileAs: 'file:saveAs',
  openByPath: 'file:openByPath',
  exportHtml: 'export:html',
  exportPdf: 'export:pdf',
  getRecents: 'recent:get',
  addRecent: 'recent:add',
  clearRecents: 'recent:clear',
  saveImage: 'image:save',
  openExternal: 'shell:openExternal',
  setTitle: 'win:setTitle',
  menuAction: 'menu:action'
} as const

export type MenuAction =
  | 'new'
  | 'open'
  | 'save'
  | 'saveAs'
  | 'exportHtml'
  | 'exportPdf'
  | 'toggleTheme'
  | 'zoomIn'
  | 'zoomOut'
  | 'search'
  | 'about'
  // 以下为新增静态动作
  | 'toggleFocus'
  | 'toggleTypewriter'
  | 'copyHtml'
  // 以下为动态前缀动作（渲染层 handleMenuAction 用 startsWith 解析）：
  //   'openRecent:' + encodeURIComponent(path) —— 点击"最近打开"条目
  //   'theme:' + ThemeName                  —— 点击"主题"子菜单项
  | `openRecent:${string}`
  | `theme:${string}`
