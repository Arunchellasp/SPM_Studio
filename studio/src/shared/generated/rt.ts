// GENERATED from schemas/rt.schema.json by tools/gen-types.mts — do not edit by hand.
// Change the schema, then run: npm run gen   (tools/gen-types.test.ts fails while this file is out of date)

export type Step = Start | End | WaitDi | SetDo | MoveAbs | Delay | If

/**
 * Made by the compiler (studio/src/shared/compile.ts, step 29; moved from main in step 34) from program.json + tags.json (Software implementation › 4d). Names are replaced by numbers: tags by their index in tags.json, nodes by step numbers 0, 1, 2 … in walking order from START. The runtime needs no parsing in its real-time loop.
 */
export interface RtFile {
  schema: 'spm.rt/1'
  /**
   * CRC-32 of the flows as written (the runtime checks the download)
   */
  crc: string
  /**
   * CRC-32 of tags.json as saved — tag ids are only valid with exactly that tag table
   */
  tags_crc: string
  flows: Flow[]
}
export interface Flow {
  name: string
  /**
   * flow number = index in flows
   */
  id: number
  station: string
  autostart: boolean
  steps: Step[]
}
/**
 * the flow begins here
 */
export interface Start {
  /**
   * step number = index in steps
   */
  i: number
  /**
   * editor node id (program.json) — the screens highlight the live step with it
   */
  src: string
  op: 'START'
  /**
   * index of the next step in this flow's steps
   */
  next: number
}
/**
 * the flow is finished
 */
export interface End {
  /**
   * step number = index in steps
   */
  i: number
  /**
   * editor node id (program.json) — the screens highlight the live step with it
   */
  src: string
  op: 'END'
}
/**
 * wait until the input has the value; after tmo ms raise the alarm (if any)
 */
export interface WaitDi {
  /**
   * step number = index in steps
   */
  i: number
  /**
   * editor node id (program.json) — the screens highlight the live step with it
   */
  src: string
  op: 'WAIT_DI'
  /**
   * tag id = index of the tag in tags.json
   */
  tag: number
  val: 0 | 1
  /**
   * ms; 0 = wait for ever
   */
  tmo: number
  /**
   * ALARM tag id raised on timeout
   */
  alarm?: number
  /**
   * index of the next step in this flow's steps
   */
  next: number
}
/**
 * set the output
 */
export interface SetDo {
  /**
   * step number = index in steps
   */
  i: number
  /**
   * editor node id (program.json) — the screens highlight the live step with it
   */
  src: string
  op: 'SET_DO'
  /**
   * tag id = index of the tag in tags.json
   */
  tag: number
  val: 0 | 1
  /**
   * index of the next step in this flow's steps
   */
  next: number
}
/**
 * move the axis to the point; done when in position
 */
export interface MoveAbs {
  /**
   * step number = index in steps
   */
  i: number
  /**
   * editor node id (program.json) — the screens highlight the live step with it
   */
  src: string
  op: 'MOVE_ABS'
  /**
   * tag id = index of the tag in tags.json
   */
  axis: number
  /**
   * tag id = index of the tag in tags.json
   */
  point: number
  /**
   * % of the axis speed
   */
  spd: number
  /**
   * index of the next step in this flow's steps
   */
  next: number
}
/**
 * wait ms
 */
export interface Delay {
  /**
   * step number = index in steps
   */
  i: number
  /**
   * editor node id (program.json) — the screens highlight the live step with it
   */
  src: string
  op: 'DELAY'
  ms: number
  /**
   * index of the next step in this flow's steps
   */
  next: number
}
/**
 * decide in one cycle: evaluate the RPN, then go to yes or no
 */
export interface If {
  /**
   * step number = index in steps
   */
  i: number
  /**
   * editor node id (program.json) — the screens highlight the live step with it
   */
  src: string
  op: 'IF'
  /**
   * the condition in reverse Polish notation (step 30): T:<tag id> pushes the tag's value, K:<constant> a constant, an operator takes its operands from the stack; the result is TRUE / FALSE
   *
   * @minItems 1
   */
  rpn: [string, ...string[]]
  /**
   * index of the next step in this flow's steps
   */
  yes: number
  /**
   * index of the next step in this flow's steps
   */
  no: number
}
