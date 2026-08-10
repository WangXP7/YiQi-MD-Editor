# 增量 PRD（第二轮）—— MD-Editor 改名 / 图标 / BUG 修复 / 悬浮复制

> 产品经理：许清楚（Xu）
> 日期：2026-08-07
> 关联文档：`docs/research-typora-style.md`、`docs/increment-prd.md`（第一轮）、`docs/increment-design.md`（第一轮架构设计）
> 仓库：`git@github.com:WangXP7/YiQi-MD-Editor.git`（main，HEAD=89f0fc9）
> **范围说明**：本 PRD **仅描述本轮变更**。第一轮已交付的能力（最近打开菜单+清空、全量改名 `MD-Editor-HY3-YiQi`、专注/打字机模式、自动配对括号、复制为 HTML、3 套新主题、图片拖拽）保持不变，**请勿重写**。本轮在已 push 的 v1.0.0 基础上做增量，源码与 `dist-pkg6/` 为最新可用状态。

---

## 一、需求拆解与优先级（6 条 → 功能项）

| # | 用户原文需求 | 映射功能项 | 优先级 | 说明 |
| --- | --- | --- | --- | --- |
| 1 | 所有位置的软件名/命名/Logo 改为 `YiQi@MD-Editor-wb-Hy3` + 版本号 | **① 品牌全量重命名**（基础名 `YiQi@MD-Editor-wb-Hy3`，版本号追加规则见 §二） | **P0** | 用户明示；"Logo"= 应用图标，由 §三 交付 |
| 2 | 上传至 `git@github.com:WangXP7/YiQi-MD-Editor.git` | **④ 发布交付（commit + push main + 重新打包）** | **P0** | 发布闸门，依赖 ①③④ 完成且构建通过 |
| 3 | 图标要美感/炫酷，不要默认图标 | **② 应用图标重设计** | **P0** | 用户明示"不要用默认图标" |
| 4 | 到处是 BUG，定位并修复 | **③ BUG 首轮定位与修复** | **P0** | 用户明示；开放排查，重点区见 §四 |
| 5 | 再自查一轮 BUG | **⑤ BUG 二次自查 + 回归** | **P1** | 在 ③ 修复后跑第二遍（vitest + 评审 + 手动清单） |
| 6 | 所有大段文字/Text 处提供悬浮复制按钮 | **⑥ 悬浮复制按钮** | **P1** | 新功能；触发范围与覆盖清单见 §五，精确清单待确认 |

> 优先级：P0 本轮必交付（用户明示 / 发布闸门）｜ P1 本轮尽量做（二次排查 + 新功能）。
> 工作量（PM 粗估）：① S（纯文本替换+测试同步）｜ ② S（设计交付，代码零改或极小）｜ ③ M（排查+修）｜ ④ S（构建+推送）｜ ⑤ M｜ ⑥ M。

---

## 二、第 1 条 —— 命名规范

### 2.1 基础名与版本号建议

- **基础名（无版本）**：`APP_NAME = 'YiQi@MD-Editor-wb-Hy3'`（集中常量，单一来源）。
- **版本号**：`APP_VERSION = '1.0.0'`（沿用 `src/shared/constants.ts` 手动维护常量；渲染层无法访问 `process`）。
- **全名（带版本）**：建议新增派生常量 `APP_DISPLAY_NAME = ${APP_NAME} + ' v' + ${APP_VERSION}` = **`YiQi@MD-Editor-wb-Hy3 v1.0.0`**。
- **版本号追加位置建议**（见 §六 待确认 1）：
  - 关于框、安装包名/桌面快捷方式：**显示全名** `YiQi@MD-Editor-wb-Hy3 v1.0.0`。
  - exe 文件名：由 `electron-builder` 的 `artifactName` 模板天然含 `${version}`（如 `YiQi@MD-Editor-wb-Hy3-Setup-1.0.0.exe`），**已含版本号**。
  - 窗口标题（任务栏/运行标题 `文件名 — 基础名`）：建议用**基础名**，不带版本（避免过长、随文件动态刷新更清爽）。

### 2.2 全部需改名的位置清单（已逐项在代码中核实）

> 说明：`main.ts` 标题、`App.tsx` 欢迎语/运行标题、`TopBar` 品牌字、`AboutDialog` 名称均引用 `APP_NAME` 常量，改 §2.2 第 1 行即**自动生效**；仅 `index.html` / `electron-builder.yml` / `package.json` / `tests` 为字面量需手动改。第 1 条中的 **"Logo" = 应用图标**，由 §三 交付（改名不涉及图标文本）。

