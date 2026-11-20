/** Screens only, in a normal browser, with the built-in simulator (no Electron). */
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  resolve: {
    alias: { '@shared': resolve(__dirname, 'src/shared'), '@renderer': resolve(__dirname, 'src/renderer/src') }
  },
  plugins: [react()],
  build: { outDir: resolve(__dirname, 'out/web'), emptyOutDir: true }
})
