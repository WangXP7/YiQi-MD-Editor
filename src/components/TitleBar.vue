<template>
  <div class="title-bar title-bar-drag">
    <div class="title-bar-left">
      <div class="app-logo">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#6366f1" />
              <stop offset="50%" style="stop-color:#8b5cf6" />
              <stop offset="100%" style="stop-color:#ec4899" />
            </linearGradient>
          </defs>
          <rect x="1" y="1" width="22" height="22" rx="5" fill="url(#logoGrad)" />
          <path d="M6 16V8l3 4 3-4v8" stroke="white" stroke-width="2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
          <path d="M15 8v8" stroke="white" stroke-width="2" stroke-linecap="round"/>
          <circle cx="18" cy="10" r="1.5" fill="white"/>
        </svg>
      </div>
      <span class="app-title">{{ appName }}</span>
      <span class="file-name" v-if="fileName">· {{ fileName }}</span>
      <span class="unsaved-indicator" v-if="isModified">●</span>
    </div>
    
    <div class="title-bar-center">
      <span class="version-badge">v{{ version }}</span>
    </div>
    
    <div class="title-bar-right title-bar-no-drag">
      <button class="window-btn minimize" @click="$emit('minimize')" title="Minimize">
        <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="5.5" width="10" height="1" fill="currentColor"/></svg>
      </button>
      <button class="window-btn maximize" @click="$emit('maximize')" title="Maximize">
        <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
      </button>
      <button class="window-btn close" @click="$emit('close')" title="Close">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  appName: String,
  fileName: String,
  isModified: Boolean,
  theme: String
});

defineEmits(['minimize', 'maximize', 'close']);
</script>

<style scoped>
.title-bar {
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  user-select: none;
  flex-shrink: 0;
}

.title-bar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-left: 4px;
}

.app-logo {
  display: flex;
  align-items: center;
}

.app-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
}

.file-name {
  color: var(--text-secondary);
  font-size: 12px;
}

.unsaved-indicator {
  color: var(--warning);
  font-size: 10px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.title-bar-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.version-badge {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
}

.title-bar-right {
  display: flex;
  align-items: center;
  gap: 2px;
}

.window-btn {
  width: 36px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  border-radius: 4px;
}

.window-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.window-btn.close:hover {
  background: var(--danger);
  color: white;
}
</style>