| # | 文件 | 位置/字段 | 当前值 | 改为 |
| --- | --- | --- | --- | --- |
| 1 | `src/shared/constants.ts` | `APP_NAME` | `MD-Editor-HY3-YiQi` | `YiQi@MD-Editor-wb-Hy3`（**单一来源**） |
| 2 | `index.html` | `<title>` | `MD-Editor-HY3-YiQi` | `YiQi@MD-Editor-wb-Hy3`（或全名，待确认 1） |
| 3 | `electron-builder.yml` | `productName` | `MD-Editor-HY3-YiQi` | `YiQi@MD-Editor-wb-Hy3` |
| 4 | `electron-builder.yml` | `portable.artifactName` | `MD-Editor-HY3-YiQi-Portable-${version}.${ext}` | `YiQi@MD-Editor-wb-Hy3-Portable-${version}.${ext}` |
| 5 | `electron-builder.yml` | `nsis.artifactName` | `MD-Editor-HY3-YiQi-Setup-${version}.${ext}` | `YiQi@MD-Editor-wb-Hy3-Setup-${version}.${ext}` |
| 6 | `electron-builder.yml` | `nsis.shortcutName` | `MD-Editor-HY3-YiQi` | `YiQi@MD-Editor-wb-Hy3` |
| 7 | `package.json` | `name` | `md-editor-hy3-yiqi` | 建议 `yiqi-md-editor-wb-hy3`（受 npm 命名约束：须小写、不可含 `@`/大写；内部标识非用户可见，是否改待确认 3） |
| 8 | `src/renderer/App.tsx:59` | 运行窗口标题 `文件名 — ${APP_NAME}` | 用基础名 | 保持基础名（推荐）或拼版本（待确认 1） |
| 9 | `src/renderer/App.tsx:28` | 欢迎语 `# 欢迎使用 ${APP_NAME}` | 用 `APP_NAME` 常量 | 自动更新，无需改 |
| 10 | `src/renderer/components/TopBar.tsx:19` | `📝 {APP_NAME}` 品牌字 | 用 `APP_NAME` 常量 | 自动更新，无需改 |
| 11 | `src/renderer/components/AboutDialog.tsx:13-14` | 名称 + `版本 {APP_VERSION}` | `APP_NAME` + `APP_VERSION` | 建议合并显示为全名 `YiQi@MD-Editor-wb-Hy3 v1.0.0` |
| 12 | `src/main/main.ts:253` | `createWindow` `title: APP_NAME` | 用 `APP_NAME` 常量 | 自动更新；任务栏/标题栏显示基础名 |
| 13 | `tests/constants.test.ts:5-6` | 断言 `APP_NAME` 等于旧值 | `'MD-Editor-HY3-YiQi'` | `'YiQi@MD-Editor-wb-Hy3'`（**不改会致 `vitest`/CI 失败**） |
| 14 | `electron-builder.yml` | `appId: com.mdeditor.app`（可选） | 内部升级标识 | 建议改 `com.yiqi.md-editor-wb-hy3` 或保留（影响已装版本更新标识，待确认 3） |

> 对应上一轮"9 处"：窗口标题(12)、package.json name(7)、electron-builder productName(3)/artifactName(4,5)/shortcutName(6)、index.html title(2)、TopBar 品牌字(10)、关于框(11)、运行窗口标题(8)、安装包名(4,5)、桌面快捷方式(6)。全部覆盖。

### 2.3 命名风险与约束

- **`@` 与大小写在文件名/安装包中的兼容性**：Windows 文件系统允许 `@`；NSIS `productName`/`artifactName`/`shortcutName` 一般也允许，但首次构建务必验证打包不报错、快捷方式/卸载项正常。若打包工具敏感，文件名（artifactName）可退回去 `@` 变体 `YiQi-MD-Editor-wb-Hy3`，仅**显示名**保留 `@`（待确认 3）。
- **npm `name` / `appId` 约束**：npm 包名不可含 `@` 与大写；`appId` 为反向域名内部标识，改名会令已装版本的自动更新识别失效——故二者放进待确认 3，默认建议"显示名用新名、npm/appId 仅做兼容调整或不改"。
- **测试契约同步（确定项）**：`tests/constants.test.ts` 硬编码断言旧名，改名必须与 §2.2 第 13 行同步更新，否则 `npm test` 红。

---

## 三、第 3 条 —— 应用图标（对应第 1 条"Logo"）

### 3.1 设计方向

