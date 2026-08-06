# Markdown 桌面编辑器 — 系统架构设计文档

> 作者：架构师 高见远（software-architect）
> 版本：v1.0
> 适用范围：Windows 独立运行 Markdown 查看/编辑桌面程序（Electron 单 .exe + NSIS 安装包）
> 配套图：`class-diagram.mermaid`（类图 / 接口）、`sequence-diagram.mermaid`（时序图）

---

## 1. 实现方案 + 框架选型

### 1.1 技术栈与版本策略

| 分类 | 包 | 推荐版本范围 | 说明 / 约束 |
|------|----|-------------|------------|
| 桌面壳 | `electron` | `^31.0.0`（锁定 31.x，勿用 32+ 未验证版本） | 提供 BrowserWindow、主进程、printToPDF |
| 打包 | `electron-builder` | `^24.13.3` | portable 单文件 + NSIS 安装包 |
| 构建 | `vite` | `^5.4.0` | 同时服务 renderer 与主进程打包 |
| 构建插件 | `vite-plugin-electron` | `^0.28.8` | 把 `src/main`/`src/preload` 作为独立入口接入 Vite |
| 构建插件 | `vite-plugin-electron-renderer` | `^0.14.6` | 让 renderer 内正确识别 Electron/Node 内置模块 |
| 构建插件 | `@vitejs/plugin-react` | `^4.3.1` | React + Fast Refresh |
| 语言 | `typescript` | `^5.5.4` | 全量 TS；渲染/主进程/共享层共用 |
| UI | `react` / `react-dom` | `^18.3.1` | 仅 18.x（react-markdown v9 要求 18+，勿上 19 以免生态未跟上） |
| 样式 | `tailwindcss` | `^3.4.10` | 仅用 3.x，4.x 配置破坏性变化暂不引入 |
| 样式 | `postcss` / `autoprefixer` | `^8.4.41` / `^10.4.20` | Tailwind 必需 |
| 渲染 | `react-markdown` | `^9.0.1` | ESM-only；v9 配 remark/rehype 16 体系 |
| 渲染 | `remark-gfm` | `^4.0.0` | 表格/删除线/任务列表/自动链接 |
| 渲染 | `remark-math` | `^6.0.0` | `$...$` / `$$...$$` 数学 |
| 渲染 | `remark-frontmatter` | `^5.0.0` | 解析 `---\n...\n---` YAML 头，避免破坏 AST |
| 渲染 | `rehype-katex` | `^7.0.0` | 数学公式 → KaTeX HTML |
| 渲染 | `rehype-highlight` | `^7.0.0` | 代码块语法高亮（依赖 highlight.js） |
| 渲染 | `rehype-raw` | `^7.0.0` | 允许 Markdown 内嵌原始 HTML |
| 渲染 | `rehype-slug` | `^6.0.0` | 给标题自动加 `id`，供 TOC 跳转 |
| 公式 | `katex` | `^0.16.11` | 必须引入 `katex/dist/katex.min.css` |
| 高亮 | `highlight.js` | `^11.10.0` | rehype-highlight 运行时依赖；仅引入常用语言子集 |
| 图表 | `mermaid` | `^11.2.1` | `mermaid.render()` 异步出 SVG；需手动初始化主题 |
| 编辑 | `@uiw/react-codemirror` | `^4.23.0` | CodeMirror 6 React 封装 |
| 编辑 | `@codemirror/lang-markdown` | `^6.2.5` | Markdown 语言支持 |
| 编辑 | `@codemirror/language-data` | `^6.5.1` | Markdown 内嵌代码块的多语言高亮 |
| 编辑 | `@codemirror/theme-one-dark` | `^6.1.2` | 深色编辑器主题（浅色用默认） |
| YAML | `js-yaml` | `^4.1.0` | 解析 frontmatter（渲染进程侧） |
| 测试 | `vitest` | `^2.0.5` | 单元测试 |
| 测试 | `@testing-library/react` | `^16.0.0` | 组件测试 |
| 测试 | `jsdom` | `^25.0.0` | DOM 环境 |

