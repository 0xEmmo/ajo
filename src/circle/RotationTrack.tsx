import { useMemo } from 'react'
import { schedule } from '../domain/rotation'
import { formatShort } from '../domain/dates'
import { formatNaira } from '../domain/money'
import { firstName } from '../domain/names'
import { cellKey } from '../domain/types'
import { Avatar } from '../ui/Avatar'
import { useCircleView } from './circleContext'
import './rotation-track.css'

export function RotationTrack() {
  const { circle, today, openPayout } = useCircleView()
  const slots = useMemo(() => schedule(circle, today), [circle, today])
  const reached = slots.filter((s) => s.state !== 'upcoming').length
  const progress = slots.length > 1 ? Math.max(0, reached - 1) / (slots.length - 1) : 0

  return (
    <section className="rot card" aria-labelledby="rot-title">
      <div className="section-head">
        <h2 id="rot-title" className="eyebrow">
          Rotation
        </h2>
        <span>Whose turn to collect the pot</span>
      </div>
      <div className="rot-scroll">
        <ol className="rot-track" style={{ ['--n' as string]: slots.length, ['--p' as string]: progress }}>
          {slots.map((slot) => {
            const m = circle.members[slot.memberId]!
            const collected = circle.order.reduce((sum, id) => sum + (circle.payments[cellKey(id, slot.round)]?.amount ?? 0), 0)
            const sub =
              slot.state === 'collected'
                ? formatShort(slot.date)
                : slot.state === 'collecting'
                  ? `${formatShort(slot.date)} · ${formatNaira(collected)} so far`
                  : slot.state === 'overdue'
                    ? `${formatShort(slot.date)} · not paid out`
                    : formatShort(slot.date)
            return (
              <li key={slot.round} className={`rot-slot is-${slot.state}`} aria-current={slot.state === 'collecting' ? 'step' : undefined}>
                <button
                  type="button"
                  className="rot-btn"
                  onClick={() => openPayout(slot.round)}
                  aria-label={`Round ${slot.round}, ${m.name}, ${formatShort(slot.date)}, ${
                    slot.state === 'collected' ? 'collected' : slot.state === 'collecting' ? 'collecting now' : slot.state === 'overdue' ? 'payout not recorded' : 'upcoming'
                  }`}
                >
                  <Avatar member={m} size={slot.state === 'collecting' ? 54 : 44} />
                  <span className="rot-name">{firstName(m.name)}</span>
                  <small className="num">{sub}</small>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
