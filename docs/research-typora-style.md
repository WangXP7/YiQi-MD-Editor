# Typora 等主流 Markdown 编辑器深度调研报告

> 调研人：产品经理 许清楚（Xu）
> 日期：2026-08-06
> 目的：为 `md-editor`（Windows 桌面 Markdown 编辑器）增量版本筛选"值得借鉴且我们尚未具备"的能力，并给出融入优先级。
> 方法：基于各编辑器官方站、文档与公开评测的联网检索（见文末"资料来源"），部分细节标注"待核实"。

---

## 一、调研概览

本次调研覆盖 7 款在"所见即所得 / 专注写作 / 知识管理"方向有代表性的编辑器：

| 编辑器 | 定位 | 平台 | 价格 | 是否 WYSIWYG |
| --- | --- | --- | --- | --- |
| **Typora** | 极简写作 + 专业导出 | Win/Mac/Linux | $14.99 买断 | 是（核心特性） |
| **MarkText** | 开源免费 Typora 替代 | Win/Mac/Linux | 免费（MIT） | 是 |
| **Obsidian** | 本地优先知识库（PKM） | Win/Mac/Linux | 免费 + 付费同步 | 否（源码+预览） |
| **VS Code** | 通用代码编辑器 + MD 扩展 | Win/Mac/Linux | 免费 | 扩展决定 |
| **Zettlr** | 学术写作 + 引用管理 | Win/Mac/Linux | 免费（开源） | 分屏预览 |
| **iA Writer** | 极致专注写作 | Win/Mac/iOS | 买断/订阅 | 否（纯文本+预览） |
| **Bear** | 优雅笔记（Apple 生态） | Mac/iOS | 免费 + Pro 订阅 | 否（Apple 独占） |

> 结论先行：Typora / MarkText 与我们的"双栏编辑 + 实时预览"架构最接近，是**主要借鉴对象**；Obsidian / Zettlr 偏知识管理与学术，其双链/图谱/引用能力**与本 app 单文档定位不符**，仅可借鉴"快速打开""全文检索"等通用能力；iA Writer / Bear 的**设计哲学（极致简约、排版美学）**对我们的"界面美观"硬指标最有启发。

---

## 二、逐款编辑器分析

### 2.1 Typora（重点）

**界面特点**
- 真正的 WYSIWYG：无独立预览窗、无模式切换，Markdown 语法在输入瞬间就地渲染（"What You See Is What You Mean"）。
- 极简默认布局：工具栏/面板默认隐藏，写作区占主导；支持自定义 CSS 主题。
- 侧边栏三种视图：**文件树（File Tree）/ 文章列表（Articles）/ 大纲（Outline）**，可拖拽组织文件。
- 大纲面板自动生成标题层级，点击跳转；支持内部链接与书签。

**功能清单**
- 实时预览、专注模式（Focus，虚化其他行）、打字机模式（Typewriter，活动行居中）。
- 表格：可视化拖拽改列宽、从 Excel 智能粘贴、插入/删除行列。
- 图表：Mermaid、flowchart.js、时序图（基于 MathJax/mhchem 扩展）。
- 数学：LaTeX 行内/块级，公式自动编号（待核实：自动编号开关）。
- 代码高亮约 100 种语言；Emoji 自动补全；列表缩进/改类型快捷键。
- 图片：拖拽插入、相对路径/base 目录、`<img>` 自定义尺寸、iPic 云上传（macOS）。
- 自动配对括号与 Markdown 符号（`*`、`_` 等）；智能标点（待核实：仅英文语境）。
- 字数统计（词/字符/行/预估阅读时间）；自定义 CSS 主题。
- 导出：PDF（带书签）、HTML、Word(docx)、ePub、LaTeX、RTF（经 Pandoc）。
- Front Matter、脚注（悬停预览）、`[TOC]` 目录、内部链接。

**值得借鉴且我们尚未具备**
1. 专注模式 / 打字机模式（高价值、低风险，CSS 即可实现）。
2. 图片**拖拽**入编辑器（我们仅有粘贴落盘，缺拖拽路径）。
3. 自动配对括号 / 智能标点（CodeMirror 6 已有 `closeBrackets`，启用成本低）。
4. 复制为 HTML / 富文本（我们仅有"导出 HTML 文件"，缺"复制到剪贴板"）。
5. 导出 Word / ODT / ePub（我们仅有 HTML/PDF）。
6. 更多内置主题（我们仅明/暗两套）。
7. 侧边栏**文件树**（我们仅有大纲 TOC + 文档信息）。
8. 表格可视化编辑工具栏（我们表格仅渲染、不可视化编辑）。
9. 阅读时间估算（字数统计已有，差"分钟数"）。

