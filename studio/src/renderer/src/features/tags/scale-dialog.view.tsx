import { useState } from 'react'
import type { Tag } from '@shared/ipc'
import { Button } from '../../components/button.view'
import { Field } from '../../components/field.view'
import { Modal } from '../../components/modal.view'

type Scale = { raw: [number, number]; eng: [number, number] }

/**
 * Scaling of an analog channel (step 20): raw counts of the card → engineering value.
 * Whether the ranges make sense (raw must rise, eng not empty) is a rule: a bad range is kept and shown red.
 */
export function ScaleDialog({ tag, onOk, onClose }: { tag: Tag; onOk: (s: Scale) => boolean; onClose: () => void }): React.JSX.Element {
  const s = tag.scale ?? { raw: [0, 32767], eng: [0, 100] }
  const [v, setV] = useState([s.raw[0], s.raw[1], s.eng[0], s.eng[1]].map(String))
  const num = (x: string): number => (x.trim() === '' ? NaN : Number(x.replace(',', '.')))
  const ok = (): void => {
    if (onOk({ raw: [num(v[0]!), num(v[1]!)], eng: [num(v[2]!), num(v[3]!)] })) onClose()
  }
  const field = (i: number, label: string, unit?: string): React.JSX.Element => (
    <Field label={label} unit={unit} inputMode="decimal" value={v[i]} onChange={(e) => setV((o) => o.map((x, j) => (j === i ? e.target.value : x)))} block />
  )
  return (
    <Modal
      title={`Scaling · ${tag.name}`}
      onClose={onClose}
      actions={
        <>
          <Button size="xl" onClick={onClose}>
            Cancel
          </Button>
          <Button size="xl" variant="primary" onClick={ok}>
            OK
          </Button>
        </>
      }
    >
      <div
        className="addr-form scale-form"
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || (e.target as HTMLElement).tagName !== 'INPUT') return
          e.preventDefault() // same lesson as the address picker (step 19)
          ok()
        }}
      >
        {field(0, 'Raw low (card counts)')}
        {field(1, 'Raw high')}
        {field(2, 'Engineering low', tag.unit)}
        {field(3, 'Engineering high', tag.unit)}
      </div>
    </Modal>
  )
}
