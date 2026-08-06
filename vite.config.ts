import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

// 主进程需要把 node 内建模块与 electron 本身标记为 external，避免被打进 bundle
const mainExternal = ['electron', 'fs', 'fs/promises', 'path', 'os', 'url', 'crypto']

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: mainExternal
            }
          }
        }
      },
      {
        entry: 'src/main/preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron'
          }
        }
      }
    ]),
    renderer()
  ],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000
  }
})