---

### 2.2 MarkText

**界面特点**：WYSIWYG + 源码双模式；支持**源码 / 打字机 / 专注**三种模式切换；27+ 内置主题；分栏与沉浸皆可。

**功能清单**：所见即所得实时渲染；KaTeX 数学；Mermaid/Vega 图表；脚注双向引用；表格可视化编辑；**富文本粘贴自动转 Markdown**；**剪贴板图片粘贴落盘**；导出 PDF/HTML；**复制为富文本**；**拼写检查**；**多光标编辑**（来自 VS Code）；200+ 语言。

**值得借鉴且我们尚未具备**
- 复制为富文本（RTF）（与 Typora 互补）。
- 拼写检查（我们缺失）。
- 富文本粘贴转 Markdown（中风险，需 HTML→MD 转换库）。
- 多光标编辑（CodeMirror 6 原生支持，可能未启用）。
- 更多主题（同 Typora）。

---

### 2.3 Obsidian

**界面特点**：左侧文件浏览器/搜索/标签/大纲面板；编辑器为源码（带实时渲染插件）；核心差异化是**图谱视图（Graph View）**与**反向链接面板**。

**功能清单**：双向链接 `[[ ]]`、图谱视图、反向链接/出链、标签、Canvas 白板、核心+社区插件（Dataview、Tasks、Excalidraw）、模板、日记、引文（Zotero）。

**值得借鉴且我们尚未具备**（与单文档编辑器相关性低）
- **快速打开（Ctrl+P 模糊查找）**：通用且契合我们（前提是建设文件树）。
- **全文检索**：我们仅有当前文档内查找/替换。
- 其余（双链、图谱、插件系统）**属知识管理范畴，与本项目定位不符**，不建议纳入。标注：双链/图谱为**低优先/不采纳**。

---

### 2.4 VS Code（Markdown 相关能力）

**界面特点**：经典分栏（编辑 + 预览扩展）；大纲视图（Outline）在资源管理器底部；强在"工程化编辑"。

**功能清单**：文档大纲、Markdown 片段（snippets）、`Ctrl+Shift+O` 跳转到标题、路径自动补全（链接/图片）、**拖拽与粘贴图片（自动复制到工作区 `markdown.copyFiles.destination`）**、插入图片/文件链接命令、字数（扩展）、Markdown All in One（自动补全/目录/快捷键）、Paste Image、Code Spell Checker、滚动同步预览。

**值得借鉴且我们尚未具备**
- 图片拖拽 + 粘贴自动落盘（我们已有粘贴落盘，缺**拖拽**与**路径补全**）。
- 拼写检查（同 MarkText）。
- 自动配对/多光标（CodeMirror 可启用）。
- 路径自动补全（中风险，需解析工作区）。

---

### 2.5 Zettlr

**界面特点**：学术写作工作台；分屏、专注模式；项目（Project）管理多文件书稿；可自定义 CSS、Vim 键位。

**功能清单**：LaTeX 公式、Mermaid；**引文管理（Zotero/JabRef/BibTeX，9000+ 样式）**；**Pandoc 一键导出 PDF/Word/LaTeX/EPUB/ODT/幻灯片**；全文检索；PDF 批注；写作统计；拼写检查/LanguageTool；双向链接/Zettelkasten；项目字数统计。

**值得借鉴且我们尚未具备**
- Pandoc 多格式导出（Word/ODT/EPUB）——但我们**不宜直接捆绑 Pandoc**（体积大），见 §四替代方案。
- 全文检索（同 Obsidian）。
- 写作统计/项目结构（中风险）。
- 引文管理：与单文档定位不符，**不采纳**。

---

### 2.6 iA Writer

**界面特点**：极致极简，无按钮/弹窗/标题栏干扰；标志性蓝色光标、灰底；"写作排版学"自定义等宽字体（IBM Plex Mono 衍生）；明暗反转。

