import { useState } from 'react'
import { moveMember } from '../crdt/circleDoc'
import { useEngine } from '../app/engineContext'
import { useIsPhone } from '../app/useMediaQuery'
import { schedule, payoutCheck } from '../domain/rotation'
import { formatWithDay } from '../domain/dates'
import { formatNaira } from '../domain/money'
import { firstName } from '../domain/names'
import { Avatar } from '../ui/Avatar'
import { Icon } from '../ui/Icon'
import { useToast } from '../ui/toastContext'
import { useCircleView } from './circleContext'
import { RotationTrack } from './RotationTrack'
import { roundWord } from './labels'
import './pages.css'

const stateText = { collected: 'Collected', collecting: 'Collecting now', overdue: 'Not paid out', upcoming: 'Upcoming' } as const

export function RotationPage() {
  const engine = useEngine()
  const toast = useToast()
  const phone = useIsPhone()
  const { circle, today, openPayout } = useCircleView()
  const [editing, setEditing] = useState(false)
  const slots = schedule(circle, today)
  const word = roundWord(circle)
  const locked = slots.findIndex((s) => s.state !== 'collected')
  const lockedUpTo = locked === -1 ? slots.length : locked

  const move = async (index: number, delta: -1 | 1) => {
    const id = circle.order[index]!
    const name = firstName(circle.members[id]!.name)
    await engine.edit(circle.id, { label: `Moved ${name} to ${word} ${index + 1 + delta}`, detail: 'Rotation order' }, (doc) => moveMember(doc, index, index + delta))
    toast(`${name} now collects in ${word} ${index + 1 + delta}`)
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="display">Rotation</h1>
          <p className="muted">Who collects the pot, and when. Open a turn to see what's in and record the payout.</p>
        </div>
        {slots.length > 1 && (
          <button type="button" className={`btn${editing ? ' btn-primary' : ''}`} onClick={() => setEditing((e) => !e)} aria-pressed={editing}>
            <Icon name={editing ? 'check' : 'edit'} size={16} /> {editing ? 'Done' : 'Change order'}
          </button>
        )}
      </header>
      {!phone && slots.length > 0 && <RotationTrack />}
      {slots.length === 0 && <p className="card">Add members first. Their turns will line up here.</p>}
      {editing && <p className="note">Turns that have already been paid out stay where they are.</p>}
      <ol className="turns">
        {slots.map((slot, i) => {
          const m = circle.members[slot.memberId]!
          const check = payoutCheck(circle, slot.round)!
          return (
            <li key={slot.memberId} className={`turn-row is-${slot.state}`}>
              <span className="turn-round num" aria-hidden="true">
                {slot.round}
              </span>
              <Avatar member={m} size={44} />
              <div className="turn-who">
                <b>{m.name}</b>
                <small>
                  {formatWithDay(slot.date)} · {slot.payout ? `${stateText.collected} ${formatNaira(slot.payout.amount)}` : slot.state === 'upcoming' ? stateText.upcoming : `${formatNaira(check.collected)} of ${formatNaira(check.pot)} in`}
                </small>
              </div>
              {editing ? (
                <span className="turn-move">
                  <button type="button" className="icon-btn" aria-label={`Move ${m.name} earlier`} disabled={i <= lockedUpTo || i === 0} onClick={() => void move(i, -1)}>
                    <Icon name="up" />
                  </button>
                  <button type="button" className="icon-btn" aria-label={`Move ${m.name} later`} disabled={i < lockedUpTo || i === slots.length - 1} onClick={() => void move(i, 1)}>
                    <Icon name="down" />
                  </button>
                </span>
              ) : (
                <button type="button" className={`btn btn-small${slot.state === 'collecting' || slot.state === 'overdue' ? ' btn-accent' : ''}`} onClick={() => openPayout(slot.round)}>
                  <span className={`state-chip is-${slot.state}`}>{stateText[slot.state]}</span>
                  <span className="visually-hidden">, open {firstName(m.name)}'s turn</span>
                </button>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
