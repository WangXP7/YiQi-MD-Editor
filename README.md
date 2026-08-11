# 墨览YiQi@MD-Editor-千问办公-Qwen3.8-Max v1.1.0

![logo](assets/logo.png)

**墨览YiQi@MD-Editor-千问办公-Qwen3.8-Max v1.1.0** 是一款面向 Windows 的独立运行（单文件 .exe）Markdown 查看 / 编辑工具，界面美观、功能全面、完全离线可用。

## ✨ 功能特性

- **多标签页（v1.1.0 新增）**：顶部标签栏同时打开多个文档，点击切换、`Ctrl+Tab` 循环切换、`Ctrl+W` 关闭、未保存橙点提示
- **三视图模式**：纯编辑 / 编辑+实时预览分屏 / 纯预览，分屏比例可拖动，双向同步滚动
- **完整的 Markdown 生态**：
  - CommonMark + GFM（表格、任务列表、删除线、自动链接）
  - 脚注、定义列表、缩写、上标/下标、高亮标记、插入线
  - Emoji 短代码（`:rocket:`）
  - YAML Frontmatter 面板展示
  - 容器块（`::: note / info / tip / warning / danger`）
- **KaTeX 数学公式**：行内 `$...$`、块级 `$$...$$`，支持 mhchem 化学式
- **Mermaid 图表**：流程图、时序图、甘特图等，随主题自动切换配色
- **代码高亮**：highlight.js 190+ 语言，代码块带语言标签与一键复制
- **编辑器**：CodeMirror 5，Markdown 语法着色、行号、自动续列表、活动行高亮、搜索（Ctrl+F）
- **文档大纲侧栏**：标题树实时提取，点击跳转
- **文件能力**：打开/保存/另存为（UTF-8 / GBK / Big5 编码自动识别）、拖拽打开、本地图片自动内联显示
- **导出**：一键导出独立 HTML（KaTeX 字体内嵌，离线可看）、打印
- **明暗双主题**，状态栏实时统计字数/词数/行数与光标位置

## ⌨️ 快捷键

| 快捷键 | 功能 | 快捷键 | 功能 |
| --- | --- | --- | --- |
| Ctrl+O | 打开 | Ctrl+S | 保存 |
| Ctrl+Shift+S | 另存为 | Ctrl+E | 导出 HTML |
| Ctrl+P | 打印 | Ctrl+N | 新建标签页 |
| Ctrl+Tab | 切换标签页 | Ctrl+W | 关闭标签页 |
| Ctrl+B | 加粗 | Ctrl+I | 斜体 |
| Ctrl+K | 插入链接 | Ctrl+F | 搜索 |
| Ctrl+1/2/3 | 编辑/分屏/预览 | Ctrl+\\ | 大纲侧栏 |
| F1 | 关于 | | |

## 🚀 使用

直接双击运行：

```
dist/墨览YiQi@MD-Editor-千问办公-Qwen3.8-Max-v1.1.0.exe
```

单文件、免安装、无网络依赖。系统需 Windows 10/11 及 WebView2 运行时（Win10 以上通常已自带）。

## 🛠️ 从源码构建

```bash
pip install pywebview pyinstaller pillow pythonnet
python make_icon.py            # 生成 assets/icon.ico 与 logo.png（可选）
pyinstaller --noconfirm --windowed --onefile \
  --name "墨览YiQi@MD-Editor-千问办公-Qwen3.8-Max-v1.1.0" \
  --icon assets/icon.ico --version-file version_info.txt \
  --add-data "src/web;web" --collect-all webview --collect-all clr_loader \
  src/main.py
```

## 🧪 渲染自测

```bash
python test_render.py
# 输出示例：RENDER-TEST: OK KATEX=3 MERMAID_SVG=1 TASK=1 FOOT=1 EMOJI=true ...
```

## 🧰 技术栈

pywebview (WebView2) · markdown-it 14 + 插件全家桶 · CodeMirror 5 · KaTeX 0.16 · Mermaid 10 · highlight.js 11 · PyInstaller

## 📄 版本历史

- **v1.1.0**（2026-08）新增顶部多标签页；品牌升级为「墨览YiQi@MD-Editor-千问办公-Qwen3.8-Max」
- **v1.0.0**（2026-08）首个正式版本

---

© 2026 YiQi · Powered by 千问办公 Qwen3.8-Max
