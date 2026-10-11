import { resolveConflict, type Conflict } from '../crdt/conflicts'
import { cellFor, roundDate } from '../domain/ledger'
import { formatClock, formatWithDay } from '../domain/dates'
import { formatNaira } from '../domain/money'
import { firstName } from '../domain/names'
import { useEngine, useEngineState } from '../app/engineContext'
import { phoneOf } from '../app/devices'
import { Icon } from '../ui/Icon'
import { useToast } from '../ui/toastContext'
import { useCircleView } from './circleContext'
import { methodName, roundWord, stateName } from './labels'
import './conflict.css'

interface Props {
  conflict: Conflict
  onResolved?: () => void
  headingLevel?: 2 | 3
}

export function ConflictCard({ conflict, onResolved, headingLevel = 3 }: Props) {
  const engine = useEngine()
  const { deviceId } = useEngineState()
  const { circle, today } = useCircleView()
  const toast = useToast()
  const member = circle.members[conflict.memberId]
  const who = member ? firstName(member.name) : 'This member'
  const word = roundWord(circle)
  const H = `h${headingLevel}` as const
  const others = [...new Set(conflict.versions.map((v) => v.recordedBy).filter((d) => d !== deviceId))].map((d) => phoneOf(d, deviceId).replace(/'s phone$/, ''))
  const mineFirst = [...conflict.versions].sort((a, b) => Number(b.recordedBy === deviceId) - Number(a.recordedBy === deviceId))

  const keep = async (index: number) => {
    const chosen = mineFirst[index]!
    await engine.edit(circle.id, { label: `Kept ${formatNaira(chosen.amount)} for ${who} ${word} ${conflict.round}`, detail: 'Settled two versions', key: conflict.key }, (doc) =>
      resolveConflict(doc, conflict.key, chosen, deviceId, new Date().toISOString()),
    )
    toast(`Kept ${formatNaira(chosen.amount)} for ${who}. Every phone will show this.`)
    onResolved?.()
  }

  const ask = async () => {
    const list = mineFirst.map((v) => `${formatNaira(v.amount)} (${methodName[v.method]})`).join(' or ')
    const text = `Hi ${who}, quick check for ${circle.name}: for ${word} ${conflict.round} (${formatWithDay(roundDate(circle, conflict.round))}) we have two records, ${list}. Which one is right?`
    try {
      if (navigator.share) {
        await navigator.share({ text })
        return
      }
      await navigator.clipboard.writeText(text)
      toast(`Message for ${who} copied. Paste it into WhatsApp.`)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') toast("Couldn't open sharing on this device.", { tone: 'warn' })
    }
  }

  return (
    <article className="conflict card" aria-labelledby={`cf-${conflict.key}`}>
      <H id={`cf-${conflict.key}`} className="eyebrow conflict-title">
        <Icon name="fork" size={16} />
        Two versions to check
      </H>
      <p>
        {who}, {word} {conflict.round}. {others.length ? `You and ${others.join(' and ')} both` : 'Two phones'} changed this square while apart. Nothing has been lost;
        pick what really happened.
      </p>
      <div className="versions">
        {mineFirst.map((v, i) => {
          const state = cellFor({ ...circle, payments: { ...circle.payments, [conflict.key]: v } }, conflict.memberId, conflict.round, today).state
          return (
            <div key={i} className="version">
              <span className="version-src">{phoneOf(v.recordedBy, deviceId)}</span>
              <b className="num">{formatNaira(v.amount)}</b>
              <span>
                {stateName[state].toLowerCase()}, {methodName[v.method]}
              </span>
              <small>
                paid {formatWithDay(v.paidOn)} · edited {formatClock(v.recordedAt)}
              </small>
            </div>
          )
        })}
      </div>
      <div className="conflict-actions">
        {mineFirst.map((v, i) => (
          <button key={i} type="button" className={`btn btn-small${i === 0 ? ' btn-primary' : ''}`} onClick={() => void keep(i)}>
            Keep {formatNaira(v.amount)}
          </button>
        ))}
        <button type="button" className="btn btn-small" onClick={() => void ask()}>
          Ask {who}
        </button>
      </div>
    </article>
  )
}
