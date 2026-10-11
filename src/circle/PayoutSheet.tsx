import { useId, useState, type FormEvent } from 'react'
import { recordPayout, undoPayout } from '../crdt/circleDoc'
import { currentRound, roundDate } from '../domain/ledger'
import { payoutCheck } from '../domain/rotation'
import { daysBetween, formatWithDay } from '../domain/dates'
import { formatNaira, parseNaira } from '../domain/money'
import { firstName } from '../domain/names'
import type { PaymentMethod } from '../domain/types'
import { useEngine, useEngineState } from '../app/engineContext'
import { recorder } from '../app/devices'
import { Avatar } from '../ui/Avatar'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../ui/toastContext'
import { useCircleView } from './circleContext'
import { methodName, roundWord } from './labels'
import './payout.css'

export function PayoutSheet({ round, onClose }: { round: number | null; onClose: () => void }) {
  const { circle } = useCircleView()
  const who = round ? circle.members[circle.order[round - 1] ?? '']?.name : undefined
  return (
    <Sheet open={round !== null} onClose={onClose} title={who ? `${firstName(who)}'s turn` : 'Payout'}>
      {round !== null && <PayoutBody key={round} round={round} onDone={onClose} />}
    </Sheet>
  )
}

function PayoutBody({ round, onDone }: { round: number; onDone: () => void }) {
  const engine = useEngine()
  const { deviceId } = useEngineState()
  const { circle, today, openPayment } = useCircleView()
  const toast = useToast()
  const check = payoutCheck(circle, round)!
  const recipient = circle.members[check.recipientId]!
  const payout = circle.payouts[String(round)]
  const date = roundDate(circle, round)
  const future = round > Math.max(currentRound(circle, today), 0) && daysBetween(today, date) > 0
  const ids = { amount: useId(), date: useId() }
  const [amountText, setAmountText] = useState(String(check.collected))
  const [method, setMethod] = useState<PaymentMethod>('transfer')
  const [paidOn, setPaidOn] = useState(today)
  const [confirmShort, setConfirmShort] = useState(false)
  const amount = parseNaira(amountText)
  const name = firstName(recipient.name)
  const word = roundWord(circle)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (amount === null) return
    if (amount < check.pot && !confirmShort) {
      setConfirmShort(true)
      return
    }
    await engine.edit(circle.id, { label: `Paid out ${formatNaira(amount)} to ${name}`, detail: `${word} ${round} pot`, key: `payout:${round}` }, (doc) =>
      recordPayout(doc, round, { amount, method, paidOn, recordedBy: deviceId, recordedAt: new Date().toISOString() }),
    )
    toast(`Payout to ${name} recorded`)
    onDone()
  }

  const undo = async () => {
    await engine.edit(circle.id, { label: `Undid payout to ${name}`, detail: `${word} ${round}`, key: `payout:${round}` }, (doc) => undoPayout(doc, round))
    toast(`Payout to ${name} removed`)
    onDone()
  }

  return (
    <div className="payout">
      <div className="payout-hero">
        <Avatar member={recipient} size={64} />
        <div>
          <b>{recipient.name}</b>
          <span className="muted">
            Collects {word} {round} · {formatWithDay(date)}
          </span>
        </div>
      </div>

      <dl className="payout-figures">
        <div>
          <dt>Full pot</dt>
          <dd className="num">{formatNaira(check.pot)}</dd>
        </div>
        <div>
          <dt>Collected</dt>
          <dd className="num">{formatNaira(check.collected)}</dd>
        </div>
        <div>
          <dt>Still to come</dt>
          <dd className={`num${check.shortfall ? ' is-short' : ''}`}>{formatNaira(check.shortfall)}</dd>
        </div>
      </dl>

      {check.outstanding.length > 0 && (
        <div>
          <h3 className="label-caps">Not in yet</h3>
          <ul className="outstanding">
            {check.outstanding.map((o) => {
              const m = circle.members[o.memberId]!
              return (
                <li key={o.memberId}>
                  <Avatar member={m} size={28} />
                  <span>{m.name}</span>
                  <span className="num">{formatNaira(o.missing)}</span>
                  {!payout && (
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => {
                        onDone()
                        openPayment({ memberId: o.memberId, round })
                      }}
                    >
                      Record
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {payout ? (
        <div className="payout-done">
          <p>
            <b>Paid out {formatNaira(payout.amount)}</b> by {methodName[payout.method]} on {formatWithDay(payout.paidOn)}, recorded by {recorder(payout.recordedBy, deviceId)}.
          </p>
          <button type="button" className="btn btn-danger" onClick={() => void undo()}>
            Undo payout
          </button>
        </div>
      ) : future ? (
        <p className="payout-note">
          {name} collects on {formatWithDay(date)}. You can record the payout once that day comes.
        </p>
      ) : (
        <form onSubmit={submit} className="payout-form" noValidate>
          <div className="pay-pickers">
            <label className="field" htmlFor={ids.amount}>
              <span>Amount paid out</span>
              <input id={ids.amount} className="input money" inputMode="decimal" value={amountText} onChange={(e) => (setAmountText(e.target.value), setConfirmShort(false))} aria-invalid={amount === null} />
            </label>
            <label className="field" htmlFor={ids.date}>
              <span>Paid on</span>
              <input id={ids.date} type="date" className="input" value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value)} />
            </label>
          </div>
          <fieldset className="field">
            <legend>How</legend>
            <div className="segmented">
              {(['transfer', 'cash', 'pos'] as const).map((m) => (
                <label key={m}>
                  <input type="radio" name="payout-method" value={m} checked={method === m} onChange={() => setMethod(m)} />
                  <span>{m === 'pos' ? 'POS' : m[0]!.toUpperCase() + m.slice(1)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {confirmShort && amount !== null && (
            <p className="payout-warn" role="alert">
              That's {formatNaira(check.pot - amount)} less than the full pot. Pay out anyway? The rest stays owed to {name}.
            </p>
          )}
          <button type="submit" className="btn btn-accent btn-block" disabled={amount === null}>
            {confirmShort ? `Yes, pay out ${amount !== null ? formatNaira(amount) : ''}` : `Pay out to ${name}`}
          </button>
        </form>
      )}
    </div>
  )
}
