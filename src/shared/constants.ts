// 应用级共享常量（主进程与渲染层共用，消除改名魔法字符串与主题枚举重复）
import type { ThemeName } from './types'

/** 品牌名（基础名，无版本号；窗口标题 / 关于框 / HTML title 统一使用） */
export const APP_NAME = 'YiQi@MD-Editor-wb-Hy3'

/** 版本号（渲染层无法访问 process，手动维护，与 package.json 解耦） */
export const APP_VERSION = '1.0.0'

/**
 * 全名（带版本号）：关于框 / 安装包名 / 桌面快捷方式显示。
 * 由基础名与版本号派生，集中维护避免散落。
 */
export const APP_DISPLAY_NAME = `${APP_NAME} v${APP_VERSION}`

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
