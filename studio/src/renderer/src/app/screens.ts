/** Screen registry (N01–N10 from the 'Improved design' page). Adding a screen = one entry here. */
import type { ComponentType } from 'react'
import { Overview } from '../features/overview/overview.view'
import { Placeholder } from '../features/placeholder/placeholder.view'

export interface ScreenDef {
  id: string
  code: string
  title: string
  group: 'Operate' | 'Engineer' | 'Data' | 'System'
  phase: string
  component: ComponentType<{ screen: ScreenDef }>
}

export const SCREENS: ScreenDef[] = [
  { id: 'overview', code: 'N01', title: 'Overview', group: 'Operate', phase: 'P3 / P10', component: Overview },
  { id: 'sequence', code: 'N02', title: 'Sequence editor', group: 'Engineer', phase: 'P6', component: Placeholder },
  { id: 'tags', code: 'N03', title: 'Tag database', group: 'Engineer', phase: 'P5', component: Placeholder },
  { id: 'io', code: 'N04', title: 'I/O', group: 'Engineer', phase: 'P10', component: Placeholder },
  { id: 'motion', code: 'N05', title: 'Motion', group: 'Operate', phase: 'P10', component: Placeholder },
  { id: 'recipes', code: 'N06', title: 'Recipes', group: 'Operate', phase: 'P10', component: Placeholder },
  { id: 'alarms', code: 'N07', title: 'Alarms', group: 'Operate', phase: 'P10', component: Placeholder },
  { id: 'trace', code: 'N08', title: 'Trace', group: 'Data', phase: 'P10', component: Placeholder },
  { id: 'data', code: 'N09', title: 'Data & dashboards', group: 'Data', phase: 'P11', component: Placeholder },
  { id: 'admin', code: 'N10', title: 'Admin', group: 'System', phase: 'P12', component: Placeholder }
]
