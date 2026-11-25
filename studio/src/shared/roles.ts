/**
 * Step 32 · who may do what (per action, not per page — Improved design › N10 Roles).
 * A first, fixed table for the header; phase J (login, users file) moves the check into main
 * and adds the audit trail. A Stop is never locked: anyone at the HMI may stop the machine.
 */
export const ROLES = ['Viewer', 'Operator', 'Technician', 'Engineer'] as const
export type Role = (typeof ROLES)[number]

export type Action = 'start' | 'hold' | 'stop' | 'reset' | 'ack' | 'download' | 'mode:Auto' | 'mode:Manual' | 'mode:Maintenance'

const MAY: Record<Action, readonly Role[]> = {
  stop: ROLES,
  start: ['Operator', 'Technician', 'Engineer'],
  hold: ['Operator', 'Technician', 'Engineer'],
  reset: ['Operator', 'Technician', 'Engineer'],
  ack: ['Operator', 'Technician', 'Engineer'],
  download: ['Technician', 'Engineer'], // step 34: changes what the machine does — not an operator's job // step 33: acknowledging is an operator's job; a Viewer only looks
  'mode:Auto': ['Technician', 'Engineer'],
  'mode:Manual': ['Technician', 'Engineer'],
  'mode:Maintenance': ['Engineer']
}

export const may = (role: Role, action: Action): boolean => MAY[action].includes(role)
