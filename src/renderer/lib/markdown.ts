// Markdown 插件只允许在此处装配，顺序铁律：
// remark-frontmatter → remark-gfm → remark-math
// rehype-raw（在 katex/highlight 之前）→ rehype-slug（在 highlight 之前）→ rehype-katex → rehype-highlight
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkFrontmatter from 'remark-frontmatter'
import remarkFootnotes from 'remark-footnotes'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'

export const remarkPlugins = [
  remarkFrontmatter,
  remarkGfm,
  remarkMath,
  remarkFootnotes
]
export const rehypePlugins = [
  rehypeRaw,
  rehypeSlug,
  rehypeKatex,
  rehypeHighlight
]