**功能清单**：**专注模式（虚化当前句/段）**；**语法高亮（按词性着色名词/动词/形容词）**；**风格检查（Style Check，标出陈词/赘语）**；100% 纯文本；导出 PDF/Word/HTML；**复制为 HTML**；模板；资料库（文件夹/收藏/标签）；跨平台。

**值得借鉴且我们尚未具备**
- 专注模式（同 Typora，重点借鉴其"按句/段虚化"的细腻实现）。
- 复制为 HTML（同 Typora）。
- 语法高亮/风格检查：**高价值但高风险**（NLP 依赖），建议 P2 或更后。
- **设计启发**：排版美学、留白、字体选择——直接服务"界面美观"硬指标。

---

### 2.7 Bear

**界面特点**：Apple 设计奖级简约界面；30+ 主题、15 个应用图标；标题折叠（Outline with focus）；标签驱动组织。

**功能清单**：`#` 标签（嵌套/置顶）、维基链接、导出 PDF/HTML/DOCX/JPG/ePub/RTF/TextBundle；**图片内/PDF 内 OCR 搜索（PRO）**；图片缩放裁剪；iCloud 同步；加密；**大纲标题折叠**。

**值得借鉴且我们尚未具备**
- **大纲标题折叠**（我们 TOC 仅点击跳转，缺折叠）——低风险，建议采纳。
- 多格式导出（同 Typora/Zettlr）。
- 其余（标签体系、iCloud、OCR）与 Windows 单文档定位不符，**不采纳**。

---

## 三、功能对比表（功能 × 编辑器）

图例：✅ 原生支持 ｜ ◐ 部分/扩展支持 ｜ — 不支持/无关 ｜ （我们）现状列说明本 app 当前能力

| 功能 | Typora | MarkText | Obsidian | VS Code | Zettlr | iA Writer | Bear | **我们现状** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WYSIWYG 实时预览 | ✅ | ✅ | — | ◐ | — | — | — | 双栏实时预览 ✅ |
| 专注模式 Focus | ✅ | ✅ | — | — | ✅ | ✅ | — | ❌ 缺 |
| 打字机模式 | ✅ | ✅ | — | — | — | — | — | ❌ 缺 |
| 大纲 / 目录 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ TOC 侧栏 |
| 侧边栏文件树 | ✅ | ✅ | ✅ | ✅ | ✅ | ◐ | — | ❌ 缺 |
| 图片拖拽入编辑器 | ✅ | ✅ | ◐ | ✅ | ◐ | — | — | ❌ 仅粘贴 |
| 图片粘贴落盘 | ✅ | ✅ | ◐ | ✅ | ◐ | ✅ | ✅ | ✅ `images/` |
| 表格可视化编辑 | ✅ | ✅ | — | — | — | — | — | ❌ 仅渲染 |
| 自动配对括号 | ✅ | ✅ | — | ◐ | — | — | — | ❌ 疑似未启用 |
| 复制为 HTML | ✅ | ✅ | — | — | — | ✅ | ✅ | ❌ 仅导出文件 |
| 复制为富文本/RTF | ✅ | ✅ | — | — | — | — | ✅ | ❌ 缺 |
| 导出 Word/ODT | ✅ | — | — | ◐ | ✅ | ✅ | ✅ | ❌ 仅 HTML/PDF |
| 导出 ePub/图片 | ✅ | — | — | ◐ | ✅ | — | ✅ | ❌ 缺 |
| 内置主题数量 | 多(付费) | 27+ | 少 | 多(扩展) | 多 | 少 | 30+ | 2（明/暗） |
| 拼写检查 | — | ✅ | ◐ | ✅ | ✅ | — | ◐ | ❌ 缺 |
| 全文检索 | — | — | ✅ | ◐ | ✅ | ◐ | ✅ | ❌ 仅当前文档 |
| 双向链接/图谱 | — | — | ✅ | — | ◐ | — | ◐ | ❌（不采纳） |
| 数学公式 KaTeX | ✅ | ✅ | ◐ | ◐ | ✅ | — | — | ✅ 已有 |
| 图表 Mermaid | ✅ | ✅ | ◐ | ◐ | ✅ | — | — | ✅ 已有 |
| 代码高亮 | ✅ | ✅ | ◐ | ✅ | ✅ | — | — | ✅ highlight.js |
| 字数统计 | ✅ | ✅ | ◐ | ◐ | ✅ | — | — | ✅ 状态栏 |
| 阅读时间估算 | ✅ | — | — | — | ✅ | — | — | ❌ 缺 |
| 明暗主题切换 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ 已有 |
| 查找 / 替换 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ 已有 |

