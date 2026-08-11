import { EditorView } from '@codemirror/view'
import type { TocItem } from '../../shared/types'

// 转义 CSS 选择器中的 id（github-slugger 产物多为小写字母/数字/连字符，仍做兜底）
function cssEscape(id: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(id)
  }
  return id.replace(/([^\w-])/g, '\\$1')
}

/**
 * 将编辑区光标定位并滚动到指定源码行（line 为 0-based）。
 * 使用 CodeMirror 的 doc.line + dispatch + scrollIntoView。
 */
export function navigateEditorToLine(view: EditorView, line: number): void {
  const lineNo = Math.max(1, Math.min(line + 1, view.state.doc.lines))
  const pos = view.state.doc.line(lineNo).from
  // CodeMirror 6：scrollIntoView 是静态方法，需作为 effect 随事务下发
  view.dispatch({
    selection: { anchor: pos },
    effects: EditorView.scrollIntoView(pos, { y: 'start' })
  })
}

/**
 * 将预览容器滚动到指定标题锚点（rehype-slug 生成的 id）。
 * 直接设置容器 scrollTop（= 元素 offsetTop），避免 el.scrollIntoView 连带滚动外层窗口。
 */
export function scrollPreviewToId(container: HTMLElement, id: string): void {
  const el = container.querySelector('#' + cssEscape(id)) as HTMLElement | null
  if (!el) return
  container.scrollTop = el.offsetTop
}

/**
 * 根据当前滚动位置计算应高亮的章节 id（scroll-spy）。
 * 取「锚点位置 ≤ 滚动位置」的最后一个标题；无匹配返回 null。
 *
 * @param scrollTop    当前滚动偏移（预览区为像素，编辑区为可见顶行 0-based 行号）
 * @param items        当前文档 TOC 项（按出现顺序）
 * @param getAnchorTop 由 id 解析锚点位置的函数（预览区返回 offsetTop，编辑区返回 line）
 */
export function computeActiveTocId(
  scrollTop: number,
  items: TocItem[],
  getAnchorTop: (id: string) => number | null
): string | null {
  let active: string | null = null
  for (const item of items) {
    const top = getAnchorTop(item.id)
    if (top == null) continue
    if (top - 4 <= scrollTop) active = item.id
    else break
  }
  return active
}
