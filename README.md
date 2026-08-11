# YiQi@MD-Editor-GPT5.6SolxHigh-v1.1.1

YiQi@MD-Editor-GPT5.6SolxHigh-v1.1.1 是一款面向 Windows 的离线 Markdown 查看与编辑器，提供现代化双栏界面、实时预览和完整的本地文件工作流。

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

```powershell
pnpm build
```

打包产物位于 `release`：

- `YiQi@MD-Editor-GPT5.6SolxHigh-v1.1.1-Setup-x64.exe`：安装版
- `YiQi@MD-Editor-GPT5.6SolxHigh-v1.1.1-Portable-x64.exe`：免安装便携版

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
