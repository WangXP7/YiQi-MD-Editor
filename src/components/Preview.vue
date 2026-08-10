<template>
  <div class="preview-container">
    <div class="preview-header">
      <span class="preview-label">Preview</span>
      <div class="preview-actions">
        <button class="action-btn" @click="copyHtml" title="Copy HTML">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.2"/>
            <path d="M2 10V3a1 1 0 011-1h7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="preview-content" ref="previewRef">
      <div v-if="rendering" class="loading">
        <div class="spinner"></div>
      </div>
      <div v-else class="markdown-body" v-html="renderedHtml"></div>
    </div>
  </div>
</template>

<script setup>import { ref, watch, nextTick, onMounted } from 'vue';
import { renderMarkdown } from '../utils/markdown.js';
const props = defineProps({
  content: String,
  theme: String
});
const renderedHtml = ref('');
const rendering = ref(false);
const previewRef = ref(null);
let renderTimer = null;
async function render() {
  rendering.value = true;
  try {
    const html = await renderMarkdown(props.content);
    renderedHtml.value = html;
    rendering.value = false;
    // Apply syntax highlighting to code blocks after render
    await nextTick();
    applyHighlighting();
  }
  catch (e) {
    renderedHtml.value = `<p style="color: var(--danger)">Error rendering Markdown: ${e.message}</p>`;
    rendering.value = false;
  }
}
function applyHighlighting() {
  // highlight.js is already applied by markdown-it
  // Just ensure the right theme is applied
  const codeBlocks = previewRef.value?.querySelectorAll('pre code');
  if (codeBlocks) {
    codeBlocks.forEach(block => {
      if (props.theme === 'light') {
        block.classList.add('hljs-light');
        block.classList.remove('hljs-dark');
      }
      else {
        block.classList.add('hljs-dark');
        block.classList.remove('hljs-light');
      }
    });
  }
}
async function copyHtml() {
  try {
    await navigator.clipboard.writeText(renderedHtml.value);
    alert('HTML copied to clipboard!');
  }
  catch (e) {
    alert('Failed to copy HTML');
  }
}
watch(() => props.content, () => {
  if (renderTimer)
    clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 150);
}, { immediate: false });
watch(() => props.theme, () => {
  applyHighlighting();
});
onMounted(() => {
  render();
});
</script>

<style scoped>
.preview-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.preview-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.preview-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  width: 28px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
}

.action-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.preview-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-color);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Code block styling */
.preview-content :deep(pre code.hljs) {
  display: block;
  overflow-x: auto;
  padding: 1em;
  background: #282c34;
  color: #abb2bf;
  border-radius: var(--radius-md);
}

.preview-content :deep(code.hljs) {
  background: transparent;
}

/* Light theme code blocks */
[data-theme="light"] .preview-content :deep(pre code.hljs) {
  background: #f6f8fa;
  color: #24292e;
}

/* Image styling */
.preview-content :deep(img) {
  box-shadow: var(--shadow-md);
}

/* Link styling */
.preview-content :deep(a) {
  color: var(--accent-primary);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s;
}

.preview-content :deep(a:hover) {
  border-bottom-color: var(--accent-primary);
}

/* Emoji styling */
.preview-content :deep(.emoji) {
  font-size: 1.2em;
  vertical-align: middle;
}

/* Task list checkbox */
.preview-content :deep(.task-list-item input[type="checkbox"]) {
  margin-right: 0.5em;
  accent-color: var(--accent-primary);
}

/* Horizontal rule */
.preview-content :deep(hr) {
  border: none;
  border-top: 2px solid var(--border-color);
  margin: 2em 0;
}

/* Inline code */
.preview-content :deep(:not(pre) > code) {
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: var(--font-mono);
}

[data-theme="light"] .preview-content :deep(:not(pre) > code) {
  background: var(--bg-tertiary);
}

/* Table styling */
.preview-content :deep(table) {
  font-size: 0.95em;
}

.preview-content :deep(th),
.preview-content :deep(td) {
  padding: 8px 14px;
}

/* Blockquote */
.preview-content :deep(blockquote) {
  position: relative;
}

.preview-content :deep(blockquote::before) {
  content: '';
  position: absolute;
  left: -1px;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--accent-gradient);
  border-radius: 2px;
}
</style>