- **调性**：酷 / 有美感、非默认。建议 **赛博霓虹（Cyber Neon）+ 玻璃拟态** 风格，强识别度、贴合"MD 编辑器 / 一气（YiQi）"的科技感。
- **配色**：深空底色径向渐变 `#0B1026 → #3B1F6B`；主点缀霓虹青 `#2DE2E6` + 品红 `#FF3CAC`；高光纯白 `#FFFFFF`；描边半透明霓虹。
- **主体图形**（二选一或融合，最终由设计师定）：
  - **A（推荐）**：圆角文档卡隐喻 `.md` + 居中粗体无衬线 **「MD」** 字母组合（霓虹描边）；卡片右上角一道斜向**笔触/闪电**，呼应 "wb" 速度感与"一气（YiQi）呵成"。
  - **B**：将命名中的 **`@`** 作为视觉母题（@ 环 + 内部 MD），强化品牌符号。
- **多尺寸**：交付真正的多尺寸 `.ico`，含 **16 / 32 / 48 / 256**；256 为高清主图（安装包、任务栏大图标、关于框用）。

### 3.2 交付物与接入点

- **交付物**：替换 `resources/icon.ico`（真正的多尺寸 ICO，不可用 PNG 直接改名；若为 PNG 源需经 `png-to-ico`/`icotool` 合成 16/32/48/256）。
- **接入点（已存在，无需改代码，仅换文件）**：
  - `electron-builder.yml` `win.icon: resources/icon.ico`
  - `electron-builder.yml` `extraResources`：`from: resources/icon.ico` → `to: icon.ico`
  - `src/main/main.ts` `getAppIcon()`：开发态 `resources/icon.ico`、打包态 `process.resourcesPath/icon.ico`，赋给 `BrowserWindow` `icon`。
- **附带核对**：确认 `index.html` 无硬编码旧 `favicon` 链接（当前 `index.html` 未引用 favicon，开发态浏览器 tab 用默认；若希望 dev tab 也显示新图标，可补 `<link rel="icon" href="icon.ico">` 并随资源拷贝）。

---

## 四、第 4 / 5 条 —— BUG 定位与修复（开放排查）

> 性质：用户称"到处是 BUG"，为**开放式排查**，无既定清单。建议手段：**vitest 回归 + 代码评审 + 手动验收清单**三件套。第 4 条为首轮定位+修复（P0），第 5 条为修复后二次自查+回归（P1）。

### 4.1 排查手段

1. **自动化回归**：`npm test`（vitest）——先确保改名后测试契约同步（§2.3），再跑全量；为高风险区补单测（见 4.2）。
2. **静态代码评审**：重点审 IPC 通道（`ipcChannels.ts` / `preload.ts` / `main.ts` handler）、React 状态流（`App.tsx` / `AppContext` / `hooks`）、CSS 主题变量完整性。
3. **手动验收清单**：按 4.2 逐项在打包产物（`dist-pkg6/`）中走查；覆盖明/暗及新增 3 套主题、缩放 0.5–2x、空文档与超大文档。

### 4.2 已知高风险区（供工程师 & QA 重点查）

| 区 | 风险点 | 建议核查动作 |
| --- | --- | --- |
| **最近打开 / clearRecents** | `clearRecents` 后菜单重建是否断链；`openRecent:` 用 `encodeURIComponent/decodeURIComponent` 对**中文/空格路径**是否正确；点击最近项 → `addRecent` 重建菜单是否竞态或递归 | 清空后菜单项消失且不再报错；含空格/中文路径可正常打开 |
| **主题切换（5 套）** | `data-theme` 切换后 CodeMirror/预览区 CSS 变量是否丢；`THEME_LIST` 与 `ThemeName` 枚举一致；旧 `localStorage['md-editor:theme']` 键兼容 | 5 套主题逐项切换配色正确、无白屏/错位 |
| **图片拖拽** | `handleDrop` 图片分支 vs `.md` 分支判断；落盘目录权限；写入 recents 用**绝对路径**（`file.path`）；与粘贴落盘路径一致 | 拖图入编辑器插入 `![](相对路径)` 且可重开 |
| **复制为 HTML** | sandbox/无 Clipboard API 时回退 `writeText`；空文档 `.markdown-body` 不存在 | 富文本与纯文本回退均可用 |
| **浮动 UI（聚焦/打字机/关于框/搜索）** | focus-mode 虚化依赖 `.cm-activeLine`；typewriter 居中计算在**不同行高/缩放 zoom** 下是否仍居中；AboutDialog 遮罩点击关闭与焦点；SearchPanel 与 zoom 协同 | 两种模式可叠加且居中正确；关于框关闭正常 |
| **窗口标题更新** | `updateWinTitle` 在 open/save/drop 后是否一致触发；未打开文件 `untitled.md` 兜底；em dash `—` 编码 | 标题随文件动态且统一 |
| **缩放 zoom** | zoom 改变时编辑/预览同步；typewriter 居中是否乘以 zoom | 0.5–2x 下布局与居中正常 |
| **构建/打包** | artifactName 含 `@`/大写是否通过 NSIS；快捷方式/卸载项；extraResources 图标拷贝 | `npm run dist` 成功，安装包名/图标正确 |
| **自动保存/草稿** | `DRAFT_KEY` localStorage 解析异常兜底 | 损坏草稿不崩，回退空文档 |
| **测试契约（确定项）** | `tests/constants.test.ts` 断言旧名 → 改名必须同步，否则 CI 红 | 改名同时更新断言 |

