# 增量 PRD —— MD-Editor 增量开发（v1.1）

> 产品经理：许清楚（Xu）
> 日期：2026-08-06
> 关联文档：`docs/research-typora-style.md`（竞品调研）
> 范围说明：本 PRD **仅描述变更部分**，未提及的现有能力（双栏编辑、GFM、KaTeX、Mermaid、代码高亮、脚注、Frontmatter、TOC、明暗主题、查找替换、导出 HTML/PDF、图片粘贴落盘、状态栏字数/脏标记/缩放）保持不变，**请勿重复实现**。

---

## 一、本次目标（一句话）

在保持现有双栏实时预览架构的前提下，完成**全量改名 `MD-Editor-HY3-YiQi`**、补齐**"最近打开"菜单**，并从 Typora 等竞品中融入一批**高价值、低风险**的专注写作与导出增强能力。

---

## 二、功能清单

> 优先级：P0 必做（本轮交付）｜ P1 推荐（本轮尽量做）｜ P2 可选（记录即可）
> 工作量：S（≤0.5d）｜ M（0.5–1.5d）｜ L（≥2d），为 PM 粗估，供排期参考。

### 2.1 P0 — 用户明示项（必做）

#### ① 最近打开菜单（P0）
- **用户价值**：快速回到近期编辑的文档，免去反复"打开"对话框，是用户明确诉求。
- **交互形态**：顶部菜单 **文件** 子菜单中，在"另存为…"之后插入分隔线，列出最近文件（建议最多 10 条，现有 `recents.json` 上限 12）；每项显示文件名，悬停/副标题显示完整路径；列表底部提供"清空最近打开"项。点击条目直接打开该文件。
- **依赖与现状**：主进程已有 `getRecents / addRecent / clearRecents` IPC 与 `RecentFileItem` 类型；渲染层已有 `useRecentFiles` hook（见 `src/shared/types.ts`、`src/main/main.ts`、`src/renderer/hooks.ts`）。**缺口**：① 应用菜单（`buildMenu`）未展示该列表；② 现有菜单在窗口创建时一次性构建，需在 recents 变化时重建；③ 无"按路径直接打开文件"的 IPC（现有 `openFile` 走对话框）；④ 拖拽打开时 `App.tsx handleDrop` 把 `path` 存成了 `file.name`（非绝对路径），需修正为绝对路径，否则"最近打开"无法定位。
- **建议实现要点**（供架构师参考）：
  - 新增 IPC `file:openByPath`（`src/shared/ipcChannels.ts` + `main.ts` handler + `preload.ts` + `types.ts` `ElectronAPI`），按绝对路径读取返回 `{path, content, name}`。
  - 新增 `app:syncRecents`（或复用 `recent:setRecents`）：渲染层在 recents 加载/变更后，将数组传给主进程；主进程缓存并**重建菜单**。菜单项点击发送 `openRecent` 动作（携带 path），`App.tsx` 经新 IPC 打开并更新 `recents`。
  - 修正 `handleDrop`：以 `file.path` 作为 `path`（绝对路径）写入 recents。
- **工作量**：M。

#### ② 全量改名 `MD-Editor-HY3-YiQi`（P0）
- **用户价值**：统一全部用户可见品牌名（窗口标题、安装包、快捷方式、关于框、HTML title）。
- **具体改名位置清单**（已逐项在代码中核实）：

