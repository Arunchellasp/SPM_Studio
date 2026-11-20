import type { WhyNotFaster } from '../../model/overview'
import { Card } from '../../components/card.view'
import { whyNotFasterText } from './batch'
import './overview.css'

/** N01 top-right card: the biggest time loss and what would help (from trace analysis). */
export function WhyNotFasterCard({ why }: { why: WhyNotFaster }): React.JSX.Element {
  return (
    <Card title="Why not faster?" className="why-card">
      <p className="why-text">{whyNotFasterText(why)}</p>
    </Card>
  )
}
