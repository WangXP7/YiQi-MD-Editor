// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from '../src/renderer/hooks'
import { THEME_LIST } from '../src/shared/constants'

describe('useTheme 主题切换逻辑', () => {
  it('在 THEME_LIST 中循环切换并最终回到起点', () => {
    localStorage.clear()
    const { result } = renderHook(() => useTheme())
    // 默认主题
    expect(result.current.theme).toBe('light')

    const seen: string[] = [result.current.theme]
    for (let i = 0; i < THEME_LIST.length; i++) {
      act(() => result.current.toggleTheme())
      seen.push(result.current.theme)
    }
    // 5 次切换应依次经过 dark/paper/graphite/midnight 并循环回 light
    expect(seen).toEqual(['light', 'dark', 'paper', 'graphite', 'midnight', 'light'])
  })

  it('setTheme 直接设置指定主题并同步 data-theme 与 localStorage', () => {
    localStorage.clear()
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme('midnight'))
    expect(result.current.theme).toBe('midnight')
    expect(document.documentElement.getAttribute('data-theme')).toBe('midnight')
    expect(localStorage.getItem('md-editor:theme')).toBe('midnight')
  })
})
