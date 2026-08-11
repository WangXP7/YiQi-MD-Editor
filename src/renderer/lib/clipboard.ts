// 统一的纯文本复制逻辑，供 CopyButton / CopyableBlock 以及 copyHtml 的回退复用。
// 优先使用 ClipboardItem('text/plain')，失败回退到 writeText；两者皆失败则抛出错误。

/**
 * 将纯文本写入系统剪贴板。
 * 优先 ClipboardItem，失败回退 navigator.clipboard.writeText；
 * 两者均不可用时抛出 Error('clipboard_unavailable')（不再静默吞错）。
 *
 * @param text 要复制的文本
 */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }) })
      ])
      return
    } catch {
      /* 优先方案失败，继续回退 */
    }
  }
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      /* 回退方案失败，继续向下抛出 */
    }
  }
  throw new Error('clipboard_unavailable')
}

/**
 * 布尔结果版本的复制：失败返回 false 而非抛出，供需要布尔判断的调用方（如 copyHtml 回退）。
 *
 * @param text 要复制的文本
 * @returns 是否复制成功
 */
export async function copyTextSafe(text: string): Promise<boolean> {
  try {
    await copyText(text)
    return true
  } catch {
    return false
  }
}
