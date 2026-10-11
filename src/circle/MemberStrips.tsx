import { Link } from 'react-router'
import { cellFor, currentRound, describeMember, summariseMember } from '../domain/ledger'
import { formatNaira } from '../domain/money'
import { cellKey } from '../domain/types'
import { Avatar } from '../ui/Avatar'
import { Icon } from '../ui/Icon'
import { useCircleView } from './circleContext'
import { usePendingKeys, visibleRounds } from './hooks'
import { roundAbbr, stateName } from './labels'

/** The phone version of the grid: one row per member, a mini strip of squares, tap through for detail. */
export function MemberStrips() {
  const { circle, conflicts, today } = useCircleView()
  const pending = usePendingKeys(circle.id)
  const conflictKeys = new Set(conflicts.map((c) => c.key))
  const rounds = visibleRounds(circle.order.length, currentRound(circle, today))
  const abbr = roundAbbr(circle)

  // People who need attention first; the rest keep rotation order.
  const rows = circle.order
    .map((id, index) => ({ id, index, s: summariseMember(circle, id, today) }))
    .sort((a, b) => Number(b.s.owed > 0) - Number(a.s.owed > 0) || a.index - b.index)

  return (
    <section aria-labelledby="members-title">
      <div className="strip-head">
        <h2 id="members-title" className="eyebrow">
          Members
        </h2>
        <span>
          {abbr === 'wk' ? 'weeks' : 'months'} 1 to {rounds.length}
        </span>
      </div>
      <ul className="strips">
        {rows.map(({ id, s }) => {
          const m = circle.members[id]!
          const unsyncedHere = rounds.some((r) => pending.has(cellKey(id, r)))
          const status = s.owed === 0 && unsyncedHere ? 'Edited here · not synced' : describeMember(s, formatNaira, abbr)
          return (
            <li key={id}>
              <Link to={`members/${id}`} className="strip-row">
                <Avatar member={m} size={36} />
                <span className="strip-who">
                  <b>{m.name}</b>
                  <small className={s.owed > 0 ? 'owing' : undefined}>{status}</small>
                </span>
                <span className="strip" aria-hidden="true">
                  {rounds.map((r) => {
                    const cell = cellFor(circle, id, r, today)
                    const key = cellKey(id, r)
                    return (
                      <i
                        key={r}
                        className={`cell mini is-${cell.state}${conflictKeys.has(key) ? ' has-conflict' : ''}${pending.has(key) ? ' is-unsynced' : ''}`}
                      />
                    )
                  })}
                </span>
                <span className="visually-hidden">
                  {rounds.map((r) => `${abbr} ${r} ${stateName[cellFor(circle, id, r, today).state].toLowerCase()}`).join(', ')}
                </span>
                <Icon name="chevron" size={16} className="strip-chev" />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
