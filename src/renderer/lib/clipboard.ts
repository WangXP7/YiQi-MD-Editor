// 统一的纯文本复制逻辑，供 CopyButton / CopyableBlock 以及 copyHtml 的回退复用。
// 优先使用 ClipboardItem('text/plain')，失败回退到 writeText。

/**
 * 将纯文本写入系统剪贴板。
 * @param text 要复制的文本
 */
export async function copyText(text: string): Promise<void> {
  try {
    if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([
        new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }) })
      ])
      return
    }
  } catch {
    /* 优先方案失败，继续回退 */
  }
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* 剪贴板不可用时静默忽略 */
  }
}
