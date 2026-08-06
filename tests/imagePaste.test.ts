import { describe, it, expect } from 'vitest'
import { getDir } from '../src/renderer/lib/imagePaste'

describe('getDir', () => {
  it('windows 路径', () => {
    expect(getDir('C:\\Users\\me\\doc.md')).toBe('C:\\Users\\me')
  })
  it('posix 路径', () => {
    expect(getDir('/home/me/doc.md')).toBe('/home/me')
  })
  it('null 返回 null', () => {
    expect(getDir(null)).toBeNull()
  })
})
