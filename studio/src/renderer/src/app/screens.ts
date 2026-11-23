/**
 * Screen registry: the 10 task areas of the navigation rail (N01–N10),
 * plus N00 Components, a developer-only screen.
 * One entry = one rail button + one screen. Adding a screen is one new line here.
 */
import type { ComponentType } from 'react'
import type { IconName } from '../components/icon.view'
import { ComponentsScreen } from '../features/components/components-screen.view'
import { AdminScreen } from '../features/admin/admin-screen.view'
import { OverviewScreen } from '../features/overview/overview-screen.view'
import { TagsScreen } from '../features/tags/tags-screen.view'

export interface ScreenDef {
  id: string
  code: string // N01 … N10, same codes as the mind map
  icon: IconName // rail icon: a name from components/icon.view.tsx (SVG since step 7)
  label: string // rail label
  title: string // breadcrumb shown in the content area
  purpose: string // one line: what the screen is for
  view?: ComponentType<{ screen: ScreenDef }> // screen component; empty placeholder when not set
  devOnly?: boolean // shown only in development builds (npm run dev)
}

export const ALL_SCREENS: ScreenDef[] = [
  {
    id: 'operate',
    code: 'N01',
    icon: 'operate',
    label: 'Operate',
    title: 'Operate › Overview',
    purpose: 'State, why not running, what next',
    view: OverviewScreen
  },
  {
    id: 'program',
    code: 'N02',
    icon: 'program',
    label: 'Program',
    title: 'Program › Sequence editor',
    purpose: 'Tree · canvas with live values · properties'
  },
  {
    id: 'tags',
    code: 'N03',
    icon: 'tags',
    label: 'Tags',
    title: 'Tags › Tag database',
    purpose: 'One typed, named table for every tag',
    view: TagsScreen
  },
  { id: 'io', code: 'N04', icon: 'io', label: 'I/O', title: 'I/O › Cards, mapping, diagnostics', purpose: 'Simulate / force per channel' },
  {
    id: 'motion',
    code: 'N05',
    icon: 'motion',
    label: 'Motion',
    title: 'Motion › Axes, jog, teach',
    purpose: 'Axes, jog and point teaching in one place'
  },
  {
    id: 'recipes',
    code: 'N06',
    icon: 'recipes',
    label: 'Recipes',
    title: 'Recipes › Parameter sets',
    purpose: 'Versioned sets with compare and approval'
  },
  {
    id: 'alarms',
    code: 'N07',
    icon: 'alarms',
    label: 'Alarms',
    title: 'Alarms › Active and history',
    purpose: 'Priority, state, first-out, shelving'
  },
  {
    id: 'trace',
    code: 'N08',
    icon: 'trace',
    label: 'Trace',
    title: 'Trace › Scope',
    purpose: 'Record signals and step changes with a trigger'
  },
  { id: 'data', code: 'N09', icon: 'data', label: 'Data', title: 'Data › Production and OEE', purpose: 'Production, OEE and traceability' },
  {
    id: 'admin',
    code: 'N10',
    icon: 'admin',
    label: 'Admin',
    title: 'Admin › Roles and audit',
    purpose: 'Permissions per action and audit trail',
    view: AdminScreen
  },
  {
    id: 'components',
    code: 'N00',
    icon: 'components',
    label: 'N00 Dev',
    title: 'Components › Shared building blocks',
    purpose: 'Every shared component in all its variants (development builds only)',
    view: ComponentsScreen,
    devOnly: true
  }
]

/** Screens shown in this build: developer screens are left out of the installed app. */
export const SCREENS: ScreenDef[] = ALL_SCREENS.filter((s) => !s.devOnly || import.meta.env.DEV)
