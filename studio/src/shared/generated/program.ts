// GENERATED from schemas/program.schema.json by tools/gen-types.mts — do not edit by hand.
// Change the schema, then run: npm run gen   (tools/gen-types.test.ts fails while this file is out of date)

/**
 * [from node id, to node id] or, out of a Decision, [from, to, 'yes' | 'no'] (the way out is checked when the editor reads the file)
 *
 * @minItems 2
 * @maxItems 3
 */
export type Edge = [string, string] | [string, string, string]

/**
 * The flowcharts of a project as the studio draws them (Software implementation › 4c): flows per station, their nodes with position and parameters, and the links. Tags are used by NAME. The compiler (step 29) turns this into program.rt.json for the runtime. Flow rules (one Start, links, tags exist …) are checked by flow.rules.ts, not by this schema.
 */
export interface ProgramFile {
  /**
   * file format and version
   */
  schema: 'spm.program/1'
  flows: Flow[]
}
export interface Flow {
  /**
   * unique in the project, e.g. S1_Main
   */
  name: string
  /**
   * the station it belongs to (a tag scope, e.g. S1)
   */
  station: string
  /**
   * started by the runtime when the machine goes to Auto
   */
  autostart?: boolean
  nodes: Node[]
  edges: Edge[]
}
export interface Node {
  /**
   * unique in its flow; the compiler keeps it as 'src' so the screens can show the live step
   */
  id: string
  /**
   * node type = op of the step table in lower case (Software implementation › 4a); more types join with their steps
   */
  type: 'start' | 'end' | 'move_abs' | 'wait_di' | 'set_do' | 'delay' | 'if'
  /**
   * [x, y] on the canvas, in canvas pixels
   *
   * @minItems 2
   * @maxItems 2
   */
  pos: [number, number]
  /**
   * parameters of the type (e.g. wait_di: tag, value, timeout_ms, alarm) — checked by the editor and the compiler
   */
  p?: {
    [k: string]: unknown
  }
  /**
   * optional step name shown instead of the type title
   */
  name?: string
  comment?: string
}
