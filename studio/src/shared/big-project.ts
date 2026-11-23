/**
 * A large, valid tag table for speed tests (N03 grid must scroll 1000 tags smoothly — step 18).
 * 10 stations × 100 tags; every name and address is unique. Used by the browser stand-in
 * (?project=big) and by the step 18 speed test on the PC (written to a folder there).
 */
import type { Tag, TagFile } from './ipc'

const pad = (n: number, w = 3): string => String(n).padStart(w, '0')

export function makeBigProject(stations = 10): TagFile {
  const tags: Tag[] = []
  for (let s = 1; s <= stations; s++) {
    const S = `S${s}`
    const slave = s * 10 // each station has its own block of EtherCAT slaves
    for (let i = 0; i < 32; i++) tags.push({ name: `DI_${S}_${pad(i)}`, kind: 'DI', dtype: 'BOOL', scope: S, addr: { bus: 'ecat', slave, ch: i }, debounce_ms: 5, desc: `${S} input ${i}` })
    for (let i = 0; i < 32; i++) tags.push({ name: `DO_${S}_${pad(i)}`, kind: 'DO', dtype: 'BOOL', scope: S, addr: { bus: 'ecat', slave: slave + 1, ch: i }, safe_state: false, desc: `${S} output ${i}` })
    for (let i = 0; i < 4; i++) tags.push({ name: `AI_${S}_${pad(i)}`, kind: 'AI', dtype: 'REAL', scope: S, addr: { bus: 'ecat', slave: slave + 2, ch: i }, scale: { raw: [0, 32767], eng: [0, 100] }, unit: 'bar' })
    for (let i = 0; i < 4; i++) tags.push({ name: `AO_${S}_${pad(i)}`, kind: 'AO', dtype: 'REAL', scope: S, addr: { bus: 'ecat', slave: slave + 3, ch: i }, scale: { raw: [0, 32767], eng: [0, 10] }, unit: 'V' })
    for (let i = 0; i < 2; i++) tags.push({ name: `AX_${S}_${pad(i)}`, kind: 'AXIS', dtype: 'STRUCT', scope: S, addr: { bus: 'ecat', slave: slave + 4 + i }, unit: 'mm', ppu: 1000, vmax: 500, acc: 3000 })
    for (let i = 0; i < 10; i++) tags.push({ name: `P_${S}_${pad(i)}`, kind: 'POINT', dtype: 'REAL', scope: S, axes: [`AX_${S}_000`, `AX_${S}_001`], values: [i * 10, i * 5], teach: true })
    for (let i = 0; i < 8; i++) tags.push({ name: `R_${S}_${pad(i)}`, kind: 'REG', dtype: i < 4 ? 'BOOL' : 'DINT', scope: S, init: i < 4 ? false : 0, retain: i >= 4 })
    for (let i = 0; i < 4; i++) tags.push({ name: `T_${S}_${pad(i)}`, kind: 'TIMER', dtype: 'STRUCT', scope: S, preset_ms: 100 * (i + 1) })
    for (let i = 0; i < 2; i++) tags.push({ name: `C_${S}_${pad(i)}`, kind: 'COUNTER', dtype: 'STRUCT', scope: S, preset: 1000 })
    for (let i = 0; i < 2; i++) tags.push({ name: `A_${S}_${pad(i)}`, kind: 'ALARM', dtype: 'STRUCT', scope: S, code: s * 100 + i, text: `${S} alarm ${i}`, severity: 2 })
  }
  tags.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  return { schema: 'spm.tags/1', tags }
}
