import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { hasPayments, removeMember, updateMember } from '../crdt/circleDoc'
import { useEngine } from '../app/engineContext'
import { cellFor, roundCount, roundDate, summariseMember } from '../domain/ledger'
import { schedule } from '../domain/rotation'
import { formatWithDay } from '../domain/dates'
import { formatNaira } from '../domain/money'
import { firstName } from '../domain/names'
import { cellKey } from '../domain/types'
import { Avatar } from '../ui/Avatar'
import { Icon } from '../ui/Icon'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../ui/toastContext'
import { useCircleView } from './circleContext'
import { usePendingKeys } from './hooks'
import { MemberForm } from './MemberForm'
import { cellText, methodName, roundAbbr, roundWord, stateName } from './labels'
import './pages.css'
import './grid.css'

export function MemberPage() {
  const { memberId = '' } = useParams()
  const engine = useEngine()
  const toast = useToast()
  const navigate = useNavigate()
  const { circle, conflicts, today, meId, openPayment, openConflict } = useCircleView()
  const pending = usePendingKeys(circle.id)
  const [editing, setEditing] = useState(false)
  const m = circle.members[memberId]

  if (!m) {
    return (
      <div className="page">
        <Link to=".." relative="path" className="back">
          <Icon name="back" size={18} /> Members
        </Link>
        <h1 className="display">Not in this circle</h1>
        <p>This member may have been removed on another phone.</p>
      </div>
    )
  }

  const s = summariseMember(circle, memberId, today)
  const slot = schedule(circle, today).find((x) => x.memberId === memberId)
  const word = roundWord(circle)
  const name = firstName(m.name)
  const conflictKeys = new Set(conflicts.map((c) => c.key))
  const canRemove = !hasPayments(circle, memberId) && !slot?.payout
  const rounds = Array.from({ length: roundCount(circle) }, (_, i) => i + 1)

  const remind = async () => {
    const text = `Hi ${name}, a gentle reminder from ${circle.name}: you have ${formatNaira(s.owed)} outstanding. Thank you!`
    try {
      if (navigator.share) return void (await navigator.share({ text }))
      await navigator.clipboard.writeText(text)
      toast('Reminder copied. Paste it into WhatsApp or SMS.')
    } catch (err) {
      if ((err as Error).name !== 'AbortError') toast("Couldn't open sharing here.", { tone: 'warn' })
    }
  }

  const remove = async () => {
    await engine.edit(circle.id, { label: `Removed ${m.name}`, detail: 'Left before paying anything' }, (doc) => removeMember(doc, memberId))
    toast(`${m.name} removed`)
    navigate('..', { relative: 'path' })
  }

  return (
    <div className="page">
      <Link to=".." relative="path" className="back">
        <Icon name="back" size={18} /> Members
      </Link>
      <header className="member-hero">
        <Avatar member={m} size={84} />
        <div>
          <h1 className="display">{m.name}</h1>
          <p className="muted">
            {memberId === circle.coordinatorId ? 'Coordinator · ' : ''}
            {memberId === meId ? 'This is you · ' : ''}
            {m.phone ?? 'No phone number'}
          </p>
        </div>
      </header>

      <dl className="stats">
        <div>
          <dt>Paid</dt>
          <dd>{formatNaira(s.paid)}</dd>
        </div>
        <div>
          <dt>{s.credit > 0 ? 'Ahead' : 'Owes'}</dt>
          <dd className={s.owed > 0 ? 'owing' : undefined}>{formatNaira(s.credit > 0 ? s.credit : s.owed)}</dd>
        </div>
        <div>
          <dt>Collects</dt>
          <dd>
            {slot ? `${capital(roundAbbr(circle))} ${slot.round}` : '–'}
            {slot && <small>{slot.payout ? `got ${formatNaira(slot.payout.amount)}` : formatWithDay(slot.date)}</small>}
          </dd>
        </div>
      </dl>

      <div className="row">
        <button type="button" className="btn btn-accent" onClick={() => openPayment({ memberId, round: undefined })}>
          <Icon name="plus" size={16} strokeWidth={2.6} /> Record payment
        </button>
        {s.owed > 0 && (
          <button type="button" className="btn" onClick={() => void remind()}>
            <Icon name="message" size={16} /> Send a reminder
          </button>
        )}
        <button type="button" className="btn" onClick={() => setEditing(true)}>
          <Icon name="edit" size={16} /> Edit details
        </button>
      </div>

      <section aria-labelledby="hist-title">
        <h2 id="hist-title" className="eyebrow">
          {word === 'week' ? 'Week by week' : 'Month by month'}
        </h2>
        <ul className="history">
          {rounds.map((r) => {
            const cell = cellFor(circle, memberId, r, today)
            const key = cellKey(memberId, r)
            const conflict = conflictKeys.has(key)
            return (
              <li key={r}>
                <button type="button" onClick={() => (conflict ? openConflict(key) : openPayment({ memberId, round: r }))}>
                  <span className={`cell is-${cell.state}${conflict ? ' has-conflict' : ''}${pending.has(key) ? ' is-unsynced' : ''}`} aria-hidden="true">
                    {cell.state === 'part' ? '½' : cell.state === 'upcoming' ? '' : cellText(cell, circle.amount).replace(/ days?$/, 'd')}
                  </span>
                  <span>
                    <b>
                      {capital(word)} {r} · {formatWithDay(roundDate(circle, r))}
                    </b>
                    <small>
                      {conflict ? 'Two versions to check' : stateName[cell.state]}
                      {cell.payment && ` · ${methodName[cell.payment.method]}${cell.payment.ref ? ` ref ${cell.payment.ref}` : ''}`}
                      {pending.has(key) && ' · not synced'}
                    </small>
                  </span>
                  <span className="num">{cell.payment ? formatNaira(cell.payment.amount) : ''}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="danger-zone">
        <button type="button" className="btn btn-danger" disabled={!canRemove} onClick={() => void remove()} aria-describedby="remove-why">
          <Icon name="trash" size={16} /> Remove from circle
        </button>
        <p id="remove-why">{canRemove ? 'They have not paid anything yet, so nothing is lost.' : `${name} has payments recorded, so they stay on the books. Record a payout to settle up instead.`}</p>
      </div>

      <Sheet open={editing} onClose={() => setEditing(false)} title={`Edit ${name}`}>
        <MemberForm
          initial={m}
          submitLabel="Save"
          taken={Object.values(circle.members)
            .filter((x) => x.id !== memberId)
            .map((x) => x.name)}
          onSubmit={async (draft) => {
            await engine.edit(circle.id, { label: `Updated ${draft.name}'s details`, detail: 'Member details' }, (doc) =>
              updateMember(doc, memberId, { name: draft.name, phone: draft.phone ?? '', photo: draft.photo ?? '' }),
            )
            setEditing(false)
            toast('Saved')
          }}
        />
      </Sheet>
    </div>
  )
}

function capital(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
