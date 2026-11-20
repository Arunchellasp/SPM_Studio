import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const alias = {
  '@shared': resolve(__dirname, 'src/shared')
}

export default defineConfig({
  main: {
    resolve: { alias },
    build: { outDir: 'out/main' }
  },
  preload: {
    resolve: { alias },
    build: { outDir: 'out/preload' }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: { ...alias, '@renderer': resolve(__dirname, 'src/renderer/src') }
    },
    plugins: [react()],
    build: {
      outDir: resolve(__dirname, 'out/renderer'),
      rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') }
    }
  }
})
