import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // 默认 node 环境（纯逻辑测试，且 Node 的 Blob.text() 在 copyHtml 测试中被依赖）。
    // 仅 .tsx 组件集成测试切换到 jsdom（需要真实 DOM 渲染）。
    environment: 'node',
    environmentMatchGlobs: [['**/*.test.tsx', 'jsdom']],
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx']
  }
})
