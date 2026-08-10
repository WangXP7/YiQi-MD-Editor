<template>
  <div class="app-container" :data-theme="theme">
    <TitleBar
      :app-name="appName"
      :file-name="currentFile?.name || 'Untitled'"
      :is-modified="isModified"
      :theme="theme"
      @minimize="onMinimize"
      @maximize="onMaximize"
      @close="onClose"
    />
    
    <div class="main-content">
      <Sidebar
        :files="files"
        :active-id="activeFileId"
        @new-file="newFile"
        @open-file="openFile"
        @close-file="closeFile"
        @select-file="selectFile"
      />
      
      <div class="editor-area">
        <TabBar
          :files="files"
          :active-id="activeFileId"
          @select-file="selectFile"
          @close-file="closeFile"
        />
        
        <div class="split-container" :style="{ flexDirection: splitDirection === 'horizontal' ? 'row' : 'column' }">
          <div v-if="showEditor" class="editor-pane">
            <Editor
              v-model="currentContent"
              @change="onContentChange"
            />
          </div>
          
          <div v-if="showPreview" class="preview-pane">
            <Preview
              :content="currentContent"
              :theme="theme"
            />
          </div>
        </div>
        
        <StatusBar
          :file-name="currentFile?.name || 'Untitled'"
          :char-count="currentContent.length"
          :line-count="lineCount"
          :word-count="wordCount"
          :cursor-position="cursorPosition"
          :theme="theme"
          :split-direction="splitDirection"
          :show-editor="showEditor"
          :show-preview="showPreview"
          @toggle-theme="toggleTheme"
          @toggle-split="toggleSplit"
          @toggle-editor="toggleEditor"
          @toggle-preview="togglePreview"
        />
      </div>
    </div>
  </div>
</template>