---

## 四、对我们 app 的融入建议与优先级

### 4.1 优先级矩阵（价值 × 风险/成本）

| 优先级 | 功能 | 价值 | 风险/成本 | 契合度 |
| --- | --- | --- | --- | --- |
| **P0** | 最近打开菜单 | 高 | 低 | 高（用户明示） |
| **P0** | 全量改名 `MD-Editor-HY3-YiQi` | 高 | 低 | 高（用户明示） |
| **P0** | 图片拖拽入编辑器 | 高 | 低 | 高（已有 saveImage IPC） |
| **P0** | 专注模式 Focus | 高 | 低 | 高（Typora/iA 验证） |
| **P0** | 打字机模式 Typewriter | 高 | 低 | 高 |
| **P1** | 自动配对括号/智能标点 | 中高 | 低 | 高（CodeMirror 原生） |
| **P1** | 复制为 HTML | 中高 | 低 | 高 |
| **P1** | 导出 Word/ODT | 高 | 中 | 高（用户常用） |
| **P1** | 更多内置主题 | 中 | 低 | 高（美观硬指标） |
| **P1** | 导出图片（PNG 预览截图） | 中 | 中低 | 中 |
| **P2** | 侧边栏文件树 | 高 | 中高 | 中（需新 FS IPC） |
| **P2** | 表格编辑工具栏 | 中高 | 中高 | 中 |
| **P2** | 拼写检查 | 中 | 中 | 中 |
| **P2** | 大纲标题折叠 | 中 | 低 | 中 |
| **P2** | 阅读时间估算 | 低 | 低 | 中 |
| **P2** | 快速打开 Ctrl+P（依赖文件树） | 中 | 中 | 中 |

> 采纳原则：**高价值 + 低风险 + 契合现有架构（React + CodeMirror 6 + react-markdown）优先**。Obsidian 双链/图谱、Zettlr 引文、Bear 标签/iCloud 等**知识管理类能力不纳入**本轮。

### 4.2 导出 Word/ODT 的替代方案（重要）
- **不建议**直接捆绑 Pandoc（~30MB，安装态不确定）。
- 推荐：复用现有"自包含 HTML"导出能力，引入轻量库 `html-docx-js`（仅 devDependency）将 HTML 转为 `.docx`；ODT 可用类似 HTML→ODT 思路或后续评估 `mammoth` 反向。公式/Mermaid 在 Word 内会退化为静态图或丢失——**需在 PRD 中标注已知限制**。

### 4.3 设计启发（服务"界面美观"硬指标）
- 借鉴 iA Writer / Typora：**专注模式下的细腻虚化**、**舒适字号/行高/留白**、**优雅光标与配色**。
- 主题体系：在明/暗之外，提供 2–3 套高质感主题（如"纸张""石墨""午夜"），CSS 变量驱动，一键切换。
- 窗口标题采用 Typora 风格：`文件名 — MD-Editor-HY3-YiQi`（融入改名项）。

---

## 五、资料来源

1. Typora 官网特性页：https://typora.io ／ https://support.typora.io/
2. Typora 功能综述（indexall）：https://indexall.io/typora.io
3. Typora 2026 评测（appmus）：https://appmus.com/software/typora
4. MarkText 官网：https://marktext.me/ ／ 中文站 https://www.mark-text.cn/
5. Obsidian 图谱/插件：https://obsidian.aiproducthub.cn/ ／ https://www.makeuseof.com/obsidian-plugins-visualize-notes
6. Zettlr 官网/学术特性：http://www.zettlr.com.cn/ ／ https://techbeta.org/software/zettlr-markdown-editor-for-academic-writing-and-research/
7. iA Writer 官网：http://www.iawriter.com/ ／ 特性 https://handwiki.org/wiki/Software:IA_Writer
8. Bear 官网：https://bear.app/ ／ 中文 https://bear.app/zh/
9. VS Code Markdown 文档：https://code.visualstudio.com/docs/languages/markdown
10. VS Code Markdown 扩展（MD View / Markdown Super）：Visual Studio Marketplace

> 说明：部分高级特性（如 Typora 公式自动编号、智能标点的语言范围、Bear OCR）在不同版本/平台存在差异，已在正文标注"待核实"，建议工程实现前以目标版本实际安装验证。
