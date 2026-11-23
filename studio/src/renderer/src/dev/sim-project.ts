/**
 * Browser stand-in for window.spm.project (screens running without Electron: web preview, Playwright).
 * 'Open' gives the demo project (projects/demo/tags.json) without a dialog; 'Save' keeps the file in
 * memory with the same formatting as the main process, so 'changed' means the same thing.
 *
 * No Ajv here: Ajv builds its checker with new Function(), which the screens' Content-Security-Policy
 * (script-src 'self', no 'unsafe-eval') blocks — on purpose. The full schema check runs in the main
 * process (project/store.ts); this stand-in only checks the file version. tools/csp-guard.test.ts keeps it so.
 */
import demoTags from '../../../../../projects/demo/tags.json'
import type { MenuCommand, StudioApi, TagFile } from '@shared/ipc'
import { formatTagFile } from '@shared/tags-file'
import { makeBigProject } from '@shared/big-project'
import { checkTags, issueText } from '@shared/tags-rules'

export function makeSimProject(): Pick<StudioApi, 'project' | 'onMenu'> {
  // ?project=big in the address → a 1000-tag project (N03 speed test, step 18)
  const big = typeof location !== 'undefined' && new URLSearchParams(location.search).get('project') === 'big'
  const name = big ? 'big-1000' : 'demo'
  let disk = formatTagFile(big ? makeBigProject() : (demoTags as TagFile))
  return {
    project: {
      open: async () => ({ ok: true, project: { name, dir: `(browser) projects/${name}`, tags: JSON.parse(disk) as TagFile } }),
      save: async (tags) => {
        if (tags.schema !== 'spm.tags/1') return { ok: false, errors: ['schema: must be "spm.tags/1"'] }
        const issues = checkTags(tags.tags) // same last gate as main (step 20)
        if (issues.length) return { ok: false, errors: issues.map(issueText) }
        const text = formatTagFile(tags)
        const changed = text !== disk
        disk = text
        return { ok: true, changed, file: `(browser) projects/${name}/tags.json` }
      },
      // step 22: no files in a browser — export only says where it would go; import returns a fixed
      // 'edited in Excel' sheet: one tag changed, two new, one bad row (for the import preview tests)
      exportTags: async () => ({ ok: true, file: `(browser) projects/${name}/${name}-tags.xlsx` }),
      importTags: async () => {
        const sheet = (JSON.parse(disk) as TagFile).tags.map((t) => (t.name === 'R_S1_Step' ? { ...t, desc: 'Edited in Excel' } : t))
        sheet.push({ name: 'R_Excel_1', kind: 'REG', dtype: 'INT', scope: 'S1', init: 1 }, { name: 'R_Excel_2', kind: 'REG', dtype: 'BOOL', scope: 'S1', init: false })
        return { ok: true, file: '(browser) tags-edited.xlsx', tags: sheet, errors: ["row 24 (R_Bad): column 'more' is not valid JSON"] }
      }
    },
    // no menu bar in a browser
    onMenu: (_cb: (cmd: MenuCommand) => void) => () => {}
  }
}
