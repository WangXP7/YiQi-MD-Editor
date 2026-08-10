import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Configure marked for full GFM support
marked.setOptions({
  gfm: true,
  breaks: false,
  highlight: function(code, lang) {
    // Basic syntax highlighting
    if (typeof code === 'string' && code.trim()) {
      return `<pre><code class="language-${lang || ''}">${escapeHtml(code)}</code></pre>`;
    }
    return code;
  }
});

// Escape HTML for code blocks
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Custom renderer for features marked doesn't support natively
const renderer = new marked.Renderer();

// Add anchor links to headings
renderer.heading = function({ text, tokens, depth }) {
  const slug = text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '');
  return `<h${depth} id="${slug}"><a href="#${slug}" class="header-anchor">${text}</a></h${depth}>`;
};

// Handle task lists
renderer.listitem = function({ tokens, task, checked }) {
  if (task) {
    const checkbox = checked
      ? '<input type="checkbox" checked disabled>'
      : '<input type="checkbox" disabled>';
    return `<li class="task-list-item">${checkbox}${this.parser.parseInline(tokens)}</li>`;
  }
  return `<li>${this.parser.parseInline(tokens)}</li>`;
};

marked.use({ renderer });

export function renderWithMarked(content) {
  let html = marked.parse(content);
  return DOMPurify.sanitize(html, { ADD_TAGS: ['svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'text', 'tspan', 'g', 'defs', 'clipPath', 'linearGradient', 'radialGradient', 'stop'], ADD_ATTR: ['class', 'target', 'rel', 'viewBox', 'fill', 'stroke', 'stroke-width'] });
}
