import { describe, it, expect } from 'vitest'
import { APP_NAME, APP_VERSION, APP_DISPLAY_NAME, THEME_LIST } from '../src/shared/constants'

describe('共享常量 constants', () => {
  it('APP_NAME 严格等于 YiQi@MD-Editor-wb-Hy3', () => {
    expect(APP_NAME).toBe('YiQi@MD-Editor-wb-Hy3')
  })

  it('APP_DISPLAY_NAME 等于 基础名 + 版本号（APP_NAME vAPP_VERSION）', () => {
    expect(APP_DISPLAY_NAME).toBe(`${APP_NAME} v${APP_VERSION}`)
    expect(APP_DISPLAY_NAME).toBe('YiQi@MD-Editor-wb-Hy3 v1.0.0')
  })

  it('APP_VERSION 为字符串且非空', () => {
    expect(typeof APP_VERSION).toBe('string')
    expect(APP_VERSION.length).toBeGreaterThan(0)
  })

  it('THEME_LIST 长度为 5，key 集合恰为 light/dark/paper/graphite/midnight（唯一、无重复）', () => {
    expect(THEME_LIST).toHaveLength(5)
    const keys = THEME_LIST.map((t) => t.key)
    // 顺序与集合严格匹配
    expect(keys).toEqual(['light', 'dark', 'paper', 'graphite', 'midnight'])
    // 唯一性：无重复 key
    expect(new Set(keys).size).toBe(keys.length)
    // 每个主题都带有非空中文 label
    THEME_LIST.forEach((t) => {
      expect(typeof t.label).toBe('string')
      expect(t.label.length).toBeGreaterThan(0)
    })
  })
})
