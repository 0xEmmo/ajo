import { useId, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useEngine, useToday } from '../app/engineContext'
import { createCircleDoc } from '../crdt/circleDoc'
import { roundDate } from '../domain/ledger'
import { drawLots, moveInOrder } from '../domain/rotation'
import { addDays, daysBetween, formatWithDay, previousWeekday } from '../domain/dates'
import { formatNaira, parseNaira } from '../domain/money'
import { slugId } from '../domain/names'
import type { Circle, Frequency, Member } from '../domain/types'
import { Avatar } from '../ui/Avatar'
import { Icon } from '../ui/Icon'
import './pages.css'

type Step = 0 | 1 | 2
const steps = ['The basics', 'Who is saving', 'Order of turns']

interface Person {
  id: string
  name: string
}

export function NewCircle() {
  const engine = useEngine()
  const navigate = useNavigate()
  const today = useToday()
  const ids = { name: useId(), amount: useId(), start: useId(), you: useId(), add: useId() }
  const headingRef = useRef<HTMLHeadingElement>(null)

  const [step, setStep] = useState<Step>(0)
  const [name, setName] = useState('')
  const [amountText, setAmountText] = useState('')
  const [frequency, setFrequency] = useState<Frequency>('weekly')
  const [start, setStart] = useState(addDays(previousWeekday(today, 6), 7))
  const [you, setYou] = useState('')
  const [people, setPeople] = useState<Person[]>([])
  const [newName, setNewName] = useState('')
  const [order, setOrder] = useState<string[]>([])
  const [tried, setTried] = useState<Record<number, boolean>>({})
  const [saving, setSaving] = useState(false)

  const amount = parseNaira(amountText)
  const everyone: Person[] = [{ id: 'you', name: you.trim() || 'You' }, ...people]
  const errors0 = {
    name: !name.trim() ? 'Give the circle a name people will recognise.' : null,
    amount: amount === null ? 'Enter the contribution, like 20,000 or 20k.' : null,
    you: !you.trim() ? 'Add your own name; you are the coordinator.' : null,
    start: daysBetween(addDays(today, -365), start) < 0 ? 'Pick a start date within the last year.' : null,
  }
  const errors1 = { people: people.length < 1 ? 'A circle needs at least two people, you and one more.' : null }
  const valid = step === 0 ? Object.values(errors0).every((e) => !e) : step === 1 ? !errors1.people : true

  const go = (to: Step) => {
    if (to > step) {
      setTried((t) => ({ ...t, [step]: true }))
      if (!valid) return
    }
    if (to === 2) setOrder((o) => (o.length === everyone.length && everyone.every((p) => o.includes(p.id)) ? o : everyone.map((p) => p.id)))
    setStep(to)
    requestAnimationFrame(() => headingRef.current?.focus())
  }

  const addPerson = (e?: FormEvent) => {
    e?.preventDefault()
    const n = newName.trim()
    if (!n) return
    if (everyone.some((p) => p.name.toLowerCase() === n.toLowerCase())) return
    setPeople((p) => [...p, { id: slugId(n), name: n }])
    setNewName('')
  }

  const create = async () => {
    if (amount === null) return
    setSaving(true)
    const youId = slugId(you.trim())
    const realId = (id: string) => (id === 'you' ? youId : id)
    const members: Record<string, Member> = Object.fromEntries(
      everyone.map((p) => [realId(p.id), { id: realId(p.id), name: p.id === 'you' ? you.trim() : p.name, joinedOn: today }]),
    )
    const circle: Circle = {
      id: slugId(name.trim()),
      name: name.trim(),
      amount,
      frequency,
      startDate: start,
      coordinatorId: youId,
      createdAt: new Date().toISOString(),
      members,
      order: order.map(realId),
      payments: {},
      payouts: {},
    }
    await engine.addCircle(createCircleDoc(circle), youId, `Created ${circle.name}`)
    navigate(`/c/${circle.id}`, { replace: true })
  }

  const lastDate = roundDate({ startDate: start, frequency }, Math.max(1, everyone.length))

  return (
    <main id="main" className="page-narrow wizard">
      <Link to="/" className="back">
        <Icon name="back" size={18} /> Your circles
      </Link>
      <ol className="stepper" aria-label="Steps">
        {steps.map((s, i) => (
          <li key={s} aria-current={i === step ? 'step' : undefined} className={i < step ? 'done' : undefined}>
            <span className="num">{i + 1}</span> {s}
          </li>
        ))}
      </ol>
      <h1 className="display" ref={headingRef} tabIndex={-1}>
        {step === 0 ? 'Start a circle' : step === 1 ? 'Who is saving?' : 'Who collects when?'}
      </h1>

      {step === 0 && (
        <form
          className="wizard-body"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            go(1)
          }}
        >
          <label className="field" htmlFor={ids.name}>
            <span>Circle name</span>
            <input id={ids.name} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Balogun Street Traders" aria-invalid={!!(tried[0] && errors0.name)} />
            {tried[0] && errors0.name && <small className="error">{errors0.name}</small>}
          </label>
          <div className="field-pair">
            <label className="field" htmlFor={ids.amount}>
              <span>Each person pays</span>
              <input id={ids.amount} className="input money" inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="₦20,000" aria-invalid={!!(tried[0] && errors0.amount)} />
              {tried[0] && errors0.amount ? <small className="error">{errors0.amount}</small> : amount !== null && <small>{formatNaira(amount)} each time</small>}
            </label>
            <fieldset className="field">
              <legend>How often</legend>
              <div className="segmented">
                {(['weekly', 'monthly'] as const).map((f) => (
                  <label key={f}>
                    <input type="radio" name="freq" checked={frequency === f} onChange={() => setFrequency(f)} />
                    <span>{f === 'weekly' ? 'Weekly' : 'Monthly'}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <label className="field" htmlFor={ids.start}>
            <span>First contribution day</span>
            <input id={ids.start} type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} aria-invalid={!!(tried[0] && errors0.start)} />
            {tried[0] && errors0.start ? <small className="error">{errors0.start}</small> : <small>{formatWithDay(start)}. Everyone pays on this day each {frequency === 'weekly' ? 'week' : 'month'}.</small>}
          </label>
          <label className="field" htmlFor={ids.you}>
            <span>Your name</span>
            <input id={ids.you} className="input" value={you} onChange={(e) => setYou(e.target.value)} autoComplete="name" aria-invalid={!!(tried[0] && errors0.you)} />
            {tried[0] && errors0.you ? <small className="error">{errors0.you}</small> : <small>You'll be the coordinator. You can add photos later.</small>}
          </label>
          <div className="wizard-nav">
            <button type="submit" className="btn btn-primary">
              Next: members <Icon name="chevron" size={16} />
            </button>
          </div>
        </form>
      )}

      {step === 1 && (
        <div className="wizard-body">
          <form className="add-row" onSubmit={addPerson}>
            <label className="field" htmlFor={ids.add}>
              <span>Add someone</span>
              <input id={ids.add} className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Their name" autoComplete="off" />
            </label>
            <button type="submit" className="btn" disabled={!newName.trim()}>
              Add
            </button>
          </form>
          <ul className="people" aria-label="People in this circle">
            {everyone.map((p) => (
              <li key={p.id}>
                <Avatar member={{ name: p.name }} size={36} />
                <span>
                  {p.name}
                  {p.id === 'you' && <span className="tag you">You</span>}
                </span>
                {p.id !== 'you' && (
                  <button type="button" className="icon-btn" aria-label={`Remove ${p.name}`} onClick={() => setPeople((all) => all.filter((x) => x.id !== p.id))}>
                    <Icon name="close" size={18} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {tried[1] && errors1.people && (
            <p className="error" role="alert">
              {errors1.people}
            </p>
          )}
          <p className="muted small">
            {everyone.length} people means {everyone.length} turns, and a pot of {amount ? formatNaira(amount * everyone.length) : '–'} each time.
          </p>
          <div className="wizard-nav">
            <button type="button" className="btn" onClick={() => go(0)}>
              Back
            </button>
            <button type="button" className="btn btn-primary" onClick={() => go(2)}>
              Next: order <Icon name="chevron" size={16} />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="wizard-body">
          <div className="row">
            <button type="button" className="btn btn-small" onClick={() => setOrder((o) => drawLots(o))}>
              <Icon name="shuffle" size={16} /> Draw lots
            </button>
            <span className="muted small">Or move people with the arrows.</span>
          </div>
          <ol className="people order">
            {order.map((id, i) => {
              const p = everyone.find((x) => x.id === id)!
              return (
                <li key={id}>
                  <span className="num order-n">{i + 1}</span>
                  <Avatar member={{ name: p.name }} size={36} />
                  <span>
                    {p.name}
                    <small className="muted"> {formatWithDay(roundDate({ startDate: start, frequency }, i + 1))}</small>
                  </span>
                  <span className="turn-move">
                    <button type="button" className="icon-btn" aria-label={`Move ${p.name} earlier`} disabled={i === 0} onClick={() => setOrder((o) => moveInOrder(o, i, -1) ?? o)}>
                      <Icon name="up" />
                    </button>
                    <button type="button" className="icon-btn" aria-label={`Move ${p.name} later`} disabled={i === order.length - 1} onClick={() => setOrder((o) => moveInOrder(o, i, 1) ?? o)}>
                      <Icon name="down" />
                    </button>
                  </span>
                </li>
              )
            })}
          </ol>
          <div className="summary card">
            <p>
              <b>{name.trim()}</b>: {formatNaira(amount ?? 0)} {frequency} from {formatWithDay(start)} to {formatWithDay(lastDate)}. Each person collects {formatNaira((amount ?? 0) * everyone.length)} once.
            </p>
          </div>
          <div className="wizard-nav">
            <button type="button" className="btn" onClick={() => go(1)}>
              Back
            </button>
            <button type="button" className="btn btn-accent" disabled={saving} onClick={() => void create()}>
              {saving ? 'Creating…' : 'Create circle'}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
