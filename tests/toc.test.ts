import { describe, it, expect } from 'vitest'
import { extractToc } from '../src/renderer/lib/toc'

describe('extractToc', () => {
  it('提取标题与层级', () => {
    const md = '# A\n\ntext\n\n## B\n\n### C\n\n```\n# not a heading\n```'
    const toc = extractToc(md)
    expect(toc.map((t) => t.text)).toEqual(['A', 'B', 'C'])
    expect(toc[0].level).toBe(1)
    expect(toc[1].level).toBe(2)
    expect(toc[2].level).toBe(3)
  })

  it('忽略代码块内的 # 标题', () => {
    const md = '# Real\n\n```\n# fake\n```'
    const toc = extractToc(md)
    expect(toc).toHaveLength(1)
  })

  it('生成非空 id', () => {
    const toc = extractToc('# Hello World')
    expect(toc[0].id).toBe('hello-world')
  })
})
