import { Link } from 'react-router'
import { useEngineState, useToday } from '../app/engineContext'
import { deviceOwner } from '../app/devices'
import { useInstall } from '../app/useInstall'
import { snapshot } from '../crdt/circleDoc'
import { findConflicts } from '../crdt/conflicts'
import { summariseCircle, summariseMember } from '../domain/ledger'
import { focusSlot } from '../domain/rotation'
import { formatWithDay, plural } from '../domain/dates'
import { formatNaira } from '../domain/money'
import { firstName } from '../domain/names'
import type { Circle } from '../domain/types'
import { Avatar } from '../ui/Avatar'
import { Icon } from '../ui/Icon'
import { Mark } from '../ui/Mark'
import './pages.css'

export function Home() {
  const { docs, deviceId, queue, settings } = useEngineState()
  const today = useToday()
  const { canInstall, install } = useInstall()
  const circles = Object.values(docs)
    .map((d) => ({ circle: snapshot(d), conflicts: findConflicts(d).length }))
    .sort((a, b) => b.circle.createdAt.localeCompare(a.circle.createdAt))

  return (
    <div className="home">
      <header className="home-top">
        <span className="wordmark">
          <Mark /> Ajo
        </span>
        <span className="device-chip">
          <Icon name="phone" size={15} /> {deviceOwner(deviceId)}'s phone
        </span>
        {canInstall && (
          <button type="button" className="btn btn-small" onClick={() => void install()}>
            <Icon name="install" size={16} /> Install
          </button>
        )}
      </header>

      <main id="main" className="home-main">
        <div className="home-head">
          <h1 className="display">Your circles</h1>
          <div className="row">
            <Link className="btn btn-primary" to="/new">
              <Icon name="plus" size={16} strokeWidth={2.6} /> New circle
            </Link>
            <Link className="btn" to="/join">
              Join with a code
            </Link>
          </div>
        </div>

        {circles.length === 0 ? (
          <section className="home-empty">
            <img src="/photos/market-stall.jpg" alt="Two traders laughing together at their market stall" width="640" height="300" />
            <div>
              <h2 className="eyebrow">No circles on this phone yet</h2>
              <p>
                Start one for your stall, your office or your family, or join one someone shared with you. Ajo keeps the book on this phone, so it works at the
                market with no signal.
              </p>
            </div>
          </section>
        ) : (
          <ul className="circle-cards">
            {circles.map(({ circle, conflicts }) => (
              <li key={circle.id}>
                <CircleCard
                  circle={circle}
                  conflicts={conflicts}
                  pending={queue.filter((q) => q.circleId === circle.id).length}
                  meId={settings.me[circle.id]}
                  today={today}
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="home-foot">
        <p>
          A portfolio project by Emmanuel Balogun. The demo circle and its people are made up. <Link to="/credits">Photo credits</Link>
        </p>
      </footer>
    </div>
  )
}

function CircleCard({ circle, conflicts, pending, meId, today }: { circle: Circle; conflicts: number; pending: number; meId?: string; today: string }) {
  const s = summariseCircle(circle, today)
  const slot = focusSlot(circle, today)
  const collector = slot && circle.members[slot.memberId]
  const me = meId ? summariseMember(circle, meId, today) : null
  const faces = circle.order.slice(0, 5).map((id) => circle.members[id]!)
  const word = circle.frequency === 'weekly' ? 'week' : 'month'
  return (
    <Link to={`/c/${circle.id}`} className="circle-card">
      <div className="cc-top">
        <h2>{circle.name}</h2>
        {(pending > 0 || conflicts > 0) && <span className="cc-flag num">{conflicts > 0 ? plural(conflicts, 'clash', 'clashes') : `${pending} unsynced`}</span>}
      </div>
      <p className="muted">
        {formatNaira(circle.amount)} {circle.frequency} · {plural(circle.order.length, 'member')}
        {s.round > 0 && !s.finished && ` · ${word} ${s.round} of ${s.rounds}`}
        {s.finished && ' · finished'}
      </p>
      <div className="cc-faces" aria-hidden="true">
        {faces.map((m) => (
          <Avatar key={m.id} member={m} size={30} />
        ))}
        {circle.order.length > 5 && <span className="cc-more num">+{circle.order.length - 5}</span>}
      </div>
      <dl className="cc-facts">
        {collector && (
          <div>
            <dt>{slot.state === 'collecting' ? 'Collecting now' : slot.state === 'overdue' ? 'Waiting for payout' : 'Next to collect'}</dt>
            <dd>
              {firstName(collector.name)}
              {slot.state === 'upcoming' && `, ${formatWithDay(slot.date)}`}
            </dd>
          </div>
        )}
        {me && (
          <div>
            <dt>You</dt>
            <dd className={me.owed > 0 ? 'owing' : undefined}>{me.owed > 0 ? `owe ${formatNaira(me.owed)}` : 'all paid'}</dd>
          </div>
        )}
        <div>
          <dt>Owed to circle</dt>
          <dd className="num">{formatNaira(s.owed)}</dd>
        </div>
      </dl>
    </Link>
  )
}
