/**
 * Step 36 · the studio works with spm_rt instead of the mock: the built Electron app against the C runtime.
 *   UI-36.1 link Online with the runtime's version and cycle · UI-36.2 Reset / Start / Hold / Stop through the queue
 *   UI-36.3 the alarm demo on the SimCard: banner, Ack · UI-36.4 open the project, Download → the runtime's CRC
 *   UI-36.5 unplug (runtime killed) → OFFLINE within 3 s; replug (started again) → Online by itself
 *   UI-36.6 answers come back fast: ping and command round trips (a second client next to the studio)
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import WebSocket from 'ws'

const STUDIO = resolve(__dirname, '..')
const REPO = resolve(STUDIO, '..')
const PORT = 17660 // not 7600: a runtime or mock left running on the PC does not get in the way
const exe = process.platform === 'win32' ? '.exe' : ''
const RT_BIN =
  process.env.SPM_RT_BIN ??
  [
    join(REPO, 'runtime/build/Release/spm_rt' + exe),
    join(REPO, 'runtime/build/spm_rt' + exe),
    join(REPO, 'runtime/build-win/spm_rt.exe')
  ].find((p) => existsSync(p)) ??
  ''

const link = (page: Page): Locator => page.getByTestId('runtime-link')
const pill = (page: Page): Locator => page.locator('.header .state-pill')
const btn = (page: Page, name: string): Locator => page.locator('.header-commands button', { hasText: name })
const banner = (page: Page): Locator => page.locator('footer.banner')

let dir = ''
let rt: ChildProcess | null = null
let rtLog = ''
let app: ElectronApplication
let page: Page

/** start spm_rt on the test project; resolves when its WebSocket server listens */
async function startRuntime(): Promise<void> {
  rtLog = ''
  rt = spawn(RT_BIN, [join(dir, 'config.json')], { stdio: ['ignore', 'pipe', 'pipe'] })
  rt.stdout?.on('data', (d: Buffer) => (rtLog += d.toString()))
  rt.stderr?.on('data', (d: Buffer) => (rtLog += d.toString()))
  await expect.poll(() => rtLog, { timeout: 10_000 }).toContain('link: ws://127.0.0.1:' + PORT)
}
async function killRuntime(): Promise<void> {
  if (!rt) return
  const p = rt
  rt = null
  await new Promise<void>((done) => {
    p.once('exit', () => done())
    p.kill('SIGKILL') // the cable is pulled: no goodbye
  })
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  expect(RT_BIN, 'spm_rt is not built (cmake -S runtime -B runtime/build && cmake --build runtime/build) or set SPM_RT_BIN').not.toBe('')
  dir = mkdtempSync(join(tmpdir(), 'spm-rt-ui-'))
  copyFileSync(join(REPO, 'projects/demo/tags.json'), join(dir, 'tags.json'))
  copyFileSync(join(__dirname, 'fixtures/program.json'), join(dir, 'program.json'))
  writeFileSync(
    join(dir, 'config.json'),
    JSON.stringify({
      schema: 'spm.config/1',
      card: 'sim',
      cycle_us: 1000,
      spin_us: 200,
      ws_port: PORT,
      stats_s: 60,
      sim: { cylinder_ms: 200, demo_alarms: true }
    })
  )
  await startRuntime()
  app = await electron.launch({
    args: [join(STUDIO, 'out/main/index.js'), ...(process.getuid?.() === 0 ? ['--no-sandbox'] : [])],
    env: { ...process.env, SPM_RUNTIME_URL: `ws://127.0.0.1:${PORT}`, SPM_DISABLE_GPU: '1', NODE_ENV: 'production' }
  })
  page = await app.firstWindow()
  await page.setViewportSize({ width: 1920, height: 1080 })
})

test.afterAll(async () => {
  await app?.close()
  await killRuntime()
  if (dir) rmSync(dir, { recursive: true, force: true })
})

test('UI-36.1 Online at spm_rt: the runtime’s version and cycle in the link chip', async () => {
  await expect(link(page)).toHaveText('Online · 1.00 ms', { timeout: 10_000 })
  await expect(link(page)).toHaveAttribute(
    'title',
    new RegExp(`^Runtime online at ws://127\\.0\\.0\\.1:${PORT}\\nversion 0\\.3\\.0\\ncycle 1\\.00 ms · max \\d+\\.\\d\\d ms$`)
  )
  await expect(pill(page)).toHaveText('STOPPED')
  expect(rtLog).toContain('link: studio connected')
})

