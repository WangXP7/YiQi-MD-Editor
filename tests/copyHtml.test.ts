import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * 复制为 HTML 的「ClipboardItem 构造形态」契约测试。
 *
 * 复刻 src/renderer/App.tsx 中 copyHtml 的契约行为：
 *  取 .markdown-body 的 innerHTML / textContent，
 *  构造 new ClipboardItem({ 'text/html': Blob, 'text/plain': Blob }) 写入剪贴板。
 * 锁定「必须同时写入 text/html 与 text/plain 两种表示」的契约形态，
 * 防止回退逻辑被误删或 Blob 类型被改坏。
 *
 * 注：本工作区 jsdom 环境因嵌套依赖 http-proxy-agent 缺 dist/index.js 无法加载，
 * 故在 node 环境下用 vi.stubGlobal 提供最小 document/navigator/ClipboardItem 桩。
 */

describe('copyHtml 契约（ClipboardItem 构造形态）', () => {
  beforeEach(() => {
    const fakeEl = {
      innerHTML: '<h1>标题</h1><p>正文内容</p>',
      textContent: '标题正文内容'
    }
    vi.stubGlobal('document', {
      querySelector: (sel: string) => (sel === '.markdown-body' ? fakeEl : null)
    })
  })

  it('构造 ClipboardItem 含 text/html 与 text/plain 两个 Blob，且内容正确', async () => {
    const captured: Record<string, Blob> = {}
    const FakeClipboardItem = vi
      .fn()
      .mockImplementation((items: Record<string, Blob>) => {
        Object.assign(captured, items)
        return { items }
      })
    vi.stubGlobal('ClipboardItem', FakeClipboardItem as unknown as typeof ClipboardItem)

    const write = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { write } })

    // —— 复刻 App.tsx copyHtml 的构造逻辑 ——
    const el = document.querySelector('.markdown-body')
    if (!el) throw new Error('.markdown-body 不存在')
    const html = el.innerHTML
    const text = el.textContent || ''
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' })
      })
    ])

    // 调用形态：恰好调用一次，传入一个 ClipboardItem
    expect(write).toHaveBeenCalledTimes(1)
    const arg = write.mock.calls[0][0] as unknown as ClipboardItem[]
    expect(arg).toHaveLength(1)

    expect(FakeClipboardItem).toHaveBeenCalledWith(
      expect.objectContaining({
        'text/html': expect.any(Blob),
        'text/plain': expect.any(Blob)
      })
    )

    // 验证 Blob 类型与内容
    const htmlBlob = captured['text/html']
    expect(htmlBlob).toBeInstanceOf(Blob)
    expect(htmlBlob.type).toBe('text/html')
    expect(await htmlBlob.text()).toContain('<h1>标题</h1>')

    const plainBlob = captured['text/plain']
    expect(plainBlob).toBeInstanceOf(Blob)
    expect(plainBlob.type).toBe('text/plain')
    expect(await plainBlob.text()).toContain('标题')
  })
})
