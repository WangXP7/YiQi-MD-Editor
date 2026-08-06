import yaml from 'js-yaml'

export interface ParsedFrontmatter {
  data: Record<string, unknown>
  content: string
}

const FM_RE = /^---\s*\n([\s\S]*?)\n---\s*\n?/

// 解析 YAML Frontmatter，并剥离它（预览区不应渲染原始 frontmatter）
export function parseFrontmatter(raw: string): ParsedFrontmatter {
  const m = raw.match(FM_RE)
  if (!m) return { data: {}, content: raw }
  let data: Record<string, unknown> = {}
  try {
    const loaded = yaml.load(m[1])
    if (loaded && typeof loaded === 'object') data = loaded as Record<string, unknown>
  } catch {
    data = {}
  }
  return { data, content: raw.slice(m[0].length) }
}

// 把 frontmatter 对象重新序列化为字符串块
export function stringifyFrontmatter(data: Record<string, unknown>): string {
  if (!data || Object.keys(data).length === 0) return ''
  return `---\n${yaml.dump(data)}---\n\n`
}
