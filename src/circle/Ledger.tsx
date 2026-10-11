import { useState } from 'react'
import { Link } from 'react-router'
import { useEngine, useEngineState } from '../app/engineContext'
import { useIsPhone } from '../app/useMediaQuery'
import { DEMO_CIRCLE_ID, DEMO_DEVICE } from '../crdt/seed'
import { summariseCircle } from '../domain/ledger'
import { focusSlot, payoutCheck } from '../domain/rotation'
import { formatShort, formatWithDay, fromISODate, plural } from '../domain/dates'
import { formatNaira } from '../domain/money'
import { firstName } from '../domain/names'
import { Avatar } from '../ui/Avatar'
import { Icon } from '../ui/Icon'
import { useCircleView } from './circleContext'
import { ConflictCard } from './ConflictCard'
import { ContributionGrid } from './ContributionGrid'
import { MemberStrips } from './MemberStrips'
import { RotationTrack } from './RotationTrack'
import { SyncQueue } from './SyncQueue'
import { roundWord } from './labels'
import './ledger.css'

export function Ledger() {
  const phone = useIsPhone()
  return phone ? <PhoneLedger /> : <WideLedger />
}

function useHeader() {
  const { circle, today } = useCircleView()
  const s = summariseCircle(circle, today)
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(fromISODate(circle.startDate))
  const coordinator = circle.members[circle.coordinatorId]
  const every = circle.frequency === 'weekly' ? `every ${weekday}` : 'every month'
  return { s, weekday, coordinator, every }
}

function WideLedger() {
  const { circle, conflicts } = useCircleView()
  const { s, coordinator, every } = useHeader()
  const word = roundWord(circle)
  return (
    <div className="ledger">
      <div className="ledger-main">
        <DemoTip />
        <header className="ledger-hdr">
          <div>
            <h1 className="display">{circle.name}</h1>
            <p className="ledger-meta">
              {formatNaira(circle.amount)} {every} · {plural(circle.order.length, 'member')} · {s.round === 0 ? 'starts' : 'started'} {formatShort(circle.startDate)}
              {coordinator && ` · coordinator ${coordinator.name}`}
            </p>
          </div>
          <dl className="kpis">
            <div>
              <dt>Pot each {word}</dt>
              <dd className="num">{formatNaira(s.pot)}</dd>
            </div>
            <div>
              <dt>{word}</dt>
              <dd className="num">{s.finished ? 'Done' : s.round === 0 ? '–' : `${s.round} of ${s.rounds}`}</dd>
            </div>
            <div>
              <dt>Owed to circle</dt>
              <dd className={`num${s.owed > 0 ? ' is-owing' : ''}`}>{formatNaira(s.owed)}</dd>
            </div>
          </dl>
        </header>
        {circle.order.length > 0 && <RotationTrack />}
        <ContributionGrid />
      </div>
      <aside className="ledger-side" aria-label="Needs attention">
        {conflicts.map((c) => (
          <ConflictCard key={c.key} conflict={c} />
        ))}
        <SyncQueue />
        <CollectCard />
      </aside>
    </div>
  )
}

function CollectCard() {
  const { circle, today, openPayout } = useCircleView()
  const slot = focusSlot(circle, today)
  if (!slot) return null
  const check = payoutCheck(circle, slot.round)!
  const m = circle.members[slot.memberId]!
  const name = firstName(m.name)
  const word = roundWord(circle)
  const missing = check.outstanding.map((o) => `${firstName(circle.members[o.memberId]!.name)}'s ${formatNaira(o.missing)}`)
  return (
    <section className="collect card" aria-labelledby="collect-title">
      <img src="/photos/market-stall.jpg" alt="Traders laughing together at a market stall" width="380" height="120" loading="lazy" />
      <div className="collect-body">
        <h3 id="collect-title" className="eyebrow">
          {slot.state === 'collecting' ? `Before ${name} collects` : slot.state === 'overdue' ? `${name} hasn't been paid out` : `Next: ${name}`}
        </h3>
        <p>
          {formatNaira(check.collected)} of {formatNaira(check.pot)} is in for {word} {slot.round}.{' '}
          {missing.length === 0 ? 'Everyone has paid.' : missing.length <= 2 ? `${missing.join(' and ')} ${missing.length === 1 ? 'is' : 'are'} outstanding.` : `${plural(missing.length, 'member')} still to pay.`}
        </p>
        <button type="button" className="btn btn-primary btn-small" onClick={() => openPayout(slot.round)}>
          <Icon name="payout" size={16} /> {slot.state === 'upcoming' ? 'See the pot' : `Pay out to ${name}`}
        </button>
      </div>
    </section>
  )
}

