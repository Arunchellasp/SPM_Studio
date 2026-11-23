// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { useFeedback } from './feedback.store'
import { useProject } from './project.store'

beforeEach(() => {
  useProject.setState({ project: null, busy: false, dirty: false })
  useFeedback.setState({ toasts: [] })
})
const lastToast = (): { text: string; kind: string } | undefined => useFeedback.getState().toasts.at(-1)

describe('project store (screens, browser stand-in)', () => {
  it('U-16.12 save without a project only tells how to open one', async () => {
    await useProject.getState().save()
    expect(lastToast()).toMatchObject({ text: 'No project open — File › Open project… (Ctrl+O)', kind: 'info' })
  })

  it('U-16.13 open loads the demo project and says so', async () => {
    await useProject.getState().open()
    const p = useProject.getState().project
    expect(p?.name).toBe('demo')
    expect(p?.tags.tags).toHaveLength(20)
    expect(lastToast()).toMatchObject({ text: 'Opened demo · 20 tags', kind: 'done' })
    expect(useProject.getState().busy).toBe(false)
  })

  it('U-16.14 save right after open: no changes; after an edit: saved', async () => {
    await useProject.getState().open()
    await useProject.getState().save()
    expect(lastToast()).toMatchObject({ text: 'No changes — tags.json is already up to date', kind: 'info' })
    const p = useProject.getState().project!
    useProject.setState({ project: { ...p, tags: { ...p.tags, tags: p.tags.tags.map((t) => (t.name === 'R_S1_Step' ? { ...t, desc: 'edited' } : t)) } } })
    await useProject.getState().save()
    expect(lastToast()).toMatchObject({ text: 'Saved (browser) projects/demo/tags.json', kind: 'done' })
  })

  it('U-16.15 a refused save shows the reason as an error toast (stand-in: wrong file version)', async () => {
    await useProject.getState().open()
    const p = useProject.getState().project!
    useProject.setState({ project: { ...p, tags: { ...p.tags, schema: 'spm.tags/2' as 'spm.tags/1' } } })
    await useProject.getState().save()
    expect(lastToast()).toMatchObject({ text: 'Not saved: schema: must be "spm.tags/1"', kind: 'error' })
  })
})

describe('project store editing (step 19)', () => {
  it('U-19.7 an edit updates the store and marks it unsaved; Save clears the mark', async () => {
    await useProject.getState().open()
    expect(useProject.getState().dirty).toBe(false)
    const r = useProject.getState().edit('R_S1_Step', 'comment', 'edited in the grid')
    expect(r.ok).toBe(true)
    expect(useProject.getState().project!.tags.tags.find((t) => t.name === 'R_S1_Step')!.desc).toBe('edited in the grid')
    expect(useProject.getState().dirty).toBe(true)
    await useProject.getState().save()
    expect(useProject.getState().dirty).toBe(false)
    expect(lastToast()?.text).toMatch(/^Saved /)
  })

  it('U-19.8 a refused edit changes nothing and says why', async () => {
    await useProject.getState().open()
    const before = useProject.getState().project
    const r = useProject.getState().edit('R_PartCount', 'init', 'abc')
    expect(r.ok).toBe(false)
    expect(useProject.getState().project).toBe(before)
    expect(useProject.getState().dirty).toBe(false)
    expect(lastToast()).toMatchObject({ text: "Not changed: 'abc' is not a whole number (DINT)", kind: 'error' })
  })

  it('U-19.9 Open with unsaved changes asks first; Cancel keeps the edits', async () => {
    await useProject.getState().open()
    useProject.getState().edit('R_S1_Step', 'comment', 'not saved yet')
    const pending = useProject.getState().open()
    const dlg = useFeedback.getState().dialog
    expect(dlg?.title).toBe('Discard unsaved changes?')
    useFeedback.getState().closeDialog(false)
    await pending
    expect(useProject.getState().dirty).toBe(true)
    expect(useProject.getState().project!.tags.tags.find((t) => t.name === 'R_S1_Step')!.desc).toBe('not saved yet')
  })
})

describe('project store — rules (step 20)', () => {
  it('U-20.13 Save is blocked while a rule fails, and works again after the fix', async () => {
    await useProject.getState().open()
    useProject.getState().setAddress('DI_S1_ClampOpen', { bus: 'ecat', slave: 3, ch: 0 }) // = DI_S1_PartPresent
    await useProject.getState().save()
    expect(lastToast()).toMatchObject({ text: 'Not saved: 2 problems — DI_S1_ClampOpen: address ecat 3:0 is also used by DI_S1_PartPresent', kind: 'error' })
    expect(useProject.getState().dirty).toBe(true)
    useProject.getState().setAddress('DI_S1_ClampOpen', { bus: 'ecat', slave: 3, ch: 1 })
    await useProject.getState().save()
    expect(lastToast()?.text).toMatch(/^(Saved |No changes)/)
    expect(useProject.getState().dirty).toBe(false)
  })
})
