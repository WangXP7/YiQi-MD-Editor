<div align="center">

![浅色版图标](resources/icon-256.png)

# YiQi@MD-Editor-wb-DSv4-Flash 1.0.0

**水墨国风 · 全格式 Markdown 查看 / 编辑桌面应用**

![深色版图标](resources/icon-dark-256.png)

*「墨」字书法 · 墨韵山水 · 朱红印章 — 浅色 / 深色双主题水墨图标*

</div>

---

## ✨ 功能特性

| 类别 | 能力 |
|------|------|
| **多标签编辑** | VS Code 风格顶部标签栏：同时打开多份 MD、点击切换、✕/中键关闭、未保存确认、脏标记 `*`、标签横向滚动 |
| **编辑体验** | CodeMirror 6：行号、括号匹配、代码折叠、自动补全、当前行高亮、Tab 缩进 |
| **实时预览** | 双栏分屏 + 滚动联动，支持 仅编辑 / 仅预览 / 分屏 三种视图（Ctrl+1/2/3） |
| **格式支持全** | GFM 表格/任务列表/删除线/自动链接、脚注、emoji、KaTeX 数学公式、highlight.js 代码高亮、Mermaid 图、`[[toc]]` 目录、上标/下标/缩略语 |
| **文件操作** | 新建标签 (Ctrl+N) / 打开 (Ctrl+O) / 保存 (Ctrl+S) / 另存为 (Shift+Ctrl+S)、拖拽打开、最近打开文件、会话恢复 |
| **编码兼容** | 自动检测 UTF-8 / UTF-8 BOM / GBK / GB18030 / UTF-16，GBK 文件不乱码 |
| **导出** | 导出 HTML（样式内嵌独立可开）、导出 PDF（A4 打印） |
| **界面** | 亮/暗主题一键切换（Ctrl+T）、简体中文、状态栏统计（行/字/字符/光标）、窗口位置记忆 |
| **安全** | contextIsolation + nodeIntegration:false，预览区 sandbox iframe 隔离 |

## 🚀 快速开始

```bash
# 开发运行
npm install
npm run build:renderer   # esbuild 打包渲染层（生成 vendor/bundle.js + KaTeX 字体内嵌）
npm start

# 打包 Windows 可执行文件（portable 绿色版 + nsis 安装包，产物在 build/）
npm run dist:win
```

### 直接使用（无需安装）

下载 `build/YiQi@MD-Editor-wb-DSv4-Flash 1.0.0-portable-x64.exe`，双击即用。

## 🧱 技术栈

- **Electron 31**（主进程 / preload / renderer 三层）
- **CodeMirror 6** — 编辑器核心（`@codemirror/*` 全家桶）
- **markdown-it 14** + 扩展全家桶 — 渲染管线
- **KaTeX** — 数学公式（字体内嵌 data URI，离线可用）
- **highlight.js** — 代码高亮
- **Mermaid 10** — 流程图/时序图/甘特图
- **iconv-lite** — 多编码读写
- **esbuild** — 渲染层打包
- **electron-builder** — Windows 打包

## 🗂 多标签架构

- **单 CodeMirror 实例 + 多 Tab 状态**：每个标签独立保存 内容 / 编码 / 脏标记 / 滚动 / 光标；
  切换标签时把当前编辑器状态写回旧标签，再将新标签内容载入同一编辑器
  （`editor.setDoc` + 滚动/光标恢复），避免多实例的内存开销与切换闪烁。
- `src/renderer/tabbar.js` — TabManager：标签创建 / 切换 / 关闭 / 保存 / 脏标记 / tab 栏渲染。
- `src/renderer/fileops.js` — FileOps 共享单例，通过 `setActiveTab(tab)` 指向当前标签。

## 📁 项目结构

```
md-editor/
├── package.json            # 依赖与 electron-builder 配置
├── scripts/
│   └── build-renderer.mjs  # esbuild 渲染层打包 + KaTeX 字体内嵌
├── resources/              # 应用图标（水墨国风，浅/深双主题）
│   ├── icon.ico            # 主图标（16-256 多尺寸，已内嵌 exe）
│   ├── icon-dark.ico       # 深色主题变体
│   └── make-icon.py        # 图标生成/去水印脚本
└── src/
    ├── main.js             # 主进程：窗口/菜单/对话框/编码检测/导出
    ├── preload.js          # contextBridge 安全 IPC API
    └── renderer/           # 渲染层：编辑器/多标签/预览/文件/查找/样式
```

## 🧪 测试

```bash
node qa-verify.mjs          # 渲染管线 + 编码 + IPC + 产物 + 改名/多标签验证
node qa-regression.mjs      # 回归检查（含改名与多标签）
```

## 📄 许可证

MIT
