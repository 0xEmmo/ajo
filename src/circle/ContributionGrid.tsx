import { Fragment } from 'react'
import { Link } from 'react-router'
import { cellFor, currentRound, roundDate, summariseMember } from '../domain/ledger'
import { formatShort } from '../domain/dates'
import { formatNaira } from '../domain/money'
import { cellKey } from '../domain/types'
import { Avatar } from '../ui/Avatar'
import { usePendingKeys, visibleRounds } from './hooks'
import { useCircleView } from './circleContext'
import { cellLabel, cellText, roundAbbr } from './labels'
import './grid.css'

export function ContributionGrid() {
  const { circle, conflicts, today, openPayment, openConflict } = useCircleView()
  const pending = usePendingKeys(circle.id)
  const conflictKeys = new Set(conflicts.map((c) => c.key))
  const rounds = visibleRounds(circle.order.length, currentRound(circle, today))
  const abbr = roundAbbr(circle)

  if (circle.order.length === 0) {
    return (
      <section className="grid-empty card">
        <h2 className="eyebrow">Contributions</h2>
        <p>Nobody is in this circle yet. Add members, then their squares will show up here.</p>
        <Link className="btn btn-primary" to="members">
          Add members
        </Link>
      </section>
    )
  }

  return (
    <section className="contrib" aria-labelledby="contrib-title">
      <div className="section-head">
        <h2 id="contrib-title" className="eyebrow">
          Contributions
        </h2>
        <span>Tap a square to record a payment</span>
      </div>
      <div className="contrib-scroll">
        <table className="contrib-table" style={{ ['--cols' as string]: rounds.length }}>
          <caption className="visually-hidden">
            Contributions by member and {abbr === 'wk' ? 'week' : 'month'}. Each square is a button to record or change a payment.
          </caption>
          <thead>
            <tr>
              <th scope="col">Member</th>
              {rounds.map((r) => (
                <th scope="col" key={r}>
                  {abbr} {r}
                  <small>{formatShort(roundDate(circle, r))}</small>
                </th>
              ))}
              <th scope="col" className="tot">
                Paid
              </th>
            </tr>
          </thead>
          <tbody>
            {circle.order.map((id) => {
              const m = circle.members[id]!
              const s = summariseMember(circle, id, today)
              return (
                <tr key={id}>
                  <th scope="row">
                    <Link to={`members/${id}`} className="contrib-member">
                      <Avatar member={m} size={28} />
                      <span>{m.name}</span>
                    </Link>
                  </th>
                  {rounds.map((r) => {
                    const cell = cellFor(circle, id, r, today)
                    const key = cellKey(id, r)
                    const conflict = conflictKeys.has(key)
                    const unsynced = pending.has(key)
                    return (
                      <td key={r}>
                        <button
                          type="button"
                          className={`cell is-${cell.state}${conflict ? ' has-conflict' : ''}${unsynced ? ' is-unsynced' : ''}`}
                          aria-label={cellLabel(cell, m.name, circle, { conflict, unsynced })}
                          onClick={() => (conflict ? openConflict(key) : openPayment({ memberId: id, round: r }))}
                        >
                          {cell.state === 'part' ? <span className="part-chip">{cellText(cell, circle.amount)}</span> : cellText(cell, circle.amount)}
                        </button>
                      </td>
                    )
                  })}
                  <td className={`tot num${s.owed > 0 ? ' is-owing' : ''}`}>
                    {formatNaira(s.paid)}
                    {s.owed > 0 && <span className="visually-hidden">, owes {formatNaira(s.owed)}</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Legend />
    </section>
  )
}

export function Legend() {
  const items: [string, string][] = [
    ['paid', 'Paid'],
    ['late', 'Paid late'],
    ['part', 'Part paid'],
    ['missed', 'Missed'],
    ['due', 'Due'],
    ['unsynced', 'Not synced yet'],
  ]
  return (
    <ul className="legend" aria-label="Key">
      {items.map(([k, label]) => (
        <Fragment key={k}>
          <li>
            <i className={`swatch is-${k}`} aria-hidden="true" />
            {label}
          </li>
        </Fragment>
      ))}
    </ul>
  )
}