| # | 文件 | 位置/字段 | 当前值 | 改为 |
| --- | --- | --- | --- | --- |
| 1 | `src/main/main.ts` | `createWindow` 的 `title: 'Markdown Editor'` | `Markdown Editor` | `MD-Editor-HY3-YiQi` |
| 2 | `index.html` | `<title>Markdown Editor</title>` | `Markdown Editor` | `MD-Editor-HY3-YiQi` |
| 3 | `electron-builder.yml` | `productName: Markdown Editor` | `Markdown Editor` | `MD-Editor-HY3-YiQi` |
| 4 | `electron-builder.yml` | `portable.artifactName: MarkdownEditor-Portable-${version}.${ext}` | `MarkdownEditor-Portable` | `MD-Editor-HY3-YiQi-Portable` |
| 5 | `electron-builder.yml` | `nsis.artifactName: MarkdownEditor-Setup-${version}.${ext}` | `MarkdownEditor-Setup` | `MD-Editor-HY3-YiQi-Setup` |
| 6 | `electron-builder.yml` | `nsis.shortcutName: Markdown Editor` | `Markdown Editor` | `MD-Editor-HY3-YiQi` |
| 7 | `src/renderer/App.tsx` | 欢迎语模板 `# 欢迎使用 Markdown Editor` | `Markdown Editor` | `MD-Editor-HY3-YiQi` |
| 8 | `src/renderer/App.tsx` | 关于框 `alert('Markdown Editor v1.0.0 …')` | `Markdown Editor` | `MD-Editor-HY3-YiQi`（建议顺带升级为正式模态框，见 §三） |
| 9 | `package.json` | `"name": "markdown-editor"` | `markdown-editor` | `md-editor-hy3-yiqi`（npm 包名须小写连字符；非用户可见，建议同步以免"全量"遗漏） |

- **可选/待确认**：`electron-builder.yml` 的 `appId: com.mdeditor.app` 为内部标识（非用户可见），是否一并改为 `com.mdeditorhy3yiqi.app` 见 §五。图标 `resources/icon.ico` 为图像资源，无需改文本。
- **增强（建议纳入 P1）**：窗口标题采用 Typora 风格 `文件名 — MD-Editor-HY3-YiQi`，随打开文件动态更新（`win.setTitle`）。
- **工作量**：S（纯文本替换，但需覆盖全部 9 处并重新打包验证）。

### 2.2 P0 — 从调研选入的 Typora 风格功能

#### ③ 图片拖拽入编辑器（P0）
- **用户价值**：与粘贴并列的第二种入图方式，符合 Typora/MarkText/VS Code 习惯。
- **交互形态**：从资源管理器拖拽图片文件到编辑区，落盘到 `<md目录>/images/`，插入 `![](相对路径)`；非图片文件不处理（现有 `handleDrop` 已处理 `.md` 拖入，需扩展图片分支）。
- **依赖**：复用现有 `saveImage` IPC（已支持 `mdDir` 相对路径）。**无新依赖**。
- **工作量**：S。

#### ④ 专注模式 Focus Mode（P0）
- **用户价值**：虚化非当前行/段，降低干扰，提升长文专注度（Typora、iA Writer 验证）。
- **交互形态**：视图菜单新增"专注模式"开关（或 `Ctrl+Shift+F` 之外新增 `Ctrl+Alt+F`）；开启后当前行/段落高亮、其余降透明度（CSS `opacity` + CodeMirror `decoration` 或基于光标行的类名切换）。可细化到"按句/段虚化"（iA 风格），首版做到"按行虚化"即可。
- **依赖**：**无新依赖**（纯 CSS + 光标位置监听）。
- **工作量**：S–M。

#### ⑤ 打字机模式 Typewriter Mode（P0）
- **用户价值**：活动行始终保持在窗口垂直居中，减少视线跳动（Typora、MarkText 验证）。
- **交互形态**：视图菜单新增"打字机模式"开关；开启后编辑区随光标自动滚动使活动行居中（监听光标变化 → 计算并 `scrollIntoView`/`scrollTop` 居中）。
- **依赖**：**无新依赖**。
- **工作量**：S–M。

### 2.3 P1 — 推荐（本轮尽量做）

#### ⑥ 自动配对括号 / 智能标点（P1）
- **用户价值**：输入 `()[]{}""` 及 Markdown 符号 `* _ ` 时自动补全闭合，减少语法错误（Typora/MarkText/VS Code 共有）。
- **交互形态**：启用 CodeMirror 6 `closeBrackets()` + `closeBracketsKeymap`（来自 `@codemirror/autocomplete`，通常已随依赖树存在；若缺失则加 `dependencies`）。需确认当前 `@uiw/react-codemirror` 是否已启用——**待核实**。
- **依赖**：可能需补充 `@codemirror/autocomplete`（轻量）。
- **工作量**：S。