**版本策略原则**：所有 remark/rehype 插件统一采用与 unified v11 兼容的 4–7 大版本；react-markdown 锁 9.x；Electron 锁 31.x（长期支持且 API 稳定）；若出现 peer 冲突，降级该插件一个小版本，禁止盲目升级到最新大版本引入破坏性变更。

### 1.2 进程与安全模型

```
┌─────────────────────────────────────────────────────────────┐
│ 主进程 (main)  Node.js 环境，拥有完整 fs / dialog 权限        │
│  - BrowserWindow 加载 Vite dev/preview 产物                   │
│  - 通过 ipcMain.handle 暴露能力                               │
└───────────────▲──────────────────────┬──────────────────────┘
                │ ipcMain.handle        │ contextBridge
                │                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 预加载 (preload)  contextIsolation:true / nodeIntegration:false│
│  - 仅通过 contextBridge 暴露白名单 API 到 window.api          │
│  - 不向渲染进程泄漏 require / process / fs                    │
└───────────────▲──────────────────────┬──────────────────────┘
                │ window.api.*          │
                ▼                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 渲染进程 (renderer)  纯 React + DOM，无 Node 权限              │
│  - 所有文件/磁盘操作必须经由 window.api → IPC 回主进程执行      │
└─────────────────────────────────────────────────────────────┘
```

**硬性安全配置**（`src/main/main.ts` 中 `new BrowserWindow`）：
- `contextIsolation: true`（默认即 true，显式声明）
- `nodeIntegration: false`
- `sandbox: true`（preload 仅用 contextBridge，无 Node 调用）
- `webSecurity: true`
- `preload: path.join(__dirname, 'preload.js')` 由 Vite 单独特建为 CJS/ESM 独立 chunk

> ⚠️ 易错点：若使用 `vite-plugin-electron`，preload 的 `build.rollupOptions.output.format` 必须为 `cjs`（Electron 主进程加载 CJS），否则 `require` 报 ESM 错。见 `vite.config.ts` 模板。

---

## 2. 文件列表及相对路径

项目根：`md-editor/`

