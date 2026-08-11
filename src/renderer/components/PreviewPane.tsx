import ReactMarkdown from 'react-markdown'
import type { ReactNode, Ref } from 'react'
import { remarkPlugins, rehypePlugins } from '../lib/markdown'
import { parseFrontmatter } from '../lib/frontmatter'
import MermaidBlock from './MermaidBlock'
import CopyButton from './CopyButton'
import { useApp } from '../AppContext'

/**
 * 从 react-markdown 节点的 children 中递归提取纯文本（用于复制按钮）。
 */
function extractNodeText(node: unknown): string {
  if (node == null || node === false || node === true) return ''
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractNodeText).join('')
  if (typeof node === 'object' && 'props' in (node as any)) {
    return extractNodeText((node as any).props?.children)
  }
  return ''
}

interface Props {
  /** 预览容器 DOM ref（供 scroll-spy / 大纲联动定位） */
  containerRef?: Ref<HTMLDivElement>
}

export default function PreviewPane({ containerRef }: Props) {
  const { content, theme } = useApp()
  const stripped = parseFrontmatter(content).content

  const components = {
    // 覆写 pre：为代码块（含 Mermaid 源码）附加悬浮复制按钮
    pre(props: any) {
      const { children } = props
      const codeEl = children
      const className: string = codeEl?.props?.className || ''
      const isMermaid = /language-mermaid/.test(className)
      const rawText = extractNodeText(codeEl?.props?.children)
      const text = isMermaid ? rawText.replace(/\n$/, '') : rawText
      return (
        <div className="code-block">
          <CopyButton text={text} label="复制代码" />
          {isMermaid ? (
            <MermaidBlock code={text} />
          ) : (
            <pre>{children}</pre>
          )}
        </div>
      )
    },
    // 大段文字：悬浮复制（仅在非空时显示按钮）
    p(props: any) {
      const text = extractNodeText(props.children)
      return (
        <p>
          {props.children}
          <CopyButton text={text} label="复制段落" />
        </p>
      )
    },
    // 引用块：悬浮复制
    blockquote(props: any) {
      const text = extractNodeText(props.children)
      return (
        <blockquote>
          {props.children}
          <CopyButton text={text} label="复制引用" />
        </blockquote>
      )
    },
    // 表格：用相对定位容器包裹，右上角悬浮复制
    table(props: any) {
      const text = extractNodeText(props.children)
      return (
        <div className="copy-host">
          <CopyButton text={text} label="复制表格" />
          <table className={props.className}>{props.children}</table>
        </div>
      )
    },
    a(props: any) {
      const { href, children } = props
      const external = href && /^https?:\/\//.test(href)
      if (external) {
        return (
          <a
            href={href}
            onClick={(e) => {
              e.preventDefault()
              window.api.openExternal(href)
            }}
          >
            {children}
          </a>
        )
      }
      return <a href={href}>{children}</a>
    }
  }

  return (
    <div
      ref={containerRef}
      className={`preview-pane markdown-body ${theme}`}
    >
      <ReactMarkdown
        // 注：remark-footnotes 携带独立 vfile 副本，导致插件链类型与
        // react-markdown 依赖的 unified 版本冲突（已知上游类型问题，运行时正常）。
        remarkPlugins={remarkPlugins as any}
        rehypePlugins={rehypePlugins as any}
        components={components}
      >
        {stripped}
      </ReactMarkdown>
    </div>
  )
}