<script setup>import { ref, computed, watch, onMounted } from 'vue';
import TitleBar from './components/TitleBar.vue';
import Sidebar from './components/Sidebar.vue';
import TabBar from './components/TabBar.vue';
import Editor from './components/Editor.vue';
import Preview from './components/Preview.vue';
import StatusBar from './components/StatusBar.vue';
const appName = 'YiQi@MD-Editor-Trae-SeedCode';
const version = ref('1.0.0');
// File management
const files = ref([]);
const activeFileId = ref(null);
const isModified = ref(false);
// Editor state
const currentContent = ref('');
const cursorPosition = ref({ line: 1, column: 1 });
// View state
const theme = ref('dark');
const splitDirection = ref('horizontal');
const showEditor = ref(true);
const showPreview = ref(true);
// Computed
const currentFile = computed(() => files.value.find(f => f.id === activeFileId.value));
const lineCount = computed(() => currentContent.value.split('\n').length);
const wordCount = computed(() => currentContent.value.trim() ? currentContent.value.trim().split(/\s+/).length : 0);
// Watch content changes
watch(currentContent, (newVal) => {
 if (currentFile.value) {
 currentFile.value.content = newVal;
 isModified.value = true;
 }
});
// Methods
function newFile() {
 const id = Date.now().toString();
 const file = {
 id,
 name: 'Untitled.md',
 path: null,
 content: '# Welcome to YiQi@MD-Editor-Trae-SeedCode\n\nThis is a beautiful Markdown editor with full GFM support.\n\n## Features\n\n- ✅ GitHub Flavored Markdown\n- ✅ Live Preview\n- ✅ Code Highlighting\n- ✅ Mermaid Diagrams\n- ✅ Math Equations\n- ✅ Task Lists\n- ✅ Tables\n- ✅ Emoji Support\n- ✅ Dark/Light Theme\n- ✅ Export to HTML\n\n### Try it out!\n\n```javascript\nfunction hello() {\n console.log("Hello, YiQi!");\n}\n```\n\n> This is a blockquote\n> With multiple lines\n\n| Feature | Status |\n|---------|--------|\n| GFM | ✅ |\n| Math | ✅ |\n| Mermaid | ✅ |\n\n- [x] Completed task\n- [ ] Pending task\n\nHappy writing! ✨',
 modified: false
 };
 files.value.push(file);
 activeFileId.value = id;
 currentContent.value = file.content;
 isModified.value = false;
}
async function openFile() {
 const result = await window.electronAPI.openFileDialog();
 if (result) {
 const id = Date.now().toString();
 const file = {
 id,
 name: result.path.split(/[\\/]/).pop(),
 path: result.path,
 content: result.content,
 modified: false
 };
 files.value.push(file);
 activeFileId.value = id;
 currentContent.value = result.content;
 isModified.value = false;
 }
}
function selectFile(id) {
 // Save current file first
 if (currentFile.value && isModified.value) {
 currentFile.value.content = currentContent.value;
 }
 activeFileId.value = id;
 const file = files.value.find(f => f.id === id);
 if (file) {
 currentContent.value = file.content;
 isModified.value = file.modified || false;
 }
}
async function closeFile(id) {
 const idx = files.value.findIndex(f => f.id === id);
 if (idx === -1)
 return;
 const file = files.value[idx];
 if (file.modified && file.path) {
 await saveFile();
 }
 files.value.splice(idx, 1);
 if (activeFileId.value === id) {
 if (files.value.length > 0) {
 activeFileId.value = files.value[Math.max(0, idx - 1)].id;
 currentContent.value = files.value[activeFileId.value].content;
 }
 else {
 activeFileId.value = null;
 currentContent.value = '';
 newFile();
 }
 }
}
async function saveFile() {
 if (!currentFile.value)
 return;
 let path = currentFile.value.path;
 if (!path) {
 const result = await window.electronAPI.saveFileDialog(currentContent.value, currentFile.value.name);
 if (result) {
 path = result.path;
 currentFile.value.path = path;
 }
 else {
 return;
 }
 }
 await window.electronAPI.saveFile(path, currentContent.value);
 isModified.value = false;
 currentFile.value.modified = false;
}
function onContentChange(value) {
 currentContent.value = value;
}
function toggleTheme() {
 theme.value = theme.value === 'dark' ? 'light' : 'dark';
 document.documentElement.setAttribute('data-theme', theme.value);
 localStorage.setItem('yiqi-theme', theme.value);
}
function toggleSplit() {
 splitDirection.value = splitDirection.value === 'horizontal' ? 'vertical' : 'horizontal';
}
function toggleEditor() {
 showEditor.value = !showEditor.value;
}
function togglePreview() {
 showPreview.value = !showPreview.value;
}
function onMinimize() {
 // Would call electronAPI.minimize() in production
}
function onMaximize() {
 // Would call electronAPI.maximize() in production
}
function onClose() {
 // Would call electronAPI.close() in production
}
// Keyboard shortcuts
function handleKeydown(e) {
 if ((e.ctrlKey || e.metaKey) && e.key === 's') {
 e.preventDefault();
 saveFile();
 }
 if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
 e.preventDefault();
 openFile();
 }
 if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
 e.preventDefault();
 newFile();
 }
}
onMounted(async () => {
 document.addEventListener('keydown', handleKeydown);
 // Load theme from localStorage
 const savedTheme = localStorage.getItem('yiqi-theme');
 if (savedTheme) {
 theme.value = savedTheme;
 }
 // Get app version
 try {
 const ver = await window.electronAPI.getAppVersion();
 if (ver)
 version.value = ver;
 }
 catch (e) { /* running in browser */ }
 // Create initial file
 if (files.value.length === 0) {
 newFile();
 }
});
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--bg-primary);
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.editor-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.split-container {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.editor-pane,
.preview-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 200px;
  min-height: 200px;
}

.split-container[data-direction="vertical"] .editor-pane,
.split-container[data-direction="vertical"] .preview-pane {
  min-height: 150px;
}

/* Resizer */
.resizer {
  width: 4px;
  height: 100%;
  background: var(--border-color);
  cursor: col-resize;
  transition: background 0.2s;
}

.resizer:hover {
  background: var(--accent-primary);
}

.split-container[data-direction="vertical"] .resizer {
  width: 100%;
  height: 4px;
  cursor: row-resize;
}
</style>