function PhoneLedger() {
  const { circle, conflicts, today, openPayout, openConflict } = useCircleView()
  const { s } = useHeader()
  const [later, setLater] = useState<string[]>([])
  const word = roundWord(circle)
  const slot = focusSlot(circle, today)
  const collector = slot && circle.members[slot.memberId]
  const visible = conflicts.filter((c) => !later.includes(c.key))

  return (
    <div className="phone-ledger">
      <DemoTip />
      <header>
        <h1 className="display">{circle.name}</h1>
        <p className="ledger-meta">
          {formatNaira(circle.amount)} {circle.frequency} · {plural(circle.order.length, 'member')}
          {s.round > 0 && !s.finished && ` · ${word} ${s.round} of ${s.rounds}`}
          {s.finished && ' · finished'}
        </p>
      </header>

      {slot && collector && (
        <button type="button" className="turn" onClick={() => openPayout(slot.round)}>
          <Avatar member={collector} size={52} />
          <span className="turn-body">
            <small>{slot.state === 'collecting' ? `Collecting this ${word}` : slot.state === 'overdue' ? 'Not paid out yet' : `Collects ${formatWithDay(slot.date)}`}</small>
            <b>{collector.name}</b>
            <span className="turn-bar" aria-hidden="true">
              <i style={{ width: `${Math.min(100, (s.round === slot.round ? s.collectedThisRound : payoutCheck(circle, slot.round)!.collected) / Math.max(1, s.pot)) * 100}%` }} />
            </span>
            <span className="turn-n num">
              {formatNaira(payoutCheck(circle, slot.round)!.collected)} of {formatNaira(s.pot)} · {s.round === slot.round ? `${s.paidThisRound} of ${circle.order.length} paid` : `${word} ${slot.round}`}
            </span>
          </span>
        </button>
      )}

      {visible.map((c) => {
        const m = circle.members[c.memberId]
        const [a, b] = c.versions
        return (
          <div key={c.key} className="conflict-mini" role="group" aria-label="Two versions to check">
            <b>
              {m ? firstName(m.name) : 'Someone'}, {word} {c.round}: two versions
            </b>
            {a && b && (
              <span>
                One phone recorded {formatNaira(a.amount)}, another {formatNaira(b.amount)}.
              </span>
            )}
            <div className="row">
              <button type="button" className="btn btn-small btn-primary" onClick={() => openConflict(c.key)}>
                Review
              </button>
              <button type="button" className="btn btn-small" onClick={() => setLater((l) => [...l, c.key])}>
                Later
              </button>
            </div>
          </div>
        )
      })}

      {circle.order.length === 0 ? (
        <div className="card grid-empty">
          <p>Nobody is in this circle yet.</p>
          <Link className="btn btn-primary" to="members">
            Add members
          </Link>
        </div>
      ) : (
        <MemberStrips />
      )}
    </div>
  )
}

function DemoTip() {
  const engine = useEngine()
  const { deviceId, settings } = useEngineState()
  const { circle } = useCircleView()
  if (settings.tipDismissed || circle.id !== DEMO_CIRCLE_ID || deviceId !== DEMO_DEVICE) return null
  return (
    <aside className="demo-tip" aria-label="About this demo">
      <p>
        <b>This is Kemi's phone, and it starts offline.</b> Record a payment, then press Reconnect: the queue drains and Iya Sade's version of Funke's week 5 turns up as a clash to settle.{' '}
        <Link to="sync">Open a second phone</Link> to watch edits travel between tabs.
      </p>
      <button type="button" className="icon-btn" aria-label="Dismiss tip" onClick={() => void engine.updateSettings({ tipDismissed: true })}>
        <Icon name="close" size={18} />
      </button>
    </aside>
  )
}
