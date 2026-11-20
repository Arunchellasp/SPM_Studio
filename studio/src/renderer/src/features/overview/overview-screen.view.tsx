import type { ScreenDef } from '../../app/screens'
import { DEMO_OVERVIEW } from '../../fixtures/demo'
import { BatchCard } from './batch-card.view'
import { WhyNotFasterCard } from './why-card.view'
import './overview.css'

/**
 * N01 Operate › Overview — built piece by piece in phase B:
 * step 12 top row (batch + why not faster) · step 13 station cards · step 14 alarms and events.
 * Data: fixtures/demo.ts today, the runtime later (same types).
 */
export function OverviewScreen({ screen }: { screen: ScreenDef }): React.JSX.Element {
  const data = DEMO_OVERVIEW
  return (
    <div className="ovw">
      {/* the design shows no page title on N01; screen readers still get one */}
      <h1 className="sr-only-h1">
        {screen.code} {screen.title}
      </h1>
      <div className="ovw-top">
        <BatchCard batch={data.batch} />
        <WhyNotFasterCard why={data.whyNotFaster} />
      </div>
      <div className="ovw-next">Station cards (step 13) and the alarm and event list (step 14) come here.</div>
    </div>
  )
}