#### ⑦ 复制为 HTML（P1）
- **用户价值**：一键把当前渲染结果以 HTML 复制到剪贴板，便于粘贴到邮件/富文本编辑器（Typora/iA Writer/Bear 共有）。
- **交互形态**：编辑/右键菜单新增"复制为 HTML"；取 `.markdown-body` 的 `innerHTML`（含内联样式更佳），写入 `ClipboardItem('text/html', ...)`。如带内联样式可复用 `exporter.ts` 的 `buildExportDocument` 思路。
- **依赖**：**无新依赖**（浏览器 Clipboard API）。
- **工作量**：S。

#### ⑧ 导出 Word / ODT（P1）
- **用户价值**：用户高频需求，现有仅 HTML/PDF（Typora/Zettlr/Bear 均支持）。
- **交互形态**：文件→导出 新增"导出 Word (.docx)"与"导出 ODT (.odt)"；复用现有自包含 HTML，经轻量库转写。
- **依赖**：新增 **devDependency** `html-docx-js`（HTML→docx，约数十 KB）；ODT 可先评估 `html-docx-js` 同类方案或暂缓。
- **已知限制（须在 UI 提示）**：公式（KaTeX）/Mermaid 在 Word 内会退化为静态图或丢失，表格/基础样式可保留。
- **工作量**：M。

#### ⑨ 更多内置主题（P1）
- **用户价值**：提升"界面美观"硬指标，给不同偏好用户选择（MarkText 27+、Bear 30+）。
- **交互形态**：在现有明/暗之外，**新增 2–3 套 CSS 变量驱动主题**（建议命名为"纸张 / 石墨 / 午夜"）；视图→主题子菜单切换；主题持久化到 `localStorage`（沿用现有 `md-editor:theme` 机制扩展为枚举）。
- **依赖**：**无新依赖**（CSS 变量 + 1 个枚举）。
- **工作量**：M（设计+实现 2–3 套）。

#### ⑩ 导出图片（PNG 预览截图）（P1）
- **用户价值**：把整篇渲染结果导出为图片，便于分享（Bear 支持 JPG）。
- **交互形态**：文件→导出 新增"导出图片"；复用 `exportPdf` 现有的离屏 `BrowserWindow`，对其截图为 PNG（或先生成 HTML 再用 `html-to-image` 思路）。
- **依赖**：可能新增 `html-to-image`（devDependency，轻量）；或纯用离屏窗口截图。
- **工作量**：M。

### 2.4 P2 — 可选（记录即可）

| # | 功能 | 用户价值 | 交互形态简述 | 新依赖 | 工作量 |
| --- | --- | --- | --- | --- | --- |
| ⑪ | 侧边栏文件树 | 高 | 侧栏新增"文件"视图，浏览/打开当前工作区 `.md`；需主进程目录列举+监听 IPC | 新增 FS IPC（中高） | L |
| ⑫ | 表格编辑工具栏 | 中高 | 选中表格出现行列插入/删除/对齐工具条（WYSIWYG 化） | 可能需表格解析库 | L |
| ⑬ | 拼写检查 | 中 | 状态栏/右键标红英文拼写错误 | `cspell` 或 `typo-js` | M |
| ⑭ | 大纲标题折叠 | 中 | TOC 侧栏按层级可折叠/展开 | 无 | S |
| ⑮ | 阅读时间估算 | 低 | 状态栏在字数后追加"约 X 分钟" | 无 | S |
| ⑯ | 快速打开 Ctrl+P | 中 | 模糊查找工作区文件（依赖 ⑪ 文件树） | 依赖 ⑪ | M |

> **不纳入**：Obsidian 双链/图谱、Zettlr 引文管理、Bear 标签/iCloud 同步——与本项目"单文档 Windows 编辑器"定位不符。

