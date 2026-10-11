import { useId, useState, type FormEvent } from 'react'
import { clearPayment, recordPayment } from '../crdt/circleDoc'
import { cellFor, currentRound, roundDate } from '../domain/ledger'
import { daysBetween, formatWithDay, plural } from '../domain/dates'
import { formatNaira, parseNaira } from '../domain/money'
import { firstName } from '../domain/names'
import { cellKey, type Payment, type PaymentMethod } from '../domain/types'
import { useEngine, useEngineState } from '../app/engineContext'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../ui/toastContext'
import { useCircleView } from './circleContext'
import { methodName, roundWord, stateName } from './labels'

interface Props {
  target: { memberId?: string; round?: number } | null
  onClose: () => void
}

export function PaymentSheet({ target, onClose }: Props) {
  return (
    <Sheet open={!!target} onClose={onClose} title={target?.memberId && target.round ? 'Record payment' : 'Record a payment'}>
      {target && <PaymentForm key={`${target.memberId}:${target.round}`} target={target} onDone={onClose} />}
    </Sheet>
  )
}

function PaymentForm({ target, onDone }: { target: NonNullable<Props['target']>; onDone: () => void }) {
  const engine = useEngine()
  const { deviceId } = useEngineState()
  const { circle, today } = useCircleView()
  const toast = useToast()
  const ids = { amount: useId(), ref: useId(), date: useId(), note: useId(), member: useId(), round: useId() }
  const now = Math.max(1, currentRound(circle, today))
  const word = roundWord(circle)

  const fixed = !!(target.memberId && target.round)
  const firstDue = circle.order.find((id) => !circle.payments[cellKey(id, now)]) ?? circle.order[0]!
  const [memberId, setMemberId] = useState(target.memberId ?? firstDue)
  const [round, setRound] = useState(target.round ?? now)
  const existing = circle.payments[cellKey(memberId, round)]

  const [amountText, setAmountText] = useState(String(existing?.amount ?? circle.amount))
  const [method, setMethod] = useState<PaymentMethod>(existing?.method ?? 'cash')
  const [ref, setRef] = useState(existing?.ref ?? '')
  const [paidOn, setPaidOn] = useState(existing?.paidOn ?? (daysBetween(roundDate(circle, round), today) >= 0 ? today : roundDate(circle, round)))
  const [note, setNote] = useState(existing?.note ?? '')
  const [touched, setTouched] = useState(false)

  const member = circle.members[memberId]!
  const amount = parseNaira(amountText)
  const amountError = touched && amount === null ? 'Enter an amount, like 20,000 or 20k.' : null
  const dateError = daysBetween(today, paidOn) > 0 ? "That date hasn't happened yet." : null

  const preview =
    amount !== null
      ? cellFor({ ...circle, payments: { ...circle.payments, [cellKey(memberId, round)]: { amount, method, paidOn, recordedBy: deviceId, recordedAt: '' } } }, memberId, round, today)
      : null
  const over = amount !== null && amount > circle.amount ? amount - circle.amount : 0

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (amount === null || dateError) return
    const payment: Payment = {
      amount,
      method,
      paidOn,
      ref: ref.trim() || undefined,
      note: note.trim() || undefined,
      recordedBy: deviceId,
      recordedAt: new Date().toISOString(),
    }
    const previous = existing
    const who = firstName(member.name)
    await engine.edit(
      circle.id,
      {
        label: `${who} paid ${formatNaira(amount)} for ${word} ${round}`,
        detail: [capitalise(methodName[method]), payment.ref && `ref ${payment.ref}`, payment.note].filter(Boolean).join(' · '),
        key: cellKey(memberId, round),
      },
      (doc) => recordPayment(doc, memberId, round, payment),
    )
    onDone()
    toast(`Saved ${who}'s ${formatNaira(amount)} on this phone`, {
      action: {
        label: 'Undo',
        run: () =>
          void engine.edit(circle.id, { label: `Undid ${who}'s ${word} ${round} payment`, detail: 'Undo', key: cellKey(memberId, round) }, (doc) =>
            previous ? recordPayment(doc, memberId, round, previous) : clearPayment(doc, memberId, round),
          ),
      },
    })
  }

  const clear = async () => {
    const who = firstName(member.name)
    await engine.edit(circle.id, { label: `Cleared ${who}'s ${word} ${round}`, detail: 'Square emptied', key: cellKey(memberId, round) }, (doc) =>
      clearPayment(doc, memberId, round),
    )
    onDone()
    toast(`Cleared ${who}'s ${word} ${round}`)
  }

  return (
    <form className="pay-form" onSubmit={submit} noValidate>
      {fixed ? (
        <p className="pay-target">
          <b>{member.name}</b>
          <span className="muted">
            {' '}
            · {word} {round} · {formatWithDay(roundDate(circle, round))}
          </span>
        </p>
      ) : (
        <div className="pay-pickers">
          <label className="field" htmlFor={ids.member}>
            <span>Member</span>
            <select id={ids.member} className="input" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              {circle.order.map((id) => (
                <option key={id} value={id}>
                  {circle.members[id]!.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field" htmlFor={ids.round}>
            <span>For</span>
            <select id={ids.round} className="input" value={round} onChange={(e) => setRound(Number(e.target.value))}>
              {circle.order.map((_, i) => (
                <option key={i} value={i + 1}>
                  {capitalise(word)} {i + 1} · {formatWithDay(roundDate(circle, i + 1))}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="field">
        <label htmlFor={ids.amount}>
          <span>Amount</span>
        </label>
        <div className="chips" role="group" aria-label="Quick amounts">
          {[circle.amount, circle.amount / 2, circle.amount * 2].map((v) => (
            <button key={v} type="button" className="chip num" aria-pressed={amount === v} onClick={() => setAmountText(String(v))}>
              {formatNaira(v)}
            </button>
          ))}
        </div>
        <input
          id={ids.amount}
          className="input money"
          inputMode="decimal"
          autoComplete="off"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={!!amountError}
          aria-describedby={`${ids.amount}-hint`}
        />
        <small id={`${ids.amount}-hint`} className={amountError ? 'error' : undefined}>
          {amountError ??
            (preview
              ? `Shows as ${stateName[preview.state].toLowerCase()}${preview.state === 'late' ? `, ${plural(preview.daysLate!, 'day')} after contribution day` : ''}${over ? `. The extra ${formatNaira(over)} counts towards anything missed.` : '.'}`
              : '')}
        </small>
      </div>

      <fieldset className="field">
        <legend>How they paid</legend>
        <div className="segmented">
          {(['cash', 'transfer', 'pos'] as const).map((m) => (
            <label key={m}>
              <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} />
              <span>{capitalise(methodName[m])}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="pay-pickers">
        <label className="field" htmlFor={ids.date}>
          <span>Paid on</span>
          <input id={ids.date} type="date" className="input" value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value)} aria-invalid={!!dateError} />
          {dateError && <small className="error">{dateError}</small>}
        </label>
        {method !== 'cash' && (
          <label className="field" htmlFor={ids.ref}>
            <span>Reference</span>
            <input id={ids.ref} className="input num" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Last 4 digits" autoComplete="off" />
          </label>
        )}
      </div>

      <label className="field" htmlFor={ids.note}>
        <span>Note</span>
        <input id={ids.note} className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional, e.g. paid at the stall" />
      </label>

      <div className="pay-actions">
        {existing && (
          <button type="button" className="btn btn-danger" onClick={() => void clear()}>
            Clear square
          </button>
        )}
        <button type="submit" className="btn btn-primary grow">
          {existing ? 'Save changes' : 'Save payment'}
        </button>
      </div>
      <p className="pay-foot muted">Saved on this phone straight away. It syncs when you have signal.</p>
    </form>
  )
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
