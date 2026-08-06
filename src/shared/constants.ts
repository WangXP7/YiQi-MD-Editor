// 应用级共享常量（主进程与渲染层共用，消除改名魔法字符串与主题枚举重复）
import type { ThemeName } from './types'

/** 品牌名（窗口标题 / 关于框 / HTML title 统一使用） */
export const APP_NAME = 'MD-Editor-HY3-YiQi'

/** 版本号（渲染层无法访问 process，手动维护，与 package.json 解耦） */
export const APP_VERSION = '1.0.0'

/** 主题项：key 用于 data-theme / 持久化；label 为中文显示名 */
export interface ThemeItem {
  key: ThemeName
  label: string
}

/**
 * 主题枚举列表（单一来源）。
 * 主进程（菜单"主题"子菜单）与渲染层（切换 / 持久化）共用同一份。
 */
export const THEME_LIST: ThemeItem[] = [
  { key: 'light', label: '浅色' },
  { key: 'dark', label: '深色' },
  { key: 'paper', label: '纸张' },
  { key: 'graphite', label: '石墨' },
  { key: 'midnight', label: '午夜' }
]
