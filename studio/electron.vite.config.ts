import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const PROJECTS = ['**/projects/**']

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
    // projects/ holds the app's data, not its code: Save rewrites tags.json there, and a dev-server reload
    // on that would drop the open project and jump to N01 (found on the PC, step 25 physical test P-20.3)
    server: { fs: { allow: [resolve(__dirname, '..')] }, watch: { ignored: PROJECTS } }, // projects/ and schemas/ next to studio/ (step 16)
    build: {
      outDir: resolve(__dirname, 'out/renderer'),
      rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') }
    }
  }
})
