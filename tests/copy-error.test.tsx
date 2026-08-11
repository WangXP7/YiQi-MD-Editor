import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import type { ReactElement } from 'react'
import CopyButton from '../src/renderer/components/CopyButton'
import CopyableBlock from '../src/renderer/components/CopyableBlock'
import PreviewPane from '../src/renderer/components/PreviewPane'
import { AppContext } from '../src/renderer/AppContext'
import type { AppState } from '../src/renderer/AppContext'
import { copyText, copyTextSafe } from '../src/renderer/lib/clipboard'

/**
 * 复制按钮专项验证（第三轮交付）。
 *
 * 目标：验证在 navigator.clipboard 不可用（jsdom / 旧环境 / 权限拒绝）时：
 *   1. clipboard.copyText 不会抛出「未捕获异常导致崩溃」，而是受控抛出 Error('clipboard_unavailable')；
 *   2. copyTextSafe 作为布尔兜底，失败返回 false；
 *   3. CopyButton 捕获异常后进入「复制失败」态并派发 copy-failed 事件，
 *      组件不崩溃；成功时进入「已复制」态；
 *   4. 空文本时按钮隐藏；
 *   5. PreviewPane 为 p / blockquote / table（及代码块外）渲染悬浮复制按钮。
 */

// —— 安全的全局 clipboard / ClipboardItem 替换，测试间互不污染 —— //
const origClipboard = (navigator as any).clipboard
const origClipboardItem = (globalThis as any).ClipboardItem

function setClipboard(val: any) {
  try {
    Object.defineProperty(navigator, 'clipboard', {
      value: val,
      configurable: true,
      writable: true
    })
  } catch {
    ;(navigator as any).clipboard = val
  }
}

function setClipboardItem(val: any) {
  try {
    Object.defineProperty(globalThis, 'ClipboardItem', {
      value: val,
      configurable: true,
      writable: true
    })
  } catch {
    ;(globalThis as any).ClipboardItem = val
  }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  setClipboard(origClipboard)
  setClipboardItem(origClipboardItem)
})

// 最简 context：PreviewPane 仅消费 content / theme
function renderWithCtx(ui: ReactElement, content: string) {
  const stub = { content, theme: 'light' } as unknown as AppState
  return render(
    <AppContext.Provider value={stub}>{ui}</AppContext.Provider>
  )
}

describe('clipboard 底层（不可用时受控抛错，不崩溃）', () => {
  it('clipboard 不可用：copyText 抛出 clipboard_unavailable，copyTextSafe 返回 false', async () => {
    setClipboard(undefined)
    setClipboardItem(undefined)

    // 受控抛错（非未捕获崩溃），调用方需自行 try/catch
    await expect(copyText('hello')).rejects.toThrow('clipboard_unavailable')
    // 布尔兜底：失败返回 false
    await expect(copyTextSafe('hello')).resolves.toBe(false)
  })

  it('ClipboardItem 可用：copyText 走 navigator.clipboard.write 写入 text/plain', async () => {
    class FakeClipboardItem {
      constructor(public items: Record<string, Blob>) {}
    }
    setClipboardItem(FakeClipboardItem as unknown as typeof ClipboardItem)
    const write = vi.fn().mockResolvedValue(undefined)
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard({ write, writeText })

    await copyText('hello')
    expect(write).toHaveBeenCalledTimes(1)
    expect(writeText).not.toHaveBeenCalled()
  })

  it('ClipboardItem 不可用但 writeText 可用：copyText 回退至 writeText', async () => {
    setClipboardItem(undefined)
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard({ writeText })

    await copyText('hi')
    expect(writeText).toHaveBeenCalledWith('hi')
  })
})

describe('CopyButton 行为', () => {
  it('复制成功：进入「已复制」态且组件不崩溃', async () => {
    class FakeClipboardItem {
      constructor(public items: Record<string, Blob>) {}
    }
    setClipboardItem(FakeClipboardItem as unknown as typeof ClipboardItem)
    setClipboard({
      write: vi.fn().mockResolvedValue(undefined),
      writeText: vi.fn().mockResolvedValue(undefined)
    })

    render(<CopyButton text="hello world" />)
    const btn = screen.getByRole('button', { name: '复制' })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(screen.getByRole('button').getAttribute('aria-label')).toBe('已复制')
    })
  })

  it('复制失败（clipboard 不可用）：不崩溃，进入「复制失败」态并派发 copy-failed 事件', async () => {
    setClipboard(undefined)
    setClipboardItem(undefined)

    const listener = vi.fn()
    window.addEventListener('copy-failed', listener)

    render(<CopyButton text="hello world" />)
    const btn = screen.getByRole('button')
    fireEvent.click(btn)

    // 组件未崩溃，且进入失败态
    await waitFor(() => {
      expect(screen.getByRole('button').getAttribute('aria-label')).toBe('复制失败')
    })
    // 失败路径派发了全局事件（App 据此弹轻提示）
    expect(listener).toHaveBeenCalled()
    window.removeEventListener('copy-failed', listener)
  })

  it('空文本（全空白）：按钮不渲染（避免复制空串）', () => {
    const { container } = render(<CopyButton text="   " />)
    expect(container.querySelector('button')).toBeNull()
  })
})

describe('CopyableBlock 透传', () => {
  it('渲染复制按钮并透传文本', () => {
    render(
      <CopyableBlock text="可复制的描述文案">
        <p>展示内容</p>
      </CopyableBlock>
    )
    const btn = screen.getByRole('button')
    expect(btn).toBeTruthy()
    expect(btn.getAttribute('aria-label')).toBe('复制')
  })
})

describe('PreviewPane 悬浮复制按钮（p / blockquote / table）', () => {
  const md =
    '# 标题\n\n这是一段段落文字。\n\n> 这是引用块内容。\n\n| 列 A | 列 B |\n| --- | --- |\n| 1 | 2 |\n'

  it('为段落 / 引用 / 表格渲染悬浮复制按钮且不崩溃', () => {
    renderWithCtx(<PreviewPane />, md)

    // 收集所有复制按钮的 aria-label
    const labels = Array.from(document.querySelectorAll('button.copy-btn')).map(
      (b) => (b as HTMLButtonElement).getAttribute('aria-label')
    )

    // 段落（≥1）、引用（恰好 1）、表格（恰好 1）均应存在
    expect(labels.filter((l) => l === '复制段落').length).toBeGreaterThanOrEqual(1)
    expect(labels.filter((l) => l === '复制引用')).toHaveLength(1)
    expect(labels.filter((l) => l === '复制表格')).toHaveLength(1)

    // 表格复制按钮位于 .copy-host 容器内
    const host = document.querySelector('.copy-host')
    expect(host).toBeTruthy()
    expect(host!.querySelector('button.copy-btn')).toBeTruthy()
  })

  it('clipboard 不可用时点击表格复制按钮不崩溃，进入失败态', async () => {
    setClipboard(undefined)
    setClipboardItem(undefined)
    renderWithCtx(<PreviewPane />, md)

    const btn = screen.getByRole('button', { name: '复制表格' })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(
        document.querySelector('.copy-host button.copy-btn')!.getAttribute('aria-label')
      ).toBe('复制失败')
    })
  })
})
