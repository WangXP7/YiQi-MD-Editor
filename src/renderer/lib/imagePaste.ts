// 图片粘贴工具：从剪贴板取出图片，落盘为本地文件，返回可嵌入的引用路径
export function getDir(filePath: string | null): string | null {
  if (!filePath) return null
  return filePath.replace(/[\\/][^\\/]*$/, '')
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export interface ClipboardImageResult {
  relativePath: string
}

// 返回插入到编辑器中的 markdown 图片语法；若剪贴板无图片则返回 null
export async function saveClipboardImage(
  items: DataTransferItemList | null,
  filePath: string | null
): Promise<string | null> {
  if (!items) return null
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    if (it.type.startsWith('image/')) {
      const file = it.getAsFile()
      if (!file) return null
      const buffer = await file.arrayBuffer()
      const base64 = toBase64(buffer)
      const mdDir = getDir(filePath)
      const res = await window.api.saveImage(base64, file.name || 'image.png', mdDir)
      return `\n![${file.name || 'image'}](${res.relativePath})\n`
    }
  }
  return null
}
