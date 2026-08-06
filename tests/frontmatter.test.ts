import { describe, it, expect } from 'vitest'
import { parseFrontmatter } from '../src/renderer/lib/frontmatter'

describe('parseFrontmatter', () => {
  it('解析带 frontmatter 的文档', () => {
    const raw = '---\ntitle: Hi\nnum: 3\n---\n\n# Hello\nworld'
    const { data, content } = parseFrontmatter(raw)
    expect(data.title).toBe('Hi')
    expect(data.num).toBe(3)
    expect(content.trim()).toBe('# Hello\nworld')
  })

  it('无 frontmatter 时返回原文', () => {
    const raw = '# Hi\nno fm here'
    const { data, content } = parseFrontmatter(raw)
    expect(Object.keys(data)).toHaveLength(0)
    expect(content).toBe(raw)
  })
})
