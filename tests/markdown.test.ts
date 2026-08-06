import { describe, it, expect } from 'vitest'
import { remarkPlugins, rehypePlugins } from '../src/renderer/lib/markdown'

describe('markdown plugin assembly', () => {
  it('remark 插件包含 4 个且均为函数', () => {
    expect(remarkPlugins.length).toBe(4)
    remarkPlugins.forEach((p) => expect(typeof p).toBe('function'))
  })

  it('rehype 插件包含 4 个且均为函数', () => {
    expect(rehypePlugins.length).toBe(4)
    rehypePlugins.forEach((p) => expect(typeof p).toBe('function'))
  })
})