> **确定性 BUG（必修）**：① `tests/constants.test.ts` 硬编码旧名断言，改名后 `npm test` 必失败；② `dist/`、`dist-electron/`、`dist-pkg6/` 为旧名构建产物，须重新打包（且确保 `.gitignore` 覆盖，push 不带上旧二进制）。

---

## 五、第 6 条 —— 悬浮复制按钮

### 5.1 触发条件（覆盖组件，建议清单）

- **预览区代码块** `.markdown-body pre` / `code` —— 长代码最常需复制（**建议必含**）。
- **预览区长文块**：表格、长引用、长段落（建议按"文本块高度/字符数阈值"自动判定为"大段文字"）。
- **关于框** `AboutDialog` 简介长文。
- **状态栏长文本**：如当前文件路径、字数详情（可选）。
- **错误信息 / 弹窗**：保存失败、图片落盘失败等提示文案。
- **编辑器源码区**：用户说"Text 处"可能含编辑区，但编辑区原生复制已完备，悬浮按钮意义低 → **建议仅覆盖"只读展示型"文本区**，编辑区沿用原生复制（精确清单见 §六 待确认 2）。

### 5.2 交互

- 鼠标**悬浮**目标文本区 → 右上角浮现圆形 **📋 复制** 按钮（`opacity` 过渡，尊重 `prefers-reduced-motion`）。
- 点击 → 写入剪贴板 → 按钮态变 **「已复制 ✓」** 并短暂提示（toast / 按钮态 1.5s）→ 失败回退 `writeText` 并提示。
- 明/暗及新增 3 套主题下均清晰可见，不遮挡原文。

### 5.3 实现建议（复用已有复制逻辑）

- 新增通用组件 `CopyButton` / `CopyableBlock`（包裹"相对定位容器 + 绝对定位悬浮按钮"）。
- **复用 `copyHtml` 思路**（`src/renderer/App.tsx:127`）：`ClipboardItem({ 'text/html': Blob, 'text/plain': Blob })` + `writeText` 回退。
  - 代码块/纯文本块：新增 `copyText(text)` 仅写 `text/plain`（取 `textContent`）。
  - 预览富文本块：复用 `copyHtml`（取 `.markdown-body` innerHTML）。
- 验收：悬停显示、点击复制成功、反馈清晰、主题下可见、不遮挡。

---

## 六、待确认问题（向用户澄清）

1. **版本号落地位置**：需求原文"所有位置…再加版本号"。建议：**窗口标题/运行标题用基础名**（不带版本），**关于框/安装包/桌面快捷方式显示全名 `YiQi@MD-Editor-wb-Hy3 v1.0.0`**，exe 由 `artifactName` 模板天然含版本。是否接受此分法？还是**所有位置（含窗口标题、exe 文件名）都要拼版本号**？
2. **悬浮复制按钮覆盖区域精确清单**：是否仅覆盖"只读展示型"文本（预览代码块/关于框/状态栏/错误），还是**也包括编辑器源码区**？代码块是否必含？请确认最终覆盖清单（影响 §五 实现范围）。
3. **图标风格偏好 与 命名中 `@` 的处理**：图标倾向"赛博霓虹渐变 + MD 字母"（§三 A）还是其他方向（极简线性 / 玻璃拟态 / `@` 母题 B）？另：`package.json name`（npm 约束）与 `appId` 是否随改名调整（§2.3），以及**安装包/exe 文件名中的 `@` 是否保留**（Windows 允许但部分打包工具敏感，否则文件名退回 `YiQi-MD-Editor-wb-Hy3`、仅显示名保留 `@`）？

---

## 七、验收要点（摘要）

- P0：全部用户可见位置显示 `YiQi@MD-Editor-wb-Hy3`（关于框/安装包带 `v1.0.0`）；`npm test` 通过（测试契约已同步）；图标为新风设计、非默认、多尺寸正确、安装包/任务栏显示新图标；首轮 BUG 高风险区排查并修复；`npm run dist` 成功并 push 至 `git@github.com:WangXP7/YiQi-MD-Editor.git`（main）。
- P1：二次 BUG 自查 + 回归无新增阻断；预览代码块等"大段文字"处悬浮复制按钮可用、反馈清晰、主题兼容。
- 不破坏第一轮已交付能力（最近打开/专注打字机/括号配对/复制HTML/3 主题/图片拖拽）的回归测试覆盖。