```
md-editor/
├── package.json                         # 依赖与脚本（dev/build/package）
├── vite.config.ts                       # Vite + electron 插件入口（main/preload/renderer）
├── tsconfig.json                        # 渲染进程 TS 配置
├── tsconfig.node.json                   # 主进程/构建工具 TS 配置
├── tailwind.config.js                   # Tailwind 扫描路径与主题变量
├── postcss.config.js                    # Tailwind + autoprefixer
├── electron-builder.yml                 # portable 单文件 + NSIS 双产出配置
├── index.html                           # Vite 入口 HTML
├── .gitignore
├── resources/
│   └── icon.ico                         # 应用图标（打包用）
├── src/
│   ├── main/                            # Electron 主进程（Node 环境）
│   │   ├── main.ts                      # 入口：创建窗口、注册 IPC、菜单、拖拽
│   │   ├── preload.ts                   # 预加载：contextBridge 白名单
│   │   ├── ipc/
│   │   │   ├── fileHandlers.ts          # 打开/保存/另存为/新建
│   │   │   ├── exportHandlers.ts        # 导出 HTML / PDF
│   │   │   ├── recentHandlers.ts        # 最近文件读写
│   │   │   └── imageHandlers.ts         # 图片落盘 images/
│   │   └── services/
│   │       ├── recentStore.ts           # 最近文件 JSON 持久化（≥10 条）
│   │       ├── fileStore.ts             # 当前文档状态（路径/脏标记）
│   │       └── exporter.ts              # HTML/PDF 内容拼装与样式内联
│   ├── shared/                          # 主/渲染进程共享（纯类型与常量）
│   │   ├── ipcChannels.ts               # IPC channel 名称常量（单一来源）
│   │   ├── types.ts                     # 共享 TS 类型（请求/响应）
│   │   └── theme.ts                     # 主题枚举与 localStorage key
│   └── renderer/                        # 渲染进程（React）
│       ├── main.tsx                     # React 挂载入口
│       ├── App.tsx                      # 根布局：菜单+工具栏+分屏+侧边栏+状态栏
│       ├── context/
│       │   └── AppContext.tsx           # 全局状态（当前文件/内容/主题/脏标记）
│       ├── components/
│       │   ├── MenuBar.tsx              # 顶部菜单（文件/编辑/视图/导出/帮助）
│       │   ├── Toolbar.tsx              # 工具栏（打开/保存/主题/导出/缩放）
│       │   ├── EditorPane.tsx           # 左：CodeMirror 6 编辑器
│       │   ├── PreviewPane.tsx          # 右：react-markdown 实时预览
│       │   ├── MermaidBlock.tsx         # ```mermaid 异步渲染组件
│       │   ├── Sidebar.tsx              # 可折叠侧边栏容器（文件/TOC/信息）
│       │   ├── FilePanel.tsx            # 最近文件列表
│       │   ├── TocPanel.tsx             # TOC（点击滚动定位）
│       │   ├── DocInfoPanel.tsx         # frontmatter 文档信息面板
│       │   └── StatusBar.tsx            # 字数/缩放/保存状态（●）
│       ├── hooks/
│       │   ├── useElectronAPI.ts        # 安全访问 window.api，带类型
│       │   ├── useTheme.ts              # 主题状态 + 偏好持久化
│       │   ├── useDebounce.ts           # 预览刷新防抖（≤300ms）
│       │   ├── useAutoSave.ts           # 草稿自动保存（localStorage）
│       │   ├── useRecentFiles.ts        # 最近文件读写 hook
│       │   ├── useWordCount.ts          # 字数统计
│       │   └── useToc.ts                # 由 Markdown 构建 TOC 树
│       ├── lib/
│       │   ├── markdown.ts              # react-markdown 插件统一装配
│       │   ├── frontmatter.ts           # 剥离 + 解析 YAML 头
│       │   ├── toc.ts                   # 标题提取 + slug 生成
│       │   ├── imagePaste.ts            # 粘贴/插入图片 → 落盘 images/
│       │   └── exporter.ts              # 渲染进程侧导出 HTML 拼装
│       └── styles/
│           ├── index.css                # @tailwind 指令 + 全局
│           ├── theme.css                # 浅色/深色 CSS 变量
│           ├── markdown.css             # 预览区 Markdown 排版样式
│           └── highlight.css            # 代码高亮主题（引入 highlight.js 主题）
├── samples/
│   └── acceptance.md                    # 验收样例：覆盖全部语法
└── tests/
    ├── frontmatter.test.ts              # frontmatter 解析
    ├── toc.test.ts                      # TOC 提取
    ├── markdown.test.tsx                # 渲染装配（GFM/数学/HTML）
    └── exporter.test.ts                 # 导出 HTML 样式内联
```

---

## 3. 数据结构和接口（类图 / 接口表）

> 完整类图见 `class-diagram.mermaid`。

### 3.1 共享类型（`src/shared/types.ts`）

```ts
// 文档打开结果
export interface OpenFileResult {
  path: string;            // 绝对路径
  name: string;            // 文件名（含 .md）
  content: string;         // 文件全文
  frontmatter: Record<string, unknown>; // 解析后的 YAML 头
}

// 保存入参
export interface SaveFileOptions {
  path: string | null;     // null 表示需要「另存为」弹窗
  content: string;
}

export interface SaveFileResult {
  path: string;
  savedAt: string;         // ISO 8601 UTC
}

// 最近文件条目
export interface RecentFileItem {
  path: string;
  name: string;
  lastOpenedAt: string;    // ISO
  preview?: string;        // 前 120 字纯文本摘要
}

// 图片落盘结果
export interface ImageInsertResult {
  relativePath: string;    // images/xxxx.png（相对当前 md 目录）
  absolutePath: string;
}

// 导出选项
export interface ExportHtmlOptions {
  content: string;
  includeStyles: boolean;  // 是否内联样式（P2 独立 HTML 用 true）
  customCss?: string;      // P2 自定义 CSS 注入
  title?: string;
}
export interface ExportPdfOptions {
  content: string;
  title?: string;
}

// 菜单动作（主进程 → 渲染进程 订阅）
export type MenuAction =
  | 'open' | 'save' | 'saveAs' | 'new'
  | 'exportHtml' | 'exportPdf' | 'print'
  | 'toggleTheme' | 'zoomIn' | 'zoomOut' | 'resetZoom'
  | 'search' | 'toggleSidebar';

