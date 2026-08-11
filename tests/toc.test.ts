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

  it('返回每个标题的源码行号（0-based）', () => {
    const md = '# A\n\ntext\n\n## B\n\n### C\n\n```\n# not a heading\n```'
    const toc = extractToc(md)
    // 行号对应标题在源码中的 0-based 位置
    // 行序：0:#A 1:空 2:text 3:空 4:##B 5:空 6:###C 7:空 8:``` 9:#(围栏内) 10:```
    expect(toc.map((t) => t.line)).toEqual([0, 4, 6])
  })

  it('id 与 line 共存且 id 生成算法不变', () => {
    const toc = extractToc('# Hello World\n\n## 子标题')
    expect(toc[0].id).toBe('hello-world')
    expect(toc[0].line).toBe(0)
    expect(toc[1].id).toBe('子标题')
    expect(toc[1].line).toBe(2)
  })

  it('空文档返回空数组', () => {
    expect(extractToc('')).toEqual([])
    expect(extractToc('   \n\n  ')).toEqual([])
  })
})
