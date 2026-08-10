<template>
  <div class="tab-bar">
    <div class="tabs">
      <div
        v-for="file in files"
        :key="file.id"
        class="tab"
        :class="{ active: file.id === activeId }"
        @click="$emit('select-file', file.id)"
      >
        <div class="tab-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1L2 3.5v5L6 11l4-2.5v-5L6 1z" stroke="currentColor" stroke-width="1"/>
          </svg>
        </div>
        <span class="tab-name">{{ file.name }}</span>
        <span class="tab-dot" v-if="file.modified">●</span>
        <button class="tab-close" @click.stop="$emit('close-file', file.id)">
          <svg width="8" height="8" viewBox="0 0 8 8">
            <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="tab-actions">
      <button class="action-btn" title="Split View">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="1" width="5" height="12" rx="1" stroke="currentColor" stroke-width="1"/>
          <rect x="8" y="1" width="5" height="12" rx="1" stroke="currentColor" stroke-width="1"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  files: Array,
  activeId: String
});

defineEmits(['select-file', 'close-file']);
</script>

<style scoped>
.tab-bar {
  height: 36px;
  display: flex;
  align-items: center;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  padding: 0 8px;
  flex-shrink: 0;
  overflow: hidden;
}

.tabs {
  display: flex;
  gap: 4px;
  flex: 1;
  overflow-x: auto;
  height: 100%;
  align-items: center;
}

.tabs::-webkit-scrollbar {
  height: 0;
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
  height: 28px;
  max-width: 200px;
}

.tab:hover {
  background: var(--bg-hover);
}

.tab.active {
  background: var(--bg-primary);
  border-color: var(--accent-primary);
  color: var(--text-primary);
}

.tab-icon {
  color: var(--accent-primary);
  display: flex;
}

.tab-name {
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.tab.active .tab-name {
  color: var(--text-primary);
}

.tab-dot {
  color: var(--warning);
  font-size: 8px;
}

.tab-close {
  opacity: 0;
  padding: 2px;
  color: var(--text-muted);
  border-radius: 3px;
  display: flex;
  align-items: center;
}

.tab:hover .tab-close,
.tab.active .tab-close {
  opacity: 1;
}

.tab-close:hover {
  background: var(--danger);
  color: white;
}

.tab-actions {
  display: flex;
  gap: 4px;
  padding-left: 8px;
  border-left: 1px solid var(--border-color);
  margin-left: 8px;
}

.action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
}

.action-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
</style>
