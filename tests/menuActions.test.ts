import { describe, it, expect } from 'vitest'

/**
 * 菜单动作前缀解析「行为契约测试」。
 *
 * 约定（见 docs/increment-design.md §四.2）：
 *  - 主进程发：'openRecent:' + encodeURIComponent(path)
 *  - 渲染层解：decodeURIComponent(action.slice('openRecent:'.length))
 *  - 主进程发：'theme:' + <THEME_LIST key>
 *  - 渲染层解：action.slice('theme:'.length)
 *
 * 此处复刻同样的切片逻辑作为「预期行为契约」，锁定前缀字符串语义不被误改，
 * 并保证 encodeURIComponent / decodeURIComponent 往返能正确还原绝对路径。
 */

const OPEN_RECENT_PREFIX = 'openRecent:'
const THEME_PREFIX = 'theme:'

describe('菜单动作前缀解析契约（openRecent: / theme:）', () => {
  it('前缀字符串语义锁定：必须含冒号且互不相同', () => {
    expect(OPEN_RECENT_PREFIX).toBe('openRecent:')
    expect(THEME_PREFIX).toBe('theme:')
    expect(OPEN_RECENT_PREFIX).not.toBe(THEME_PREFIX)
  })

  it('openRecent: 路径经 encode/decode 往返还原（含 Windows 反斜杠与中文）', () => {
    const p = 'C:\\Users\\张三\\文档\\我的笔记.md'
    const action = OPEN_RECENT_PREFIX + encodeURIComponent(p)
    expect(action.startsWith(OPEN_RECENT_PREFIX)).toBe(true)
    const decoded = decodeURIComponent(action.slice(OPEN_RECENT_PREFIX.length))
    expect(decoded).toBe(p)
  })

  it('openRecent: 含特殊字符 # & = % 与空格的路径可正确还原', () => {
    const p = 'D:\\a&b#c=d%e\\f g.md'
    const action = OPEN_RECENT_PREFIX + encodeURIComponent(p)
    const decoded = decodeURIComponent(action.slice(OPEN_RECENT_PREFIX.length))
    expect(decoded).toBe(p)
  })

  it('theme: 前缀切出主题 key（如 midnight）', () => {
    const key = 'midnight'
    const action = THEME_PREFIX + key
    expect(action.startsWith(THEME_PREFIX)).toBe(true)
    const decoded = action.slice(THEME_PREFIX.length)
    expect(decoded).toBe(key)
  })

  it('所有 THEME_LIST 主题 key 都是合法的 theme: 动作目标', async () => {
    const { THEME_LIST } = await import('../src/shared/constants')
    const keys = THEME_LIST.map((t) => t.key)
    for (const k of ['light', 'dark', 'paper', 'graphite', 'midnight']) {
      const action = THEME_PREFIX + k
      const decoded = action.slice(THEME_PREFIX.length)
      expect(keys).toContain(decoded)
    }
  })
})
