<template>
  <div class="editor-container">
    <div class="editor-toolbar">
      <div class="toolbar-group">
        <button class="tool-btn" @click="insertText('# ', '')" title="Heading 1">
          <span class="tool-text">H1</span>
        </button>
        <button class="tool-btn" @click="insertText('## ', '')" title="Heading 2">
          <span class="tool-text">H2</span>
        </button>
        <button class="tool-btn" @click="insertText('### ', '')" title="Heading 3">
          <span class="tool-text">H3</span>
        </button>
      </div>
      <div class="toolbar-separator"></div>
      <div class="toolbar-group">
        <button class="tool-btn" @click="wrapSelection('**', '**')" title="Bold">
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M4 3h4a2.5 2.5 0 010 5H4V3zm0 5h5a2.5 2.5 0 010 5H4V8z" fill="currentColor"/></svg>
        </button>
        <button class="tool-btn" @click="wrapSelection('*', '*')" title="Italic">
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M5 3h5M8 3v8M6 11h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
        <button class="tool-btn" @click="wrapSelection('~~', '~~')" title="Strikethrough">
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 7h8M5 4h4a1.5 1.5 0 010 3M5 7v3a1.5 1.5 0 001.5 1.5H10" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
        </button>
        <button class="tool-btn" @click="wrapSelection('`', '`')" title="Inline Code">
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M5 5L3 7l2 2M9 5l2 2-2 2" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div class="toolbar-separator"></div>
      <div class="toolbar-group">
        <button class="tool-btn" @click="insertText('- ', '')" title="List">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="3" cy="4" r="1" fill="currentColor"/>
            <circle cx="3" cy="7" r="1" fill="currentColor"/>
            <circle cx="3" cy="10" r="1" fill="currentColor"/>
            <path d="M6 4h5M6 7h5M6 10h5" stroke="currentColor" stroke-width="1"/>
          </svg>
        </button>
        <button class="tool-btn" @click="insertText('1. ', '')" title="Numbered List">
          <span class="tool-text">1.</span>
        </button>
        <button class="tool-btn" @click="insertText('- [ ] ', '')" title="Task List">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="2" y="3" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
            <path d="M4 7l2 2 3-4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </button>
        <button class="tool-btn" @click="insertText('> ', '')" title="Quote">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M4 3h2a1 1 0 011 1v3a1 1 0 01-1 1H4V8a2 2 0 002-2V5a2 2 0 00-2-2zM9 3h2a1 1 0 011 1v3a1 1 0 01-1 1H9V8a2 2 0 002-2V5a2 2 0 00-2-2z" fill="currentColor"/>
          </svg>
        </button>
      </div>
      <div class="toolbar-separator"></div>
      <div class="toolbar-group">
        <button class="tool-btn" @click="insertLink" title="Link">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M6 8a3 3 0 004.24 0l2.12-2.12a3 3 0 00-4.24-4.24L7 3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <path d="M8 6a3 3 0 00-4.24 0L1.64 8.12a3 3 0 004.24 4.24L7 10.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
        </button>
        <button class="tool-btn" @click="insertImage" title="Image">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="2" y="3" width="10" height="8" rx="1" stroke="currentColor" stroke-width="1.2"/>
            <circle cx="5" cy="6" r="1" fill="currentColor"/>
            <path d="M3 10l3-3 2 2 2-2 2 3" stroke="currentColor" stroke-width="1" stroke-linejoin="round" fill="none"/>
          </svg>
        </button>
        <button class="tool-btn" @click="insertText('---\n', '')" title="Horizontal Rule">
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 7h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="toolbar-separator"></div>
      <div class="toolbar-group">
        <button class="tool-btn" @click="insertCodeBlock" title="Code Block">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 5L3 7l2 2M9 5l2 2-2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="tool-btn" @click="insertTable" title="Table">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="2" y="3" width="10" height="8" rx="1" stroke="currentColor" stroke-width="1"/>
            <path d="M2 7h10M6 3v8M10 3v8" stroke="currentColor" stroke-width="0.8"/>
          </svg>
        </button>
        <button class="tool-btn" @click="insertMermaid" title="Mermaid Diagram">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="3" cy="4" r="1.5" stroke="currentColor" stroke-width="1"/>
            <circle cx="11" cy="4" r="1.5" stroke="currentColor" stroke-width="1"/>
            <circle cx="7" cy="11" r="1.5" stroke="currentColor" stroke-width="1"/>
            <path d="M3 5.5L6.5 9.5M11 5.5L7.5 9.5" stroke="currentColor" stroke-width="1"/>
          </svg>
        </button>
        <button class="tool-btn" @click="insertMath" title="Math Equation">
          <span class="tool-text">∑</span>
        </button>
      </div>
      <div class="toolbar-separator"></div>
      <div class="toolbar-group">
        <button class="tool-btn" @click="wrapSelection('[[', ']]')" title="Keyboard">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="4" width="12" height="6" rx="1" stroke="currentColor" stroke-width="1"/>
            <path d="M3 6h2M6 6h2M9 6h2M3 8h8" stroke="currentColor" stroke-width="0.8" stroke-linecap="round"/>
          </svg>
        </button>
        <button class="tool-btn" @click="wrapSelection('~~', '~~')" title="Highlight">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 10l4-4 4 4-4 4H2v-4z" stroke="currentColor" stroke-width="1" fill="none"/>
            <path d="M8 4l3 3" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>
    
    <div class="editor-main">
      <textarea
        ref="textareaRef"
        class="markdown-editor"
        :value="modelValue"
        @input="onInput"
        @keydown="onKeydown"
        placeholder="Type your Markdown here..."
        spellcheck="false"
      ></textarea>
    </div>
  </div>