---

## 三、UI / 交互设计要点

### 3.1 顶部菜单（变更后示意）
```
文件
 ├ 新建            Ctrl+N
 ├ 打开…           Ctrl+O
 ├ 保存            Ctrl+S
 ├ 另存为…         Ctrl+Shift+S
 ├ ───────────────
 ├ 最近打开        ▸  文档A.md  (C:\…\a.md)
 │                │  文档B.md  (D:\…\b.md)
 │                └  清空最近打开
 ├ ───────────────
 ├ 导出 HTML
 ├ 导出 PDF
 ├ 导出 Word       ← 新增(P1)
 └ 导出 ODT        ← 新增(P1)
视图
 ├ 切换主题        Ctrl+T
 ├ 专注模式        ← 新增(P0)
 ├ 打字机模式      ← 新增(P0)
 ├ 放大 / 缩小
 └ 主题 ▸ 浅色/深色/纸张/石墨/午夜   ← 扩展(P1)
编辑
 ├ 搜索 / 替换     Ctrl+F
 └ 复制为 HTML     ← 新增(P1)
帮助
 └ 关于 MD-Editor-HY3-YiQi   ← 改名(P0)
```

### 3.2 专注/打字机模式（编辑器区）
- **专注模式**：非活动行 `opacity: 0.35` 过渡，活动行 `opacity: 1`；首版按"行"粒度，后续可细化到"句/段"（iA 风格）。
- **打字机模式**：编辑器滚动容器随光标保持活动行垂直居中（CSS `scroll-padding` + JS 滚动补偿），两侧预览不受影响。
- 两种模式可叠加；状态栏显示当前模式图标（美观提示）。

### 3.3 关于对话框（建议升级）
- 将 `alert()` 替换为**正式模态框**（卡片式、符合明/暗主题），展示：软件名 `MD-Editor-HY3-YiQi`、版本、简介、技术栈（Electron + React + CodeMirror 6）、官网/仓库占位。提升"界面美观"与专业感。

### 3.4 主题体系
- 以 CSS 变量（`--bg --fg --accent --code-bg` 等）驱动；3 套新增主题需通过明/暗两套的对比度与可读性评审。

---

## 四、验收要点（摘要）
- P0：安装后开始菜单/桌面快捷方式名为 `MD-Editor-HY3-YiQi`；窗口标题与 HTML title 同步；关于框展示新名；菜单"最近打开"可列/可点/可清空；图片可拖拽入编辑器；专注/打字机模式可开关且视觉正确。
- P1：自动配对生效；"复制为 HTML"可粘贴到外部富文本；导出 Word/ODT 生成可用文件（已知公式/Mermaid 限制需在 UI 注明）；新增主题可切换并持久化。
- 不破坏现有 GFM/KaTeX/Mermaid/导出 HTML/PDF/图片粘贴等能力（回归测试覆盖）。

---

## 五、待确认问题
1. **改名范围**：`electron-builder.yml` 的 `appId: com.mdeditor.app` 是否一并改为 `com.mdeditorhy3yiqi.app`？（影响更新标识，建议确认是否需保留旧 id 以兼容已装版本。）
2. **导出 Word 方案**：采用 `html-docx-js`（轻量、公式/Mermaid 降级）是否可接受？还是要求高质量（需评估 Pandoc 捆绑或放弃）？
3. **OCF 限制**：ODT 是否本轮必须，或可与 Word 合并为单一"导出 Office"？
4. **专注模式粒度**：首版按"行"虚化是否被接受，还是要求 iA 式"句/段"虚化（工作量更高）？
5. **菜单重建机制**：渲染层向主进程 `syncRecents` 后由主进程重建菜单的实现方式是否与架构师方案一致？（§2.1 为实现建议，非强制。）
6. **`package.json` name** 改为 `md-editor-hy3-yiqi` 是否会影响任何脚本/CI（当前脚本无硬依赖，预期无影响，待核实）。
