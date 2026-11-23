import { useState } from 'react'
import type { Addr, Tag } from '@shared/ipc'
import { Button } from '../../components/button.view'
import { Field } from '../../components/field.view'
import { Modal } from '../../components/modal.view'
import { Select } from '../../components/select.view'

const BUSES = [
  { value: 'ecat', label: 'ecat — EtherCAT' },
  { value: 'sim', label: 'sim — simulated card' }
]

/**
 * Address picker (Software implementation › 3c: bus → slave → channel). Step 19: typed numbers;
 * when N04 I/O exists, bus / slave / channel come from its card tree as lists.
 * OK hands the address to the store, which checks it (tag-edit.ts › applyAddress).
 */
export function AddressDialog({ tag, onOk, onClose }: { tag: Tag; onOk: (a: Addr) => boolean; onClose: () => void }): React.JSX.Element {
  const isAxis = tag.kind === 'AXIS'
  const [bus, setBus] = useState<string>(tag.addr?.bus ?? 'ecat')
  const [slave, setSlave] = useState(String(tag.addr?.slave ?? 0))
  const [ch, setCh] = useState(String(tag.addr?.ch ?? 0))

  const whole = (s: string): number => (/^\d+$/.test(s.trim()) ? Number(s) : NaN)
  const ok = (): void => {
    const a: Addr = isAxis ? { bus: bus as Addr['bus'], slave: whole(slave) } : { bus: bus as Addr['bus'], slave: whole(slave), ch: whole(ch) }
    if (onOk(a)) onClose()
  }

  return (
    <Modal
      title={`Address · ${tag.name}`}
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
        className="addr-form"
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || (e.target as HTMLElement).tagName !== 'INPUT') return
          // the Enter is used up here: without this, focus returns to 'Change address…' and the same Enter clicks it again
          e.preventDefault()
          ok()
        }}
      >
        <Select label="Bus" options={BUSES} value={bus} onChange={(e) => setBus(e.target.value)} block />
        <Field label={isAxis ? 'Slave (drive)' : 'Slave'} hint="0 … 511" inputMode="numeric" value={slave} onChange={(e) => setSlave(e.target.value)} block />
        {!isAxis && <Field label="Channel" hint="0 … 255" inputMode="numeric" value={ch} onChange={(e) => setCh(e.target.value)} block />}
      </div>
    </Modal>
  )
}