</template>

<script setup>import { ref, nextTick } from 'vue';
const props = defineProps({
  modelValue: String
});
const emit = defineEmits(['update:modelValue', 'change']);
const textareaRef = ref(null);
function onInput(e) {
  emit('update:modelValue', e.target.value);
  emit('change', e.target.value);
}
function getSelection() {
  const el = textareaRef.value;
  return { start: el.selectionStart, end: el.selectionEnd };
}
function setSelection(start, end) {
  const el = textareaRef.value;
  el.setSelectionRange(start, end);
}
function insertText(before, after) {
  const el = textareaRef.value;
  const { start, end } = getSelection();
  const selectedText = props.modelValue.substring(start, end);
  const newText = before + selectedText + after;
  const newValue = props.modelValue.substring(0, start) + newText + props.modelValue.substring(end);
  emit('update:modelValue', newValue);
  emit('change', newValue);
  nextTick(() => {
    setSelection(start + before.length, start + before.length + selectedText.length);
  });
}
function wrapSelection(before, after) {
  const el = textareaRef.value;
  const { start, end } = getSelection();
  const selectedText = props.modelValue.substring(start, end) || 'text';
  const newText = before + selectedText + after;
  const newValue = props.modelValue.substring(0, start) + newText + props.modelValue.substring(end);
  emit('update:modelValue', newValue);
  emit('change', newValue);
  nextTick(() => {
    setSelection(start + before.length, start + before.length + selectedText.length);
  });
}
function insertLink() {
  const url = prompt('Enter URL:', 'https://');
  if (url) {
    wrapSelection('[', `](${url})`);
  }
}
function insertImage() {
  const url = prompt('Enter image URL:', 'https://');
  if (url) {
    const alt = prompt('Enter alt text:', 'image') || 'image';
    const el = textareaRef.value;
    const { start, end } = getSelection();
    const newText = `![${alt}](${url})`;
    const newValue = props.modelValue.substring(0, start) + newText + props.modelValue.substring(end);
    emit('update:modelValue', newValue);
    emit('change', newValue);
  }
}
function insertCodeBlock() {
  const lang = prompt('Enter language (optional):', '') || '';
  wrapSelection(`\n\`\`\`${lang}\n`, '\n\`\`\`\n');
}
function insertTable() {
  const table = `\n| Header 1 | Header 2 | Header 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |\n`;
  const el = textareaRef.value;
  const { start, end } = getSelection();
  const newValue = props.modelValue.substring(0, start) + table + props.modelValue.substring(end);
  emit('update:modelValue', newValue);
  emit('change', newValue);
}
function insertMermaid() {
  const mermaid = `\n\`\`\`mermaid\ngraph TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Action 1]\n  B -->|No| D[Action 2]\n  C --> E[End]\n  D --> E\n\`\`\`\n`;
  const el = textareaRef.value;
  const { start, end } = getSelection();
  const newValue = props.modelValue.substring(0, start) + mermaid + props.modelValue.substring(end);
  emit('update:modelValue', newValue);
  emit('change', newValue);
}
function insertMath() {
  const math = `$E = mc^2$`;
  const el = textareaRef.value;
  const { start, end } = getSelection();
  const newValue = props.modelValue.substring(0, start) + math + props.modelValue.substring(end);
  emit('update:modelValue', newValue);
  emit('change', newValue);
}
function onKeydown(e) {
  // Tab key insertion
  if (e.key === 'Tab') {
    e.preventDefault();
    const el = textareaRef.value;
    const { start, end } = getSelection();
    const newValue = props.modelValue.substring(0, start) + '  ' + props.modelValue.substring(end);
    emit('update:modelValue', newValue);
    emit('change', newValue);
    nextTick(() => setSelection(start + 2, start + 2));
  }
  // Ctrl/Cmd shortcuts
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'b') {
      e.preventDefault();
      wrapSelection('**', '**');
    } else if (e.key === 'i') {
      e.preventDefault();
      wrapSelection('*', '*');
    } else if (e.key === 'e') {
      e.preventDefault();
      wrapSelection('`', '`');
    }
  }
}
</script>

<style scoped>
.editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}

.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 10px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-wrap: wrap;
  flex-shrink: 0;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.toolbar-separator {
  width: 1px;
  height: 18px;
  background: var(--border-color);
  margin: 0 6px;
}

.tool-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  transition: all 0.15s;
  padding: 0;
}

.tool-btn:hover {
  background: var(--bg-hover);
  color: var(--accent-primary);
  transform: translateY(-1px);
}

.tool-btn .tool-text {
  font-size: 11px;
  font-weight: 600;
}

.editor-main {
  flex: 1;
  overflow: hidden;
  display: flex;
}

.markdown-editor {
  width: 100%;
  height: 100%;
  padding: 20px;
  background: var(--bg-primary);
  color: var(--text-primary);
  border: none;
  resize: none;
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.7;
  tab-size: 2;
  caret-color: var(--accent-primary);
  transition: background 0.2s;
}

.markdown-editor:focus {
  background: var(--bg-primary);
}

.markdown-editor::selection {
  background: rgba(99, 102, 241, 0.3);
}
</style>
