import type { SVGProps } from 'react'
import {
  Activity,
  ArrowLeftRight,
  ChartColumn,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Component,
  Copy,
  FolderOpen,
  Gauge,
  Hourglass,
  Hash,
  House,
  Info,
  Move,
  Pause,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Settings,
  Square,
  Timer,
  ToggleRight,
  Trash2,
  TriangleAlert,
  Undo2,
  Workflow,
  X,
  type LucideIcon
} from 'lucide-react'
import './icon.css'

/**
 * ⓕ "forced" marker of the design as an SVG in the same line style as lucide:
 * a circle with an f drawn as lines (no font needed, so it can never become a box).
 */
const Forced = ((props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M14.5 7.5h-1A2.5 2.5 0 0 0 11 10v7.5" />
    <path d="M8.5 12h5" />
  </svg>
)) as unknown as LucideIcon

/**
 * The one list of icons the app may use. Screens and buttons refer to icons BY NAME,
 * so changing a picture is one line here, and a typo is a TypeScript error.
 * Icons: lucide (ISC licence), tree-shaken — only these end up in the build.
 */
export const ICONS = {
  // rail (N01–N10, N00) — meaning kept from the design's placeholder glyphs
  operate: Gauge, // ▣
  program: Workflow, // ⧉
  tags: Hash, // #
  io: ArrowLeftRight, // ⇄
  motion: Move, // ↔
  recipes: ClipboardList, // ☰
  alarms: TriangleAlert, // ⚠
  trace: Activity, // ∿
  data: ChartColumn, // ▤
  admin: Settings, // ⚙
  components: Component, // ◧
  // machine commands in the header
  start: Play, // ▶
  hold: Pause, // ❚❚
  stop: Square, // ■
  reset: RotateCcw, // ↺
  // general
  plus: Plus,
  home: House,
  next: ChevronRight,
  caret: ChevronDown, // ▾ in selects
  forced: Forced, // ⓕ
  // dialog and toasts (step 8)
  close: X, // ✕
  info: Info,
  done: CircleCheck,
  error: CircleAlert,
  // project files (step 16)
  open: FolderOpen,
  save: Save,
  // add / delete / undo (step 21)
  undo: Undo2,
  redo: Redo2,
  copy: Copy,
  trash: Trash2,
  // N02 node types (step 24)
  wait: Hourglass,
  output: ToggleRight,
  delay: Timer
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof ICONS

export interface IconProps {
  name: IconName
  /** text for screen readers; without it the icon is decoration (aria-hidden) */
  label?: string
  className?: string
}

/**
 * Icon: 1em × 1em, so it takes the font size of where it sits (rail 24 px, buttons 13–16 px)
 * and the text colour (currentColor). Sizes stay in CSS / tokens, not in the code.
 */
export function Icon({ name, label, className = '' }: IconProps): React.JSX.Element {
  const Svg = ICONS[name]
  return (
    <Svg
      className={['icon', className].filter(Boolean).join(' ')}
      width="1em"
      height="1em"
      strokeWidth={2}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable="false"
    />
  )
}
