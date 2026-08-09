import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'chrome132',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: {
        manualChunks: {
          editor: ['codemirror', '@codemirror/lang-markdown', '@codemirror/theme-one-dark'],
          markdown: ['markdown-it', 'highlight.js', 'katex'],
          diagrams: ['mermaid']
        }
      }
    }
  }
});
