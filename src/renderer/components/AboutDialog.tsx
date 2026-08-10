import { APP_DISPLAY_NAME } from '../../shared/constants'
import CopyableBlock from './CopyableBlock'

interface Props {
  open: boolean
  onClose: () => void
}

const DESC_1 = '一款 Windows 独立运行的 Markdown 查看 / 编辑桌面程序。左侧编辑，右侧实时预览，支持 GFM 表格、数学公式与 Mermaid 图。'
const DESC_2 = '技术栈：Electron + React + CodeMirror 6'

export default function AboutDialog({ open, onClose }: Props) {
  if (!open) return null
  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-card" onClick={(e) => e.stopPropagation()}>
        <h2>{APP_DISPLAY_NAME}</h2>
        <CopyableBlock text={DESC_1}>
          <p>{DESC_1}</p>
        </CopyableBlock>
        <CopyableBlock text={DESC_2}>
          <p>{DESC_2}</p>
        </CopyableBlock>
        <div className="about-links">
          <a href="https://www.electronjs.org" target="_blank" rel="noreferrer">
            官网
          </a>
          <a
            href="https://github.com/electron/electron"
            target="_blank"
            rel="noreferrer"
          >
            开源仓库
          </a>
        </div>
        <button className="about-close" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  )
}
