<template>
  <div class="status-bar">
    <div class="status-left">
      <span class="status-item">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 1L2 3.5v5L6 11l4-2.5v-5L6 1z" stroke="currentColor" stroke-width="1"/>
        </svg>
        {{ fileName }}
      </span>
    </div>
    
    <div class="status-center">
      <span class="status-item">{{ lineCount }} lines</span>
      <span class="status-divider">|</span>
      <span class="status-item">{{ wordCount }} words</span>
      <span class="status-divider">|</span>
      <span class="status-item">{{ charCount }} chars</span>
    </div>
    
    <div class="status-right">
      <button class="status-btn" @click="$emit('toggle-editor')" :class="{ active: showEditor }" title="Toggle Editor">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <rect x="1" y="1" width="4" height="10" rx="0.5" fill="none" stroke="currentColor" stroke-width="1"/>
          <rect x="7" y="1" width="4" height="10" rx="0.5" fill="none" stroke="currentColor" stroke-width="1"/>
        </svg>
        <span>Editor</span>
      </button>
      <button class="status-btn" @click="$emit('toggle-preview')" :class="{ active: showPreview }" title="Toggle Preview">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M1 6s2-3.5 5-3.5S11 6 11 6s-2 3.5-5 3.5S1 6 1 6z" stroke="currentColor" stroke-width="1"/>
          <circle cx="6" cy="6" r="1.5" stroke="currentColor" stroke-width="1"/>
        </svg>
        <span>Preview</span>
      </button>
      <button class="status-btn" @click="$emit('toggle-split')" title="Toggle Split Direction">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <rect x="1" y="1" width="4" height="10" rx="0.5" fill="none" stroke="currentColor" stroke-width="1"/>
          <rect x="7" y="1" width="4" height="10" rx="0.5" fill="none" stroke="currentColor" stroke-width="1"/>
        </svg>
        <span>{{ splitDirection === 'horizontal' ? 'Side' : 'Top' }}</span>
      </button>
      <div class="status-divider">|</div>
      <button class="status-btn theme-btn" @click="$emit('toggle-theme')" title="Toggle Theme">
        <svg v-if="theme === 'dark'" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="2.5" stroke="currentColor" stroke-width="1"/>
          <path d="M6 0.5v1.5M6 10v1.5M0.5 6H2M10 6h1.5M2 2l1 1M9 9l1 1M10 2l-1 1M3 9l-1 1" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
        </svg>
        <svg v-else width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M10.5 7.5A4.5 4.5 0 014.5 1.5c.5 0 1 .1 1.5.3a5.5 5.5 0 004.2 4.2c.2.5.3 1 .3 1.5z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>
        </svg>
        <span>{{ theme === 'dark' ? 'Dark' : 'Light' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  fileName: String,
  charCount: Number,
  lineCount: Number,
  wordCount: Number,
  cursorPosition: Object,
  theme: String,
  splitDirection: String,
  showEditor: Boolean,
  showPreview: Boolean
});

defineEmits(['toggle-theme', 'toggle-split', 'toggle-editor', 'toggle-preview']);
</script>

<style scoped>
.status-bar {
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  font-size: 11px;
  flex-shrink: 0;
}

.status-left,
.status-center,
.status-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-item {
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-item svg {
  color: var(--accent-primary);
}

.status-divider {
  color: var(--border-color);
}

.status-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--text-muted);
  font-size: 11px;
  transition: all 0.15s;
}

.status-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.status-btn.active {
  color: var(--accent-primary);
}

.theme-btn {
  border: 1px solid var(--border-color);
}

.theme-btn:hover {
  border-color: var(--accent-primary);
}
</style>
