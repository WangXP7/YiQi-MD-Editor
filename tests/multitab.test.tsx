import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

/**
 * 多标签行为集成测试（渲染层）。
 * 用轻量桩替换依赖 CodeMirror / Mermaid 的 EditorPane 与 PreviewPane，
 * 避免 jsdom 下布局测量异常；其余 UI（TopBar / TabBar / Sidebar / StatusBar /
 * UnsavedDialog）保持真实渲染，覆盖新建 / 切换 / 关闭 / 脏标记 / 未保存弹窗分支。
 */

// 编辑面板桩：受控 textarea，变更直接驱动 activeTab.content（即 dirty）
vi.mock('../src/renderer/components/EditorPane', async () => {
  const React = await import('react')
  const { useApp } = await import('../src/renderer/AppContext')
  return {
    default: () => {
      const { content, setContent } = useApp()
      return React.createElement('textarea', {
        'data-testid': 'mock-editor',
        value: content,
        onChange: (e: any) => setContent(e.target.value)
      })
    }
  }
})

// 预览面板桩：react-markdown / katex / mermaid 在 jsdom 下无需渲染
vi.mock('../src/renderer/components/PreviewPane', () => ({
  default: () => null
}))

import App from '../src/renderer/App'

function installApiMock() {
  const noop = () => undefined
  ;(window as any).api = {
    setTitle: vi.fn(),
    openFile: vi.fn(() => Promise.resolve(null)),
    saveFile: vi.fn(() => Promise.resolve({ saved: false })),
    saveFileAs: vi.fn(() => Promise.resolve({ saved: false })),
    openByPath: vi.fn(() => Promise.resolve({ error: 'not_found' })),
    exportHtml: vi.fn(() => Promise.resolve({ saved: false })),
    exportPdf: vi.fn(() => Promise.resolve({ saved: false })),
    getRecents: vi.fn(() => Promise.resolve([])),
    addRecent: vi.fn(() => Promise.resolve([])),
    clearRecents: vi.fn(() => Promise.resolve([])),
    saveImage: vi.fn(),
    openExternal: vi.fn(),
    onMenuAction: vi.fn(() => noop)
  }
}

function getTabs(): Element[] {
  return Array.from(document.querySelectorAll('.tab-bar .tab'))
}

function getActiveCloseBtn(): HTMLButtonElement {
  return document.querySelector(
    '.tab-bar .tab.active .tab-close'
  ) as HTMLButtonElement
}

beforeEach(() => {
  localStorage.clear()
  installApiMock()
})

afterEach(() => {
  cleanup()
})

describe('多标签状态', () => {
  it('初始仅有一个 untitled 标签', () => {
    render(<App />)
    expect(getTabs()).toHaveLength(1)
  })

  it('点击「新建」增加一个标签', () => {
    render(<App />)
    fireEvent.click(screen.getByText('新建'))
    expect(getTabs()).toHaveLength(2)
  })

  it('点击标签可切换激活状态', () => {
    render(<App />)
    fireEvent.click(screen.getByText('新建')) // 新增并激活第二个标签
    const list = getTabs()
    expect(list).toHaveLength(2)
    expect(list[1].getAttribute('aria-selected')).toBe('true')
    expect(list[0].getAttribute('aria-selected')).toBe('false')

    fireEvent.click(list[0]) // 切回第一个
    expect(list[0].getAttribute('aria-selected')).toBe('true')
    expect(list[1].getAttribute('aria-selected')).toBe('false')
  })

  it('关闭含未保存修改的标签会弹出确认框', () => {
    render(<App />)
    const editor = screen.getByTestId('mock-editor') as HTMLTextAreaElement
    fireEvent.change(editor, { target: { value: 'hello world' } })
    // 激活标签已进入脏状态
    expect(document.querySelector('.status-bar .dirty')).toBeTruthy()

    fireEvent.click(getActiveCloseBtn())
    expect(screen.getByText('未保存的更改')).toBeTruthy()
  })

  it('未保存弹窗「不保存」直接关闭并保留一个空白标签', () => {
    render(<App />)
    const editor = screen.getByTestId('mock-editor') as HTMLTextAreaElement
    fireEvent.change(editor, { target: { value: 'dirty content' } })
    fireEvent.click(getActiveCloseBtn())
    expect(screen.getByText('未保存的更改')).toBeTruthy()

    fireEvent.click(screen.getByText('不保存'))
    // 弹窗消失，且至少保留一个空白标签（不关闭窗口）
    expect(screen.queryByText('未保存的更改')).toBeNull()
    expect(getTabs()).toHaveLength(1)
    expect(document.querySelector('.status-bar .dirty')).toBeNull()
  })

  it('未保存弹窗「取消」保留原标签', () => {
    render(<App />)
    const editor = screen.getByTestId('mock-editor') as HTMLTextAreaElement
    fireEvent.change(editor, { target: { value: 'dirty content' } })
    fireEvent.click(getActiveCloseBtn())
    expect(screen.getByText('未保存的更改')).toBeTruthy()

    fireEvent.click(screen.getByText('取消'))
    expect(screen.queryByText('未保存的更改')).toBeNull()
    expect(getTabs()).toHaveLength(1)
  })

  it('关闭无修改的空白标签不会弹窗且至少保留一个', () => {
    render(<App />)
    fireEvent.click(screen.getByText('新建')) // 第二个空白标签被激活
    fireEvent.click(getActiveCloseBtn())
    expect(screen.queryByText('未保存的更改')).toBeNull()
    expect(getTabs()).toHaveLength(1)
  })
})