test('UI-36.2 Reset, Start, Hold, Start, Stop go through the queue to the RT cycle and come back as states', async () => {
  await btn(page, 'Reset').click()
  await expect(pill(page)).toHaveText('IDLE')
  await expect(btn(page, 'Reset')).toBeDisabled() // the runtime's state decides the buttons, as with the mock
  await btn(page, 'Start').click()
  await expect(pill(page)).toHaveText('EXECUTE')
  await btn(page, 'Hold').click()
  await expect(pill(page)).toHaveText('HELD')
  await btn(page, 'Start').click()
  await expect(pill(page)).toHaveText('EXECUTE')
  expect(rtLog).toMatch(/machine STARTING[\s\S]*machine EXECUTE[\s\S]*machine HOLDING[\s\S]*machine HELD[\s\S]*machine UNHOLDING/)
})

test('UI-36.3 the SimCard alarm demo: W0310 in the banner after 6 s in EXECUTE, Ack goes to spm_rt with the user', async () => {
  await expect(banner(page)).toContainText('W0310', { timeout: 12_000 })
  await banner(page).getByRole('button', { name: 'Ack' }).click()
  await expect.poll(() => rtLog).toMatch(/alarm ack W0310 by A\. Engineer/)
  await btn(page, 'Stop').click()
  await expect(pill(page)).toHaveText('STOPPED')
})

test('UI-36.4 open the project, Download: spm_rt checks the CRC and reports the program back', async () => {
  await app.evaluate(({ dialog }, d) => {
    dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [d] }) // the folder dialog, answered
  }, dir)
  await page.locator('.rail-item', { hasText: 'Tags' }).click()
  await page.getByRole('button', { name: 'Open project…' }).click()
  await expect(page.getByRole('status').filter({ hasText: /Opened .* · 20 tags/ })).toBeVisible()
  await page.locator('.rail-item', { hasText: 'Program' }).click()
  await page.locator('.seq-tree').getByRole('button', { name: 'Download' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Downloaded to the runtime · 1 flow · CRC 8FF94EA7' })).toBeVisible()
  await expect.poll(() => rtLog).toContain('program 8FF94EA7 loaded')
  await expect(page.getByTestId('seq-status')).not.toHaveText(/other program|no program/) // the runtime now runs this one
})

test('UI-36.5 unplug: spm_rt killed → OFFLINE within 3 s, buttons off; replug: started again → Online by itself', async () => {
  await killRuntime()
  const t0 = Date.now()
  await expect(link(page)).toHaveAttribute('data-link', 'offline', { timeout: 3_500 })
  expect(Date.now() - t0).toBeLessThan(3_500)
  await expect(btn(page, 'Stop')).toBeDisabled()
  await startRuntime()
  await expect(link(page)).toHaveText('Online · 1.00 ms', { timeout: 10_000 }) // nobody clicked anything
  await expect(pill(page)).toHaveText('STOPPED') // a fresh runtime: its own state, not the old one
  await expect(page.getByTestId('seq-status')).toHaveText(/no program/) // and no program until the next Download
})

test('UI-36.6 answers come back fast: 50 pings and 50 commands, p95 under 20 ms (TCP_NODELAY; was ~44 ms)', async () => {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}`)
  await new Promise<void>((ok, fail) => {
    ws.once('open', () => ok())
    ws.once('error', fail)
  })
  const rtt = async (msg: object, match: (m: { t: string; id?: number }) => boolean): Promise<number> => {
    const t0 = performance.now()
    const got = new Promise<void>((ok) => {
      const on = (d: WebSocket.RawData): void => {
        if (match(JSON.parse(d.toString()) as { t: string; id?: number })) {
          ws.off('message', on)
          ok()
        }
      }
      ws.on('message', on)
    })
    ws.send(JSON.stringify(msg))
    await got
    return performance.now() - t0
  }
  const ping: number[] = []
  const cmd: number[] = []
  for (let i = 0; i < 50; i++) {
    ping.push(await rtt({ t: 'ping' }, (m) => m.t === 'pong'))
    const id = 9000 + i // 'hold' in STOPPED: refused by the RT cycle — the full way through queue, cycle, ring and pump
    cmd.push(await rtt({ t: 'cmd', id, op: 'hold' }, (m) => m.t === 'res' && m.id === id))
  }
  ws.close()
  const p95 = (v: number[]): number => [...v].sort((a, b) => a - b)[Math.floor(0.95 * (v.length - 1))]!
  console.log(`ping p95 ${p95(ping).toFixed(2)} ms · command p95 ${p95(cmd).toFixed(2)} ms`)
  expect(p95(ping)).toBeLessThan(20)
  expect(p95(cmd)).toBeLessThan(20)
})
