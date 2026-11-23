/**
 * Tags ⇄ Excel / CSV files (step 22), in the main process (file access, and the big ExcelJS stays out of the screens).
 * The table format is shared/tag-table.ts: one row per tag, header = column names, 'more' = JSON for the rest.
 *   .xlsx: sheet 'tags', bold header, frozen first row, typed cells (numbers, TRUE / FALSE)
 *   .csv : UTF-8 with BOM (Excel shows umlauts and µ correctly), comma separated, header row
 */
import { readFile, writeFile } from 'node:fs/promises'
import { extname } from 'node:path'
import ExcelJS from 'exceljs'
import Papa from 'papaparse'
import type { Tag } from '@shared/ipc'
import { fromRows, TABLE_COLUMNS, toRows, type Cell, type FromRowsResult } from '@shared/tag-table'

export type ExchangeFormat = 'xlsx' | 'csv'

export function formatOf(file: string): ExchangeFormat | null {
  const e = extname(file).toLowerCase()
  return e === '.xlsx' ? 'xlsx' : e === '.csv' ? 'csv' : null
}

/** column widths in the sheet (characters) — readable without resizing */
const WIDTH: Partial<Record<(typeof TABLE_COLUMNS)[number], number>> = { name: 26, desc: 34, group: 26, more: 60, kind: 9, dtype: 9, scope: 9 }

export async function exportTags(file: string, tags: Tag[]): Promise<void> {
  const rows = toRows(tags)
  if (formatOf(file) === 'csv') {
    const csv = Papa.unparse({ fields: [...TABLE_COLUMNS], data: rows.map((r) => TABLE_COLUMNS.map((c) => r[c])) }, { newline: '\r\n' })
    await writeFile(file, '\uFEFF' + csv + '\r\n', 'utf8')
    return
  }
  const wb = new ExcelJS.Workbook()
  wb.creator = 'SPM Studio'
  const ws = wb.addWorksheet('tags', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = TABLE_COLUMNS.map((c) => ({ header: c, key: c, width: WIDTH[c] ?? 11 }))
  ws.getRow(1).font = { bold: true }
  for (const r of rows) ws.addRow(Object.fromEntries(TABLE_COLUMNS.map((c) => [c, r[c] ?? undefined])))
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: TABLE_COLUMNS.length } }
  await wb.xlsx.writeFile(file)
}

/** an Excel cell → a plain value (rich text, formulas with a result, hyperlinks → their text / result) */
function cellValue(v: ExcelJS.CellValue): Cell {
  if (v === null || v === undefined) return null
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((t) => t.text).join('')
    if ('result' in v) return cellValue(v.result as ExcelJS.CellValue)
    if ('text' in v) return String(v.text)
  }
  return String(v)
}

export async function importTags(file: string): Promise<FromRowsResult> {
  if (formatOf(file) === 'csv') {
    const text = (await readFile(file, 'utf8')).replace(/^\uFEFF/, '')
    // blank lines are KEPT (fromRows skips them) so 'row 5' in a message is line 5 of the file
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: false, transformHeader: (h) => h.trim() })
    const blank = (i: number | undefined): boolean => i !== undefined && Object.values(parsed.data[i] ?? {}).every((v) => !v?.trim())
    const csvErrors = parsed.errors.filter((e) => !(e.code === 'TooFewFields' && blank(e.row))).map((e) => `row ${(e.row ?? 0) + 2}: ${e.message}`)
    const res = fromRows(parsed.data)
    return { tags: res.tags, errors: [...csvErrors, ...res.errors] }
  }
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(file)
  const ws = wb.getWorksheet('tags') ?? wb.worksheets[0]
  if (!ws) return { tags: [], errors: ['the workbook has no sheet'] }
  const header: string[] = []
  ws.getRow(1).eachCell({ includeEmpty: true }, (c, i) => (header[i] = String(cellValue(c.value) ?? '').trim()))
  const rows: Record<string, Cell>[] = []
  ws.eachRow({ includeEmpty: true }, (row, n) => {
    if (n === 1) return
    const r: Record<string, Cell> = {}
    header.forEach((h, i) => h && (r[h] = cellValue(row.getCell(i).value)))
    rows.push(r)
  })
  return fromRows(rows)
}