// 渲染进程暴露给 window 的 API 形态
export interface ElectronAPI {
  openFile(): Promise<OpenFileResult | null>;
  saveFile(opts: SaveFileOptions): Promise<SaveFileResult | null>;
  saveFileAs(opts: { content: string }): Promise<SaveFileResult | null>;
  newFile(): Promise<{ content: string; path: null }>;
  exportHtml(opts: ExportHtmlOptions): Promise<{ path: string } | null>;
  exportPdf(opts: ExportPdfOptions): Promise<{ path: string } | null>;
  getRecents(): Promise<RecentFileItem[]>;
  addRecent(item: RecentFileItem): Promise<void>;
  clearRecents(): Promise<void>;
  saveImage(buffer: ArrayBuffer, ext: string, baseName: string): Promise<ImageInsertResult>;
  onMenuAction(cb: (action: MenuAction) => void): () => void; // 返回取消订阅
}
```

### 3.2 IPC Channel 常量（`src/shared/ipcChannels.ts`）

```ts
export const IPC = {
  OPEN_FILE: 'file:open',
  SAVE_FILE: 'file:save',
  SAVE_FILE_AS: 'file:saveAs',
  NEW_FILE: 'file:new',
  EXPORT_HTML: 'export:html',
  EXPORT_PDF: 'export:pdf',
  GET_RECENTS: 'recent:get',
  ADD_RECENT: 'recent:add',
  CLEAR_RECENTS: 'recent:clear',
  SAVE_IMAGE: 'image:save',
  MENU_ACTION: 'menu:action', // 主进程 webContents.send → 渲染进程监听
} as const;
```

### 3.3 接口表（主进程 `ipcMain.handle` ↔ 暴露 API）

| 渲染侧调用 | IPC Channel | 主进程处理文件 | 入参 | 返回 |
|-----------|------------|---------------|------|------|
| `api.openFile()` | `file:open` | `fileHandlers.openFile` | 无（弹 dialog） | `OpenFileResult \| null` |
| `api.saveFile(opts)` | `file:save` | `fileHandlers.saveFile` | `SaveFileOptions` | `SaveFileResult \| null` |
| `api.saveFileAs({content})` | `file:saveAs` | `fileHandlers.saveFileAs` | `{content}` | `SaveFileResult \| null` |
| `api.newFile()` | `file:new` | `fileHandlers.newFile` | 无 | `{content:'', path:null}` |
| `api.exportHtml(opts)` | `export:html` | `exportHandlers.exportHtml` | `ExportHtmlOptions` | `{path} \| null` |
| `api.exportPdf(opts)` | `export:pdf` | `exportHandlers.exportPdf` | `ExportPdfOptions` | `{path} \| null` |
| `api.getRecents()` | `recent:get` | `recentHandlers.getRecents` | 无 | `RecentFileItem[]` |
| `api.addRecent(item)` | `recent:add` | `recentHandlers.addRecent` | `RecentFileItem` | `void` |
| `api.clearRecents()` | `recent:clear` | `recentHandlers.clearRecents` | 无 | `void` |
| `api.saveImage(buf,ext,name)` | `image:save` | `imageHandlers.saveImage` | `ArrayBuffer,string,string` | `ImageInsertResult` |
| `api.onMenuAction(cb)` | `menu:action` | `main.ts` 菜单/快捷键触发 | 订阅回调 | 取消函数 |

> 全部走 `ipcMain.handle`/`ipcRenderer.invoke`（request/response 语义），菜单事件走 `webContents.send(IPC.MENU_ACTION, action)` + `ipcRenderer.on`，由 preload 通过 `onMenuAction` 封装为可取消订阅。

---

## 4. 程序调用流程（时序图）

> 完整时序图见 `sequence-diagram.mermaid`。覆盖三条主流程 + 实时预览。要点：

### 4.1 打开文件 → 渲染
1. 用户 菜单/Ctrl+O/拖拽文件 → `main.ts` 调 `dialog.showOpenDialog`
2. `fileHandlers.openFile` 读文件 → `frontmatter` 剥离（主进程仅透传原始 content，解析在渲染侧）
3. `api.openFile()` resolve `OpenFileResult`
4. 渲染：`AppContext.setFile()` → `frontmatter.ts` 解析 YAML → 写 `DocInfoPanel`；`useToc` 构建 TOC；`PreviewPane` 渲染

### 4.2 编辑 → 实时预览（≤300ms）
1. `EditorPane` 受控 `onChange` → `AppContext.setContent()`
2. `useDebounce(content, 280)` → 触发 `PreviewPane` 重渲染
3. `PreviewPane` 调 `markdown.ts` 装配插件后 `<ReactMarkdown>`；mermaid 块异步 `mermaid.render()`
4. `StatusBar` 字数、`AppContext` 脏标记 ●

### 4.3 保存（Ctrl+S）
1. 工具栏/快捷键 → `api.saveFile({path, content})`
2. `fileHandlers` 写盘；首次无路径则降级 `saveFileAs` 弹窗
3. 成功 → 更新 `fileStore` 脏标记清除、加入最近文件 `addRecent`

### 4.4 导出 PDF
1. 菜单「导出 PDF」→ `api.exportPdf({content,title})`
2. `exportHandlers` 新建**隐藏** `BrowserWindow`，写入 `exporter.ts` 拼装的完整 HTML（含 KaTeX/highlight/markdown 样式内联）
3. `win.webContents.printToPDF({printBackground:true})` → 二进制写入用户选择路径
4. 关闭隐藏窗口，返回 `{path}`

---

## 5. 任务列表（有序、含依赖、按实现顺序）

> 共 5 个任务（硬性上限 5）。T01 为基础设施（配置+入口+依赖声明+安全骨架），其余按「主进程服务 / 渲染核心 / 应用外壳 / 验收打包」分层，尽量仅依赖 T01 并行推进。

### T01 — 项目基础设施与 Electron 安全骨架  （P0）
- **产出文件**：`package.json`、`vite.config.ts`、`tsconfig.json`、`tsconfig.node.json`、`tailwind.config.js`、`postcss.config.js`、`index.html`、`electron-builder.yml`、`.gitignore`、`src/main/main.ts`、`src/main/preload.ts`、`src/shared/ipcChannels.ts`、`src/shared/types.ts`、`src/shared/theme.ts`
- **依赖前置**：无（首个任务）
- **验收点**：
  1. `npm install` 成功，无 peer 冲突阻断。
  2. `npm run dev` 启动 Electron 窗口，加载空白 React 页面，控制台无 `require is not defined` / CJS 报错。
  3. preload 已 `contextBridge.exposeInMainWorld('api', {...})`；`contextIsolation:true`、`nodeIntegration:false`、`sandbox:true` 已在 `main.ts` 显式声明。
  4. `window.api.onMenuAction` / `openFile` 等类型从 `shared/types.ts` 推导可见。
  5. `electron-builder.yml` 同时配置 `portable` 与 `nsis` target。

### T02 — 主进程业务服务（IPC + 文件/最近/图片/导出）  （P0）
- **产出文件**：`src/main/ipc/fileHandlers.ts`、`src/main/ipc/exportHandlers.ts`、`src/main/ipc/recentHandlers.ts`、`src/main/ipc/imageHandlers.ts`、`src/main/services/recentStore.ts`、`src/main/services/fileStore.ts`、`src/main/services/exporter.ts`
- **依赖前置**：T01
- **验收点**：
  1. `api.openFile()` 弹出系统对话框并读回 `OpenFileResult`（含 `content`、空 `frontmatter`）。
  2. `api.saveFile` / `saveFileAs` 写盘成功，返回绝对路径。
  3. `recentStore` 持久化到 `userData/recents.json`，上限 ≥10 且去重、按时间倒序。
  4. `api.saveImage(buffer, ext, baseName)` 在 md 同目录 `images/` 写入文件，返回相对/绝对路径。
  5. `exportHandlers` 隐藏窗口 + `printToPDF` 产出有效 PDF；`exporter.ts` 能拼装内联样式 HTML 字符串。

### T03 — 渲染层核心（Markdown 装配 + 编辑器 + 预览 + 样式）  （P0）
- **产出文件**：`src/renderer/lib/markdown.ts`、`src/renderer/lib/frontmatter.ts`、`src/renderer/lib/toc.ts`、`src/renderer/lib/imagePaste.ts`、`src/renderer/lib/exporter.ts`、`src/renderer/components/EditorPane.tsx`、`src/renderer/components/PreviewPane.tsx`、`src/renderer/components/MermaidBlock.tsx`、`src/renderer/styles/markdown.css`、`src/renderer/styles/highlight.css`、`src/renderer/styles/theme.css`
- **依赖前置**：T01
- **验收点**：
  1. `markdown.ts` 统一装配 `remark-gfm + remark-math + remark-frontmatter + rehype-raw + rehype-slug + rehype-katex + rehype-highlight`，覆盖 GFM/数学/内联 HTML/代码高亮。
  2. `frontmatter.ts` 正确剥离 `---\n...\n---` 并用 `js-yaml` 解析为对象；该块不出现在预览正文。
  3. `toc.ts` 提取 H1–H6 生成 `{level,text,slug}[]`，slug 与 `rehype-slug` 产出的 `id` 一致。
  4. `EditorPane` 用 `@uiw/react-codemirror` + `@codemirror/lang-markdown`，浅色/深色跟随主题。
  5. `MermaidBlock` 异步 `mermaid.render()` 出 SVG；主题切换时重渲染；`react-markdown` 的 `code` 组件对 ```mermaid 正确路由到该组件。
  6. `index.css` 引入 `katex.min.css` 与 highlight 主题，预览无未样式化公式/代码。

