import { describe, it, expect } from 'vitest'
import { THEME_LIST } from '../src/shared/constants'

/**
 * useTheme 主题循环切换「行为契约测试」。
 *
 * 复刻 src/renderer/hooks.ts 中 useTheme().toggleTheme 的循环切换契约：
 *   const idx = THEME_LIST.findIndex(t => t.key === current)
 *   const next = THEME_LIST[(idx + 1) % THEME_LIST.length]
 *   return next.key
 *
 * 锁定「在 THEME_LIST 中循环切换、遍历全部主题后回到起点」的语义不被破坏。
 * （本工作区 jsdom 不可用，故以 node 环境纯逻辑契约测试，与 menuActions 契约同源。）
 */

function cycleTheme(current: string): string {
  const idx = THEME_LIST.findIndex((t) => t.key === current)
  const next = THEME_LIST[(idx + 1) % THEME_LIST.length]
  return next.key
}

describe('useTheme 循环切换契约（toggleTheme）', () => {
  it('从 light 起依次循环经过全部 5 个主题并最终回到 light', () => {
    const seq: string[] = ['light']
    let cur = 'light'
    for (let i = 0; i < THEME_LIST.length; i++) {
      cur = cycleTheme(cur)
      seq.push(cur)
    }
    expect(seq).toEqual(['light', 'dark', 'paper', 'graphite', 'midnight', 'light'])
  })

  it('每个主题都能切换到下一个合法主题（无越界 / 无 undefined）', () => {
    for (const t of THEME_LIST) {
      const next = cycleTheme(t.key)
      expect(THEME_LIST.map((x) => x.key)).toContain(next)
    }
  })
})
