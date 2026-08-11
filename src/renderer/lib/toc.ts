import GithubSlugger from 'github-slugger'
import type { TocItem } from '../../shared/types'

// 从 markdown 文本提取标题生成 TOC（id 与 rehype-slug 一致，可点击跳转）
export function extractToc(markdown: string): TocItem[] {
  const slugger = new GithubSlugger()
  const lines = markdown.split('\n')
  const items: TocItem[] = []
  let inFence = false
  lines.forEach((line, idx) => {
    const fence = line.trim().match(/^```+/)
    if (fence) {
      inFence = !inFence
      return
    }
    if (inFence) return
    const m = /^(#{1,6})\s+(.*)$/.exec(line)
    if (m) {
      const level = m[1].length
      const text = m[2].replace(/#+\s*$/, '').trim()
      if (!text) return
      const id = slugger.slug(text)
      // line 为 0-based 源码行号，供编辑区光标定位（navigateToc / scroll-spy）
      items.push({ level, text, id, line: idx })
    }
  })
  return items
}