### T04 — 应用外壳与 UI 组件（布局/菜单/侧边栏/状态/状态管理/主题/自动保存）  （P0 + P1）
- **产出文件**：`src/renderer/main.tsx`、`src/renderer/App.tsx`、`src/renderer/context/AppContext.tsx`、`src/renderer/components/MenuBar.tsx`、`src/renderer/components/Toolbar.tsx`、`src/renderer/components/Sidebar.tsx`、`src/renderer/components/FilePanel.tsx`、`src/renderer/components/TocPanel.tsx`、`src/renderer/components/DocInfoPanel.tsx`、`src/renderer/components/StatusBar.tsx`、`src/renderer/hooks/useTheme.ts`、`src/renderer/hooks/useAutoSave.ts`、`src/renderer/hooks/useRecentFiles.ts`、`src/renderer/hooks/useWordCount.ts`、`src/renderer/hooks/useToc.ts`、`src/renderer/styles/index.css`
- **依赖前置**：T01、T02、T03
- **验收点**：
  1. `App.tsx` 两栏可拖拽分屏（左编辑/右预览），侧边栏可折叠（文件/目录/TOC/文档信息 多面板切换）。
  2. `useTheme` 切换浅色/深色并持久化到 `localStorage`；切换无闪烁（CSS 变量切换）。
  3. `useDebounce` 保证输入到预览刷新 ≤300ms；5000 行大文档不卡顿（仅 markdown 渲染防抖，CodeMirror 不卡）。
  4. 未保存显示 ●（`StatusBar`），保存后清除；`useAutoSave` 草稿存 `localStorage` 可恢复。
  5. `FilePanel` 展示最近文件（≥10），点击重新打开；`TocPanel` 点击滚动定位到对应 `id`；`DocInfoPanel` 展示 frontmatter。
  6. 菜单/快捷键：Ctrl+O 打开、Ctrl+S 保存、Ctrl+N 新建、Ctrl+F 搜索替换、Ctrl+滚轮/按钮缩放；拖拽文件到窗口可打开。

