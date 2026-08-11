# YiQi@MD-Editor-GPT5.6SolxHigh-v1.1.3

YiQi@MD-Editor-GPT5.6SolxHigh-v1.1.3 是一款面向 Windows 的离线 Markdown 查看与编辑器，提供现代化双栏界面、实时预览和完整的本地文件工作流。

## 主要能力

- CommonMark 与 GitHub Flavored Markdown（GFM）
- 标题、列表、引用、表格、任务清单、脚注、定义列表
- 高亮、插入、上下标、Emoji、常用内嵌 HTML
- KaTeX / LaTeX 数学公式
- Mermaid 流程图、时序图、甘特图、类图等
- 常见编程语言的代码高亮
- 编辑、分栏、预览三种视图和可拖动分隔线
- 顶部多文档标签页，可同时打开、独立编辑并快速切换多个 Markdown 文档
- 文档大纲双栏同步定位、最近文件、字数/字符/阅读时间统计
- 拖放打开、另存为、HTML/PDF 导出
- 深色/浅色主题、预览缩放、快捷格式工具栏
- 段落、代码、引用、列表和表格等内容块的悬浮复制按钮
- `.md`、`.markdown`、`.mdown`、`.mkd` 文件关联

渲染阶段使用 DOM 清理保护预览区域；远程链接由系统默认浏览器打开。应用本身不依赖云端服务。

## 开发

需要 Node.js 22 或更高版本，以及 pnpm。

```powershell
pnpm install
pnpm dev
```

## Windows 打包

完整版（内置 Chromium，兼容性最强）：

```powershell
pnpm build
```

轻量版（使用 Windows WebView2，功能保持一致）：

```powershell
python -m pip install -r compact/requirements.txt
pnpm build:lite
```

打包产物位于 `release`：

- `YiQi@MD-Editor-GPT5.6SolxHigh-v1.1.3-Setup-x64.exe`：完整版安装包
- `YiQi@MD-Editor-GPT5.6SolxHigh-v1.1.3-Portable-x64.exe`：完整版免安装包
- `YiQi@MD-Editor-GPT5.6SolxHigh-v1.1.3-Lite-WebView2-x64.exe`：轻量单文件版

轻量版不再重复携带 Chromium，而是复用 Windows 10/11 通常已安装的 Microsoft Edge WebView2 Runtime；因此体积显著更小。若系统没有 WebView2 Runtime，需要先安装该运行库。

发布包只包含 Vite 已编译的完整前端资源和应用所需的中英文 Electron 语言资源，避免重复打包仅供构建使用的 `node_modules`，不裁剪 Markdown、图表、公式、代码高亮等运行功能。

应用未附带商业代码签名证书，因此在部分 Windows 设备首次运行时，SmartScreen 可能显示未知发布者提示。

## 快捷键

| 快捷键 | 操作 |
| --- | --- |
| `Ctrl + N` | 新建文档 |
| `Ctrl + O` | 打开文档 |
| `Ctrl + W` | 关闭当前标签 |
| `Ctrl + S` | 保存 |
| `Ctrl + Shift + S` | 另存为 |
| `Ctrl + F` | 查找 / 替换 |
| `Ctrl + B` | 粗体 |
| `Ctrl + I` | 斜体 |
| `Ctrl + Shift + P` | 预览模式 |

## 技术栈

Electron、Vite、CodeMirror 6、markdown-it、DOMPurify、KaTeX、Mermaid 与 highlight.js。

## License

MIT
