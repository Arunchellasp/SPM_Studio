/** Screens only, in a normal browser, with the built-in simulator (no Electron). */
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const PROJECTS = ['**/projects/**']

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  resolve: {
    alias: { '@shared': resolve(__dirname, 'src/shared'), '@renderer': resolve(__dirname, 'src/renderer/src') }
  },
  plugins: [react()],
  // the demo project and the schemas live next to studio/ (projects/, schemas/) — step 16
  // projects/ holds the app's data, not its code: Save rewrites tags.json there, and a dev-server reload
  // on that would drop the open project and jump to N01 (found on the PC, step 25 physical test P-20.3)
  server: { fs: { allow: [resolve(__dirname, '..')] }, watch: { ignored: PROJECTS } },
  build: { outDir: resolve(__dirname, 'out/web'), emptyOutDir: true }
})