### T05 — 验收样例 + 测试 + 自定义 CSS/独立 HTML 导出  （P1 + P2）
- **产出文件**：`samples/acceptance.md`、`tests/frontmatter.test.ts`、`tests/toc.test.ts`、`tests/markdown.test.tsx`、`tests/exporter.test.ts`、`resources/icon.ico`、导出 HTML 模板（内联样式 + 自定义 CSS 注入）
- **依赖前置**：T02、T03、T04
- **验收点**：
  1. `samples/acceptance.md` 覆盖：GFM 表格/任务列表/删除线、$$数学$$、$行内$、```mermaid、```代码高亮、footnotes、`[^1]`、定义列表、emoji、frontmatter、内嵌 HTML。
  2. `vitest` 单测全绿：frontmatter 解析、TOC slug、markdown 渲染关键语法、导出 HTML 样式内联。
  3. P2 自定义 CSS：可在设置/面板注入 CSS 影响预览；导出「带样式独立 HTML」将样式（含 KaTeX/highlight/markdown + 自定义 CSS）全部内联为单文件。
  4. 安装 `resources/icon.ico` 后 `npm run package` 产出 `dist/MarkdownEditor Portable.exe` 与 `dist/MarkdownEditor Setup.exe`（NSIS）均可独立运行。

