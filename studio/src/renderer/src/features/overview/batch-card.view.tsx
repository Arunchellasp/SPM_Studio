import { Fragment } from 'react'
import type { Batch } from '../../model/overview'
import { Card } from '../../components/card.view'
import { batchKpis, nextText, progressPct } from './batch'
import './overview.css'

/**
 * N01 top card (Improved design › N01): batch title, progress bar, KPI line.
 * Only draws what it gets — the values come from fixtures/demo.ts (later the runtime).
 */
export function BatchCard({ batch }: { batch: Batch }): React.JSX.Element {
  const pct = progressPct(batch.partsDone, batch.partsTarget)
  const kpis = batchKpis(batch)
  return (
    <Card padding="none" className="batch-card" aria-label={`Batch ${batch.id}`}>
      <div className="batch-title">
        <b>Batch</b> {batch.id} · {batch.product} · {batch.partsDone} / {batch.partsTarget} parts
      </div>
      <div
        className="batch-bar"
        role="progressbar"
        aria-label="Batch progress"
        aria-valuemin={0}
        aria-valuemax={batch.partsTarget}
        aria-valuenow={batch.partsDone}
        aria-valuetext={`${batch.partsDone} of ${batch.partsTarget} parts`}
      >
        <div className="batch-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="batch-kpis" data-testid="batch-kpis">
        {kpis.map((k) => (
          <Fragment key={k.label}>
            {k.label} <b>{k.value}</b>
            {k.after ? ` ${k.after}` : ''}
            {' · '}
          </Fragment>
        ))}
        {nextText(batch)}
      </div>
    </Card>
  )
}
