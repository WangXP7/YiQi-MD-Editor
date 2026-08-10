import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import emoji from 'markdown-it-emoji';
import anchor from 'markdown-it-anchor';
import toc from 'markdown-it-toc-done-right';
import kbd from 'markdown-it-kbd';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'system-ui, sans-serif'
});

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
      } catch (_) {}
    }
    try {
      return hljs.highlightAuto(str).value;
    } catch (_) {}
    return '';
  }
});

md.enable(taskLists);
md.enable(emoji);
md.enable(anchor, {
  permalink: anchor.permalink.headerLink({ class: 'header-anchor' })
});
md.enable(toc, {
  containerClass: 'markdown-toc',
  containerId: 'markdown-toc',
  listType: 'ul',
  permalink: anchor.permalink.headerLink()
});
md.enable(kbd);

// Custom plugin for GFM alerts (NOTE, TIP, IMPORTANT, WARNING, CAUTION)
md.use((md) => {
  const defaultParagraphOpen = md.renderer.rules.paragraph_open || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
  
  md.renderer.rules.paragraph_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const nextToken = tokens[idx + 1];
    
    if (nextToken && nextToken.type === 'inline') {
      const content = nextToken.content;
      const alertMatch = content.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i);
      if (alertMatch) {
        const type = alertMatch[1].toLowerCase();
        token.attrSet('class', `markdown-alert markdown-alert-${type}`);
      }
    }
    return defaultParagraphOpen(tokens, idx, options, env, self);
  };
});

// Custom plugin for math expressions ($...$ and $$...$$)
md.use((md) => {
  const defaultInlineRule = md.renderer.rules.text || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
  
  // Add math parsing to the inline ruler
  md.inline.ruler.after('escape', 'math_inline', (state) => {
    const pos = state.pos;
    const max = state.posMax;
    
    if (pos + 1 < max && state.src.charCodeAt(pos) === 0x24) { // $
      // Check for $$ display math
      if (pos + 3 < max && state.src.charCodeAt(pos + 1) === 0x24) {
        const closePos = state.src.indexOf('$$', pos + 2);
        if (closePos > 0 && closePos < max) {
          const mathContent = state.src.substring(pos + 2, closePos);
          const token = state.push('math_block', '', 0);
          token.content = mathContent;
          state.pos = closePos + 2;
          return true;
        }
      }
      
      // Inline math
      const nextChar = state.src.charCodeAt(pos + 1);
      if (nextChar !== 0x24 && nextChar !== 0x20 && nextChar !== 0x09) {
        let endPos = -1;
        for (let i = pos + 1; i < max; i++) {
          if (state.src.charCodeAt(i) === 0x24) {
            if (i + 1 < max && state.src.charCodeAt(i + 1) === 0x24) break;
            endPos = i;
            break;
          }
        }
        if (endPos > pos + 1) {
          const mathContent = state.src.substring(pos + 1, endPos);
          const token = state.push('math_inline', '', 0);
          token.content = mathContent;
          state.pos = endPos + 1;
          return true;
        }
      }
    }
    return false;
  });
  
  md.renderer.rules.math_inline = (tokens, idx) => {
    const content = tokens[idx].content;
    try {
      // Simple math rendering - just wrap in a code-like element
      // Full KaTeX rendering would need the katex library
      return `<span class="math-inline">$${content}$</span>`;
    } catch (e) {
      return `<span class="math-inline" style="color:var(--danger)">${content}</span>`;
    }
  };
  
  md.renderer.rules.math_block = (tokens, idx) => {
    const content = tokens[idx].content;
    try {
      return `<div class="math-block">$$${content}$$</div>`;
    } catch (e) {
      return `<div class="math-block" style="color:var(--danger)">${content}</div>`;
    }
  };
});

// Mermaid code block handling
const defaultCodeBlockRenderer = md.renderer.rules.fence || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const info = token.info ? token.info.trim() : '';
  const code = token.content;
  
  if (info === 'mermaid') {
    const id = 'mermaid-' + Math.random().toString(36).substr(2, 9);
    return `<div class="mermaid" id="${id}">${code}</div>`;
  }
  
  return defaultCodeBlockRenderer(tokens, idx, options, env, self);
};

export async function renderMarkdown(content, options = {}) {
  let html = md.render(content);
  
  // Sanitize HTML
  if (options.sanitize !== false) {
    html = DOMPurify.sanitize(html, {
      ADD_TAGS: ['foreignObject', 'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'text', 'tspan', 'g', 'use', 'defs', 'clipPath', 'image', 'linearGradient', 'radialGradient', 'stop', 'pattern'],
      ADD_ATTR: ['target', 'rel', 'class', 'data-mermaid', 'data-processed', 'id', 'aria-hidden', 'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'xlink:href', 'href', 'transform', 'style']
    });
  }
  
  // Render Mermaid diagrams
  if (options.renderMermaid !== false) {
    const mermaidBlocks = html.match(/<div class="mermaid"[^>]*>[\s\S]*?<\/div>/g);
    if (mermaidBlocks) {
      for (const block of mermaidBlocks) {
        const idMatch = block.match(/id="([^"]+)"/);
        const codeMatch = block.match(/<div class="mermaid"[^>]*>([\s\S]*?)<\/div>/);
        if (idMatch && codeMatch) {
          const id = idMatch[1];
          const code = codeMatch[1].trim();
          try {
            const { svg } = await mermaid.render(id, code);
            html = html.replace(block, `<div class="mermaid">${svg}</div>`);
          } catch (e) {
            html = html.replace(block, `<div class="mermaid-error">Mermaid rendering error: ${e.message}</div>`);
          }
        }
      }
    }
  }
  
  return html;
}

export function renderMarkdownSync(content) {
  return md.render(content);
}

export function getMarkdownIt() {
  return md;
}
