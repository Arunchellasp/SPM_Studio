// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { useFeedback } from './feedback.store'
import { useProject } from './project.store'

beforeEach(() => {
  useProject.setState({ project: null, busy: false })
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
