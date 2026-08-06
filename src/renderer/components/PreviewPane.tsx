import ReactMarkdown from 'react-markdown'
import { remarkPlugins, rehypePlugins } from '../lib/markdown'
import { parseFrontmatter } from '../lib/frontmatter'
import MermaidBlock from './MermaidBlock'
import { useApp } from '../AppContext'

export default function PreviewPane() {
  const { content, theme } = useApp()
  const stripped = parseFrontmatter(content).content

  const components = {
    code(props: any) {
      const { className, children } = props
      if (className && /language-mermaid/.test(className)) {
        return <MermaidBlock code={String(children).replace(/\n$/, '')} />
      }
      return <code className={className}>{children}</code>
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
    <div className={`preview-pane markdown-body ${theme}`}>
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