---

## 6. 依赖包列表

### 运行时依赖（renderer/bundled）
```
- react@^18.3.1                  React UI 框架
- react-dom@^18.3.1              React DOM 渲染
- react-markdown@^9.0.1          核心 Markdown → React 渲染
- remark-gfm@^4.0.0             GFM 扩展（表格/任务列表/删除线）
- remark-math@^6.0.0            数学公式语法识别
- remark-frontmatter@^5.0.0     YAML 头不破坏 AST
- rehype-raw@^7.0.0             支持 Markdown 内嵌原始 HTML
- rehype-slug@^6.0.0            标题自动 id（TOC 跳转）
- rehype-katex@^7.0.0           公式 → KaTeX
- rehype-highlight@^7.0.0      代码块语法高亮
- katex@^0.16.11                KaTeX 引擎（需引入其 CSS）
- highlight.js@^11.10.0         rehype-highlight 运行时依赖
- mermaid@^11.2.1               流程图/时序图等渲染
- @uiw/react-codemirror@^4.23.0 CodeMirror 6 React 封装
- @codemirror/lang-markdown@^6.2.5 Markdown 编辑语言
- @codemirror/language-data@^6.5.1 代码块内嵌多语言高亮
- @codemirror/theme-one-dark@^6.1.2 编辑器深色主题
- js-yaml@^4.1.0               解析 frontmatter YAML
```

### 开发依赖
```
- electron@^31.0.0             桌面壳运行时/打包基础
- electron-builder@^24.13.3    portable + NSIS 双产出
- vite@^5.4.0                  构建工具
- @vitejs/plugin-react@^4.3.1  React 插件
- vite-plugin-electron@^0.28.8 主/preload 接入 Vite
- vite-plugin-electron-renderer@^0.14.6 渲染进程 Node 解析
- typescript@^5.5.4            类型系统
- tailwindcss@^3.4.10          原子化样式
- postcss@^8.4.41              Tailwind 处理管线
- autoprefixer@^10.4.20        浏览器前缀
- @types/react@^18.3.3 / @types/react-dom@^18.3.0
- @types/js-yaml@^4.0.9
- vitest@^2.0.5               测试运行器
- @testing-library/react@^16.0.0 组件测试
- jsdom@^25.0.0               DOM 测试环境
```

---

## 7. 共享知识（跨文件约定）

