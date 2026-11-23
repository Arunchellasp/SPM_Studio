// GENERATED from schemas/tags.schema.json by tools/gen-types.mts — do not edit by hand.
// Change the schema, then run: npm run gen   (tools/gen-types.test.ts fails while this file is out of date)

export type Tag = {
  /**
   * unique; A–Z a–z 0–9 _; starts with the kind prefix (DI_, AX_ …)
   */
  name: string
  kind: 'DI' | 'DO' | 'AI' | 'AO' | 'AXIS' | 'POINT' | 'REG' | 'TIMER' | 'COUNTER' | 'ALARM' | 'RECIPE' | 'UDT'
  dtype?: 'BOOL' | 'INT' | 'DINT' | 'REAL' | 'STRING' | 'STRUCT'
  /**
   * global · station S1… · flow:<name> · fn:<name>; default global
   */
  scope?: string
  addr?: Addr
  init?: number | boolean | string
  /**
   * keep the value after power off
   */
  retain?: boolean
  min?: number
  max?: number
  unit?: string
  scale?: {
    raw: Pair
    eng: Pair
  }
  debounce_ms?: number
  invert?: boolean
  filter_ms?: number
  /**
   * output value on STOP / alarm / comm loss
   */
  safe_state?: boolean | number
  pulse_ms?: number
  alarm?: {
    hi?: number
    hihi?: number
    lo?: number
    lolo?: number
    code?: number
  }
  log?:
    | ('none' | 'change')
    | {
        period_ms: number
      }
  access?: {
    read?: Role
    write?: Role
  }
  desc?: string
  group?: string
  /**
   * pulses per unit
   */
  ppu?: number
  vmax?: number
  acc?: number
  soft_min?: number
  soft_max?: number
  home?: 'neg_limit' | 'pos_limit' | 'index' | 'none'
  /**
   * @minItems 1
   */
  axes?: [string, ...string[]]
  /**
   * @minItems 1
   */
  values?: [number, ...number[]]
  teach?: boolean
  preset_ms?: number
  preset?: number
  code?: number
  text?: string
  /**
   * alarm priority P1 … P4
   */
  severity?: number
  latch?: boolean
  reaction?: 'stop' | 'pause' | 'warn'
  default?: number | boolean | string
  /**
   * UDT type name, e.g. Cylinder
   */
  type?: string
  /**
   * UDT member → tag name
   */
  fields?: {
    [k: string]: string
  }
}
/**
 * @minItems 2
 * @maxItems 2
 */
export type Pair = [number, number]
export type Role = 'operator' | 'engineer' | 'admin'

/**
 * One table for every kind of tag (Software implementation › 3). Flowcharts, screens, alarms and logs use tag NAMES; the address lives only here. Cross-row rules (unique names, address used twice, min < max) are checked by tags.rules.ts, not by this schema.
 */
export interface TagFile {
  /**
   * file format and version; the runtime refuses other versions
   */
  schema: 'spm.tags/1'
  tags: Tag[]
}
/**
 * where the value lives on the field bus (I/O and axes only)
 */
export interface Addr {
  /**
   * ecat = EtherCAT, sim = simulated card
   */
  bus: 'ecat' | 'sim'
  slave: number
  ch?: number
}
