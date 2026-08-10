<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <button class="sidebar-btn new-btn" @click="$emit('new-file')" title="New File">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
        <span>New</span>
      </button>
      <button class="sidebar-btn open-btn" @click="$emit('open-file')" title="Open File">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h4l2 2h6v8H2V4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
        <span>Open</span>
      </button>
    </div>
    
    <div class="sidebar-section">
      <div class="section-title">Files</div>
      <div class="file-list">
        <div
          v-for="file in files"
          :key="file.id"
          class="file-item"
          :class="{ active: file.id === activeId }"
          @click="$emit('select-file', file.id)"
        >
          <div class="file-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5L2.5 4v6L7 12.5 11.5 10V4L7 1.5z" stroke="currentColor" stroke-width="1" fill="none"/>
              <path d="M5 5.5h4M5 7.5h4M5 9.5h2.5" stroke="currentColor" stroke-width="0.8" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="file-info">
            <div class="file-name">{{ file.name }}</div>
            <div class="file-path" v-if="file.path">{{ file.path }}</div>
          </div>
          <div class="file-modified" v-if="file.modified">●</div>
          <button class="close-btn" @click.stop="$emit('close-file', file.id)" title="Close">
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div v-if="files.length === 0" class="empty-state">
          <span>No files open</span>
        </div>
      </div>
    </div>
    
    <div class="sidebar-footer">
      <div class="shortcut-hints">
        <div class="hint"><kbd>Ctrl</kbd> + <kbd>N</kbd> New</div>
        <div class="hint"><kbd>Ctrl</kbd> + <kbd>O</kbd> Open</div>
        <div class="hint"><kbd>Ctrl</kbd> + <kbd>S</kbd> Save</div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  files: Array,
  activeId: String
});

defineEmits(['new-file', 'open-file', 'close-file', 'select-file']);
</script>

<style scoped>
.sidebar {
  width: 240px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 12px;
  display: flex;
  gap: 8px;
  border-bottom: 1px solid var(--border-color);
}

.sidebar-btn {
  flex: 1;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
}

.sidebar-btn:hover {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: white;
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.sidebar-section {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 8px;
  letter-spacing: 0.5px;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
}

.file-item:hover {
  background: var(--bg-hover);
}

.file-item.active {
  background: var(--bg-tertiary);
  border: 1px solid var(--accent-primary);
  padding: 7px 9px;
}

.file-icon {
  color: var(--accent-primary);
  display: flex;
  align-items: center;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-path {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-modified {
  color: var(--warning);
  font-size: 8px;
}

.close-btn {
  opacity: 0;
  padding: 4px;
  color: var(--text-muted);
  border-radius: 4px;
}

.file-item:hover .close-btn {
  opacity: 1;
}

.close-btn:hover {
  background: var(--danger);
  color: white;
}

.empty-state {
  text-align: center;
  padding: 20px;
  color: var(--text-muted);
  font-size: 12px;
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid var(--border-color);
}

.shortcut-hints {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hint {
  font-size: 11px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 4px;
}

kbd {
  display: inline-block;
  padding: 1px 5px;
  font-size: 10px;
  font-family: var(--font-mono);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  color: var(--text-secondary);
}
</style>