- **主题变量**：所有颜色用 CSS 变量定义在 `styles/theme.css`：`--bg`、`--fg`、`--panel-bg`、`--border`、`--accent`、`--code-bg` 等；浅色写在 `:root`，深色写在 `:root[data-theme="dark"]`。主题枚举见 `shared/theme.ts`：`Theme = 'light' | 'dark'`，localStorage key = `md-editor:theme`。
- **IPC channel 命名**：统一 `领域:动作` 小写冒号风格，全部集中在 `shared/ipcChannels.ts`，禁止在业务代码里写字符串字面量。
- **路径常量**：主进程 `userData/recents.json` 存最近文件；md 同目录的 `images/` 为图片落盘根（相对路径前缀 `images/`），由 `imageHandlers` 解析为绝对路径。
- **Markdown 插件统一装配**：所有 remark/rehype 插件**只允许**在 `renderer/lib/markdown.ts` 一处装配，返回 `{remarkPlugins, rehypePlugins, components}`，其余组件统一 `import { markdownConfig } from './lib/markdown'`，杜绝散落重复装配导致顺序错误。
- **插件顺序铁律**：`remark-frontmatter` 必须在前；`rehype-raw` 须在 `rehype-katex`/`rehype-highlight` 之前（先有原始 HTML 节点再处理）；`rehype-slug` 在生成 heading id 时须在 `rehype-highlight` 之后以保证 id 稳定。
- **样式作用域**：Tailwind 仅用于 UI 外壳；预览区样式走 `markdown.css`（`#preview` 作用域前缀），不污染编辑器；`highlight.css` 仅覆盖 `.hljs*`。
- **KaTeX 加载**：在 `markdown.ts` 或 `PreviewPane` 顶部 `import 'katex/dist/katex.min.css'`，否则公式无样式。
- **mermaid 初始化**：`MermaidBlock` 挂载时 `mermaid.initialize({ startOnLoad:false, theme: 当前主题==='dark'?'dark':'default' })`；每次渲染用 `mermaid.render(\`mermaid-${id}\`, code)`，结果 `innerHTML` 注入；主题切换需重新调用 `render`。
- **CodeMirror 配置**：`EditorPane` 用 `basicSetup` + `markdown({ codeLanguages: languages })`；主题随 `useTheme` 在 `oneDark` 与默认之间切换；`onChange` 受控到 `AppContext`，不直接持有内容避免双源。
- **预览刷新**：一律经 `useDebounce(content, 280)`，禁止每次按键同步渲染大文档。
- **脏标记约定**：`AppContext.dirty: boolean`；改内容置 true，保存/打开成功置 false；`StatusBar` 显示 `●`（dirty）或 `✓`。
- **最近文件契约**：`RecentFileItem.preview` 为纯文本前 120 字（去 markdown 标记），便于列表展示；上限 12 条，写入去重（同路径保留最新）。

---

## 8. 待明确事项（技术风险 + 推荐默认）

1. **react-markdown v9 在 Electron 打包后偶发 ESM/CJS 解析失败**：`vite-plugin-electron-renderer` 默认把 ESM 依赖 external 给 Electron 的 Node 加载。推荐默认：在 `vite.config.ts` 的 `renderer` 配置中给 `vite-plugin-electron-renderer` 传 `{ resolve: { 'react-markdown': 'esm' } }` 或不 external，让其被 Vite 打进 renderer bundle（更安全）。**默认采用「全部打进 renderer bundle，不 external」方案**。
2. **mermaid 在 React 18 StrictMode 下会双渲染/报 id 冲突**：推荐默认 `MermaidBlock` 用 `useRef` 缓存已渲染 svg、以 `useId()` 生成唯一前缀，并关闭 `StrictMode` 对预览区的双重 effect（或在 effect 里幂等处理）。**默认：预览区不使用 StrictMode 双重渲染，MermaidBlock 用 `useId` 前缀 + 渲染结果缓存**。
3. **PDF 导出采用主进程隐藏窗口 `printToPDF` 而非第三方库**：第三方（如 puppeteer）体积过大且与 Electron 内核重复。推荐默认：隐藏 `BrowserWindow` + `printToPDF`。分页由 `@media print` 在 `markdown.css` 控制。
4. **KaTeX 字体在单文件 exe 中缺失**：`katex.min.css` 引用 `fonts/*.woff2`。推荐默认：导出「独立 HTML」时用 `exporter.ts` 将 KaTeX 字体 base64 内联或改为 CDN 引用；应用内预览依赖 Vite 正常打包字体（已 OK）。**默认应用内正常打包；导出独立 HTML 字体走内联**。
5. **electron 大版本是否追新**：当前锁 31.x。若团队后续要 Windows 7 支持需降到 22.x（已放弃 Win7）。**默认 31.x，仅支持 Windows 10+**。
6. **多标签页**：首版不做（主理人拍板）。`AppContext` 设计为单文档模型，预留 `tabs` 字段但本版不实现 UI。

---

> 附：本文件配套 `class-diagram.mermaid`、`sequence-diagram.mermaid` 可直接粘贴到支持 Mermaid 的文档/看板渲染。
