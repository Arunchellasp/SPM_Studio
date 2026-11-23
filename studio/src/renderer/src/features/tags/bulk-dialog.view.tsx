import { useState } from 'react'
import type { Addr, Tag } from '@shared/ipc'
import { Button } from '../../components/button.view'
import { Field } from '../../components/field.view'
import { Modal } from '../../components/modal.view'
import { Select } from '../../components/select.view'
import { Tabs } from '../../components/tabs.view'
import { freeSlaveOffset, generatedNames, GENERATE_KINDS, renamed, stationTags, type CopySpec, type GenerateSpec } from './tag-bulk'
import { KIND_LABEL } from './tags'

const whole = (s: string): number => (/^\d+$/.test(s.trim()) ? Number(s) : NaN)

/**
 * Bulk tools (step 22): Generate I/O (one tag per channel of a card) and Copy station (S1 → S2).
 * Each tab shows what it will create before OK. One OK = one change (one undo step).
 */
export function BulkDialog({
  tags,
  onGenerate,
  onCopy,
  onClose
}: {
  tags: Tag[]
  onGenerate: (s: GenerateSpec) => boolean
  onCopy: (s: CopySpec) => boolean
  onClose: () => void
}): React.JSX.Element {
  const [tab, setTab] = useState('generate')
  // generate
  const [kind, setKind] = useState<GenerateSpec['kind']>('DI')
  const [station, setStation] = useState('S1')
  const [count, setCount] = useState('32')
  const [bus, setBus] = useState<Addr['bus']>('ecat')
  const [slave, setSlave] = useState('')
  const [firstCh, setFirstCh] = useState('0')
  // copy
  const stations = [...new Set(tags.map((t) => t.scope).filter((s): s is string => !!s && /^S\d{1,2}$/.test(s)))].sort()
  const [from, setFrom] = useState(stations[0] ?? 'S1')
  const [to, setTo] = useState('')
  const [offset, setOffset] = useState(String(freeSlaveOffset(tags, stations[0] ?? 'S1')))

  const names = generatedNames({ kind, station, count: Math.min(whole(count) || 0, 256), firstCh: whole(firstCh) || 0 })
  const genPreview = names.length ? `${names[0]} … ${names.at(-1)} on ${bus} ${slave || '?'}:${firstCh}…${(whole(firstCh) || 0) + names.length - 1}` : '–'
  const src = stationTags(tags, from)
  const copyPreview = src.length && to.trim() ? `${src.length} tags: ${src[0]!.name} → ${renamed(src[0]!.name, from, to.trim())} …` : `${src.length} tags in ${from}`

  const ok = (): void => {
    const done =
      tab === 'generate'
        ? onGenerate({ kind, station, count: whole(count), bus, slave: whole(slave), firstCh: whole(firstCh) })
        : onCopy({ from, to, slaveOffset: whole(offset) })
    if (done) onClose()
  }

  return (
    <Modal
      wide
      title="Bulk tools"
      onClose={onClose}
      actions={
        <>
          <Button size="xl" onClick={onClose}>
            Cancel
          </Button>
          <Button size="xl" variant="primary" onClick={ok}>
            {tab === 'generate' ? 'Generate' : 'Copy'}
          </Button>
        </>
      }
    >
      <Tabs
        label="Bulk tool"
        value={tab}
        onChange={setTab}
        tabs={[
          {
            id: 'generate',
            label: 'Generate I/O',
            content: (
              <div className="addr-form bulk-form">
                <Select
                  label="Kind"
                  options={GENERATE_KINDS.map((k) => ({ value: k, label: `${k} · ${KIND_LABEL[k] ?? k}` }))}
                  value={kind}
                  onChange={(e) => setKind(e.target.value as GenerateSpec['kind'])}
                  block
                />
                <Field label="Station (scope)" hint="S1 … S99, empty = global" value={station} onChange={(e) => setStation(e.target.value)} block />
                <Field label="Count" hint="channels of the card, 1 … 256" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} block />
                <Select
                  label="Bus"
                  options={[
                    { value: 'ecat', label: 'ecat — EtherCAT' },
                    { value: 'sim', label: 'sim — simulated card' }
                  ]}
                  value={bus}
                  onChange={(e) => setBus(e.target.value as Addr['bus'])}
                  block
                />
                <Field label="Slave" hint="the card's slave number" inputMode="numeric" value={slave} onChange={(e) => setSlave(e.target.value)} block />
                <Field label="First channel" inputMode="numeric" value={firstCh} onChange={(e) => setFirstCh(e.target.value)} block />
                <p className="bulk-preview" data-testid="bulk-preview">
                  {genPreview}
                </p>
              </div>
            )
          },
          {
            id: 'copy',
            label: 'Copy station',
            content: (
              <div className="addr-form bulk-form">
                <Select
                  label="From station"
                  options={stations.map((s) => ({ value: s, label: `${s} (${stationTags(tags, s).length} tags)` }))}
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value)
                    setOffset(String(freeSlaveOffset(tags, e.target.value)))
                  }}
                  block
                />
                <Field label="To station" hint="a new, empty station, e.g. S3" value={to} onChange={(e) => setTo(e.target.value)} block />
                <Field
                  label="Slave offset"
                  hint="added to every slave number; the suggestion puts the copy on unused cards"
                  inputMode="numeric"
                  value={offset}
                  onChange={(e) => setOffset(e.target.value)}
                  block
                />
                <p className="bulk-preview" data-testid="copy-preview">
                  {copyPreview}
                </p>
              </div>
            )
          }
        ]}
      />
    </Modal>
  )
}
