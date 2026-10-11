import { useState } from 'react'
import { Link } from 'react-router'
import { addMember } from '../crdt/circleDoc'
import { useEngine } from '../app/engineContext'
import { describeMember, summariseMember } from '../domain/ledger'
import { formatNaira } from '../domain/money'
import { slugId } from '../domain/names'
import { Avatar } from '../ui/Avatar'
import { Icon } from '../ui/Icon'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../ui/toastContext'
import { useCircleView } from './circleContext'
import { MemberForm } from './MemberForm'
import { roundAbbr, roundWord } from './labels'
import './pages.css'

export function MembersPage() {
  const engine = useEngine()
  const toast = useToast()
  const { circle, today, meId } = useCircleView()
  const [adding, setAdding] = useState(false)
  const totalOwed = circle.order.reduce((sum, id) => sum + summariseMember(circle, id, today).owed, 0)

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="display">Members</h1>
          <p className="muted">
            {circle.order.length} in the circle{totalOwed > 0 ? ` · ${formatNaira(totalOwed)} owed between them` : ' · nobody owes anything'}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} strokeWidth={2.6} /> Add member
        </button>
      </header>

      {circle.order.length === 0 ? (
        <div className="card">
          <p>No members yet. Add the people saving with you; new members join the end of the rotation.</p>
        </div>
      ) : (
        <ul className="member-list">
          {circle.order.map((id, i) => {
            const m = circle.members[id]!
            const s = summariseMember(circle, id, today)
            return (
              <li key={id}>
                <Link to={id} className="member-link">
                  <Avatar member={m} size={44} />
                  <span>
                    <b>
                      {m.name}
                      {id === circle.coordinatorId && <span className="tag">Coordinator</span>}
                      {id === meId && <span className="tag you">You</span>}
                    </b>
                    <small className={s.owed > 0 ? 'owing' : undefined}>{describeMember(s, formatNaira, roundAbbr(circle))}</small>
                  </span>
                  <span className="num muted">
                    {roundWord(circle)} {i + 1}
                  </span>
                  <Icon name="chevron" size={16} />
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add a member" description="They'll collect after everyone already in the rotation.">
        <MemberForm
          submitLabel="Add to circle"
          taken={Object.values(circle.members).map((m) => m.name)}
          onSubmit={async (draft) => {
            const id = slugId(draft.name)
            await engine.edit(circle.id, { label: `Added ${draft.name}`, detail: `Collects in ${roundWord(circle)} ${circle.order.length + 1}` }, (doc) =>
              addMember(doc, { id, ...draft, joinedOn: today }),
            )
            setAdding(false)
            toast(`${draft.name} added`)
          }}
        />
      </Sheet>
    </div>
  )
}
