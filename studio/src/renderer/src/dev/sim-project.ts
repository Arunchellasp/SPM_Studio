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
        const text = formatTagFile(tags)
        const changed = text !== disk
        disk = text
        return { ok: true, changed, file: `(browser) projects/${name}/tags.json` }
      }
    },
    // no menu bar in a browser
    onMenu: (_cb: (cmd: MenuCommand) => void) => () => {}
  }
}
