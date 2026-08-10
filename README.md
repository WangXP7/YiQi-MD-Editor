# YiQi@MD-Editor-千问-GLM5.2

![icon](build/icon.png)

> 一款美观、功能齐全的 Markdown 查看/编辑器，支持 Windows 独立运行。

**版本：v1.0.0**

## ✨ 功能特性

- **全协议 Markdown 支持**
  - CommonMark + GFM（表格、任务列表、删除线、自动链接）
  - 脚注、上下标、定义列表、缩写、插入、标记
  - 容器块（`::: tip / warning / danger / info / details`）
  - Emoji 表情（`:smile:` `:heart:` `:rocket:`）
- **数学公式**：基于 KaTeX，行内 `$...$` 与块级 `$$...$$`
- **图表/流程图**：基于 Mermaid（流程图、时序图、甘特图、饼图等）
- **代码高亮**：基于 highlight.js，支持全语言
- **多种视图**：纯编辑 / 分屏实时预览 / 纯预览
- **多主题切换**：暗色（默认）/ 亮色 / 护眼绿
- **大纲导航**：自动生成标题大纲，点击跳转
- **文件操作**：新建、打开、保存、另存为，支持拖放打开
- **导出**：导出 HTML、导出 PDF
- **快捷键**：完整的编辑与格式化快捷键

## ⌨️ 快捷键

| 快捷键 | 功能 | 快捷键 | 功能 |
| --- | --- | --- | --- |
| Ctrl+N | 新建 | Ctrl+O | 打开 |
| Ctrl+S | 保存 | Ctrl+Shift+S | 另存为 |
| Ctrl+E | 导出 HTML | Ctrl+Shift+P | 导出 PDF |
| Ctrl+B | 加粗 | Ctrl+I | 斜体 |
| Ctrl+D | 删除线 | Ctrl+K | 插入链接 |
| Ctrl+Shift+C | 代码块 | Ctrl+/ | 分屏模式 |
| Ctrl+F | 查找替换 | Ctrl+Shift+O | 大纲 |
| Ctrl+= / - | 缩放 | Ctrl+0 | 重置缩放 |

## 📦 下载与使用

前往 [Releases](../../releases) 页面下载：

- **便携版**（`YiQi@MD-Editor-千问-GLM5.2-1.0.0-Portable.exe`）：单文件，下载即可运行，无需安装
- **安装版**（`YiQi@MD-Editor-千问-GLM5.2-1.0.0-Setup.exe`）：带安装向导，可自定义安装路径

### 运行要求

- Windows 10 / 11（64 位）

## 🛠️ 技术栈

- **Electron** 31 — 跨平台桌面框架
- **markdown-it** 14 + 全插件链 — Markdown 解析
- **CodeMirror** 5 — 代码编辑器
- **KaTeX** 0.16 — 数学公式渲染
- **Mermaid** 10 — 图表/流程图
- **highlight.js** 11 — 代码高亮
- **electron-builder** — 打包

## 🔧 从源码构建

```bash
# 安装依赖
npm install

# 开发模式运行
npm start

# 打包 Windows 可执行文件
npm run build
```

打包产物位于 `release/` 目录。

## 📁 项目结构

```
YiQi-MD-Editor/
├── src/
│   ├── main.js          # Electron 主进程：窗口、菜单、文件读写、导出
│   ├── preload.js       # 安全预加载脚本（contextBridge）
│   ├── index.html       # 主界面
│   ├── renderer.js      # 渲染进程：编辑器、预览、大纲、交互逻辑
│   └── styles.css       # 界面样式（三主题）
├── build/
│   ├── icon.ico         # 应用图标
│   └── icon.png         # 图标源文件
├── package.json         # 项目配置与打包参数
└── .gitignore
```

## 📄 版本

- **v1.0.0**（2026-08）首个正式版本

## 📝 协议

MIT License

Copyright © 2026 WangXP7

---

**YiQi@MD-Editor-千问-GLM5.2** · Powered by 千问办公助理
