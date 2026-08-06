// 导出工具：把实时预览区已渲染（含 mermaid/katex/高亮）的 HTML 包装成自包含文档
import katexCss from 'katex/dist/katex.min.css?inline'
import hlCss from 'highlight.js/styles/github.css?inline'
import ourCss from '../styles/index.css?inline'
import type { ThemeName } from '../../shared/types'

export function buildExportDocument(
  innerHTML: string,
  theme: ThemeName
): string {
  const bg = theme === 'dark' ? '#0d1117' : '#ffffff'
  const fg = theme === 'dark' ? '#c9d1d9' : '#24292f'
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Markdown Export</title>
<style>
  body {
    background: ${bg};
    color: ${fg};
    margin: 0;
    padding: 32px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.7;
  }
  ${ourCss}
  ${katexCss}
  ${hlCss}
</style>
</head>
<body>
  <div class="markdown-body">${innerHTML}</div>
</body>
</html>`
}
