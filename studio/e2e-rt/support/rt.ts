/**
 * Helpers for the tests of the real pair (studio + spm_rt): a project in a temp folder, spm_rt on it, the built app.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test'

export const STUDIO = resolve(__dirname, '../..')
export const REPO = resolve(STUDIO, '..')
const exe = process.platform === 'win32' ? '.exe' : ''
export const RT_BIN =
  process.env.SPM_RT_BIN ??
  [
    join(REPO, 'runtime/build/Release/spm_rt' + exe),
    join(REPO, 'runtime/build/spm_rt' + exe),
    join(REPO, 'runtime/build-win/spm_rt.exe')
  ].find((p) => existsSync(p)) ??
  ''

/** a copy of projects/demo (tags.json + program.json, no program.rt.json) with spm_rt's config on `port` */
export function demoProject(port: number): string {
  const dir = mkdtempSync(join(tmpdir(), 'spm-rt-flow-'))
  for (const f of ['tags.json', 'program.json']) copyFileSync(join(REPO, 'projects/demo', f), join(dir, f))
  writeFileSync(
    join(dir, 'config.json'),
    JSON.stringify({
      schema: 'spm.config/1',
      card: 'sim',
      cycle_us: 1000,
      spin_us: 200,
      ws_port: port,
      stats_s: 60,
      sim: { cylinder_ms: 200 }
    })
  )
  return dir
}

export class Runtime {
  log = ''
  private p: ChildProcess | null = null
  constructor(
    private readonly dir: string,
    private readonly port: number
  ) {}
  async start(): Promise<void> {
    this.log = ''
    this.p = spawn(RT_BIN, [join(this.dir, 'config.json')], { stdio: ['ignore', 'pipe', 'pipe'] })
    this.p.stdout?.on('data', (d: Buffer) => (this.log += d.toString()))
    this.p.stderr?.on('data', (d: Buffer) => (this.log += d.toString()))
    await expect.poll(() => this.log, { timeout: 10_000 }).toContain('link: ws://127.0.0.1:' + this.port)
  }
  async kill(): Promise<void> {
    const p = this.p
    this.p = null
    if (!p) return
    await new Promise<void>((done) => {
      p.once('exit', () => done())
      p.kill('SIGKILL')
    })
  }
}

export async function launchStudio(port: number): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: [join(STUDIO, 'out/main/index.js'), ...(process.getuid?.() === 0 ? ['--no-sandbox'] : [])],
    env: { ...process.env, SPM_RUNTIME_URL: `ws://127.0.0.1:${port}`, SPM_DISABLE_GPU: '1', NODE_ENV: 'production' }
  })
  const page = await app.firstWindow()
  await page.setViewportSize({ width: 1920, height: 1080 })
  return { app, page }
}

/** Tags › Open project… with the folder dialog answered in main */
export async function openProject(app: ElectronApplication, page: Page, dir: string): Promise<void> {
  await app.evaluate(({ dialog }, d) => {
    dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [d] })
  }, dir)
  await page.locator('.rail-item', { hasText: 'Tags' }).click()
  await page.getByRole('button', { name: 'Open project…' }).click()
  await expect(page.getByRole('status').filter({ hasText: /Opened .* · 20 tags/ })).toBeVisible()
}
