// Step 22 — Excel / CSV round trip loses nothing (roadmap: 'Excel round trip equal').
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import demo from '../../../../projects/demo/tags.json'
import type { TagFile } from '@shared/ipc'
import { makeBigProject } from '@shared/big-project'
import { exportTags, importTags } from './exchange'

let dir = ''
beforeEach(async () => (dir = await mkdtemp(join(tmpdir(), 'spm-xchg-'))))
afterEach(async () => rm(dir, { recursive: true, force: true }))
const tags = (demo as TagFile).tags

describe('Excel / CSV exchange', () => {
  it.each(['xlsx', 'csv'])('U-22.1 demo → .%s → tags: equal, no errors', async (ext) => {
    const f = join(dir, `tags.${ext}`)
    await exportTags(f, tags)
    const r = await importTags(f)
    expect(r.errors).toEqual([])
    expect(r.tags).toEqual(tags)
  })

  it.each(['xlsx', 'csv'])('U-22.2 1000 tags → .%s → tags: equal', async (ext) => {
    const big = makeBigProject().tags
    const f = join(dir, `big.${ext}`)
    await exportTags(f, big)
    expect((await importTags(f)).tags).toEqual(big)
  }, 20_000)

  it('U-22.3 the sheet is readable: sheet "tags", header row, typed cells, frozen header', async () => {
    const f = join(dir, 'tags.xlsx')
    await exportTags(f, tags)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(f)
    const ws = wb.getWorksheet('tags')!
    expect(ws.getRow(1).values).toEqual([undefined, 'name', 'kind', 'dtype', 'scope', 'bus', 'slave', 'ch', 'unit', 'init', 'min', 'max', 'retain', 'desc', 'group', 'more'])
    const r = ws.getRow(2) // AI_Sealer_Temp (sorted file order)
    expect(r.getCell(1).value).toBe('AI_Sealer_Temp')
    expect(r.getCell(6).value).toBe(5) // slave as a number, not '5'
    expect(JSON.parse(String(r.getCell(15).value))).toMatchObject({ scale: { raw: [0, 32767], eng: [0, 400] }, alarm: { code: 410 } })
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 })
  })

  it('U-22.4 a CSV edited by hand: semicolon-free, BOM, TRUE / 1, decimal comma, blank lines, bad rows reported', async () => {
    const f = join(dir, 'hand.csv')
    await writeFile(
      f,
      '\uFEFFname,kind,dtype,scope,bus,slave,ch,unit,init,min,max,retain,desc,group,more\r\n' +
        'R_Speed,REG,REAL,S1,,,,mm/s,"2,5",0,10,1,Speed,,\r\n' +
        '\r\n' +
        'DI_X,DI,BOOL,S1,ecat,three,0,,,,,,,,\r\n' +
        ',REG,INT,,,,,,,,,,,,\r\n' +
        'R_Bad,REG,INT,,,,,,,,,,,,{oops\r\n'
    )
    const r = await importTags(f)
    expect(r.tags).toEqual([{ name: 'R_Speed', kind: 'REG', dtype: 'REAL', scope: 'S1', unit: 'mm/s', init: 2.5, min: 0, max: 10, retain: true, desc: 'Speed' }])
    expect(r.errors).toEqual([
      'row 4 (DI_X): slave must be a number',
      'row 5: name and kind are needed',
      "row 6 (R_Bad): column 'more' is not valid JSON"
    ])
  })

  it('U-22.5 the CSV starts with a BOM and uses CRLF (Excel on Windows opens it right)', async () => {
    const f = join(dir, 'tags.csv')
    await exportTags(f, tags)
    const text = await readFile(f, 'utf8')
    expect(text.charCodeAt(0)).toBe(0xfeff)
    expect(text.split('\r\n')[0]).toBe('\uFEFFname,kind,dtype,scope,bus,slave,ch,unit,init,min,max,retain,desc,group,more')
  })
})
