import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useEngine, useEngineState, useToday } from '../app/engineContext'
import { addMember, snapshot, type CircleDoc } from '../crdt/circleDoc'
import { formatNaira } from '../domain/money'
import { plural } from '../domain/dates'
import { slugId } from '../domain/names'
import { Avatar } from '../ui/Avatar'
import { Icon } from '../ui/Icon'
import './pages.css'

type Lookup = { state: 'loading' } | { state: 'offline' } | { state: 'missing' } | { state: 'found'; doc: CircleDoc }

export function Join() {
  const { circleId } = useParams()
  return circleId ? <JoinCircle key={circleId} circleId={circleId} /> : <EnterCode />
}

function EnterCode() {
  const navigate = useNavigate()
  const id = useId()
  const [code, setCode] = useState('')
  const [tried, setTried] = useState(false)
  const clean = code
    .trim()
    .toLowerCase()
    .replace(/^.*\/join\//, '')
  const error = tried && !/^[a-z0-9-]{3,40}$/.test(clean) ? 'Codes look like ikeja-market-women or oja-oba-k3x9. You can also paste the whole link.' : null
  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (/^[a-z0-9-]{3,40}$/.test(clean)) navigate(`/join/${clean}`)
  }
  return (
    <main id="main" className="page-narrow wizard">
      <Link to="/" className="back">
        <Icon name="back" size={18} /> Your circles
      </Link>
      <h1 className="display">Join a circle</h1>
      <p className="muted">Ask your coordinator for the code or link, or scan their QR code with your camera.</p>
      <form className="wizard-body" onSubmit={submit} noValidate>
        <label className="field" htmlFor={id}>
          <span>Circle code or invite link</span>
          <input
            id={id}
            className="input num"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!error}
          />
          {error && <small className="error">{error}</small>}
        </label>
        <div className="wizard-nav">
          <button type="submit" className="btn btn-primary">
            Find circle
          </button>
        </div>
      </form>
    </main>
  )
}

function JoinCircle({ circleId }: { circleId: string }) {
  const engine = useEngine()
  const { docs, settings, networkOnline } = useEngineState()
  const navigate = useNavigate()
  const today = useToday()
  const [lookup, setLookup] = useState<Lookup>({ state: 'loading' })
  const [who, setWho] = useState<string>('')
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [tried, setTried] = useState(false)
  const nameId = useId()
  const alreadyHere = !!docs[circleId]
  const online = networkOnline && settings.signal

  useEffect(() => {
    let live = true
    void engine.lookup(circleId).then((r) => {
      if (!live) return
      setLookup(r === 'offline' ? { state: 'offline' } : r === null ? { state: 'missing' } : { state: 'found', doc: r })
    })
    return () => {
      live = false
    }
  }, [engine, circleId, online])

  if (alreadyHere && settings.me[circleId]) {
    return (
      <main id="main" className="page-narrow wizard">
        <h1 className="display">You're already in this circle</h1>
        <p>
          <Link className="btn btn-primary" to={`/c/${circleId}`}>
            Open the ledger
          </Link>
        </p>
      </main>
    )
  }

  if (lookup.state === 'loading') {
    return (
      <main id="main" className="page-narrow wizard" aria-busy="true">
        <h1 className="display">Looking for the circle…</h1>
        <p className="muted">
          Checking the relay for <code className="num">{circleId}</code>.
        </p>
      </main>
    )
  }

  if (lookup.state === 'offline') {
    return (
      <main id="main" className="page-narrow wizard">
        <h1 className="display">Joining needs signal, once</h1>
        <p>This phone is offline, so it can't fetch the circle yet. After you've joined, everything works offline.</p>
        <div className="row">
          {networkOnline && (
            <button type="button" className="btn btn-primary" onClick={() => void engine.setSignal(true)}>
              Reconnect
            </button>
          )}
          <Link className="btn" to="/">
            Not now
          </Link>
        </div>
      </main>
    )
  }

  if (lookup.state === 'missing') {
    return (
      <main id="main" className="page-narrow wizard">
        <h1 className="display">No circle with that code</h1>
        <p>
          Nothing called <code className="num">{circleId}</code> has reached the relay. Check the code with your coordinator, or ask them to open Ajo while they
          have signal so it can sync.
        </p>
        <p className="muted small">In this demo the relay lives in this browser, so invite links only work between tabs of the same browser.</p>
        <div className="row">
          <Link className="btn btn-primary" to="/join">
            Try another code
          </Link>
          <Link className="btn" to="/">
            Your circles
          </Link>
        </div>
      </main>
    )
  }

  const circle = snapshot(lookup.doc)
  const coordinator = circle.members[circle.coordinatorId]
  const nameTaken = Object.values(circle.members).some((m) => m.name.toLowerCase() === newName.trim().toLowerCase())
  const nameError =
    tried && who === 'new' && (!newName.trim() ? 'Add your name.' : nameTaken ? 'That name is already in the circle; pick yourself above instead.' : null)

  const join = async (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!who || nameError || (who === 'new' && (!newName.trim() || nameTaken))) return
    setBusy(true)
    if (who === 'new') {
      const id = slugId(newName.trim())
      await engine.join(circleId, id, (doc) => addMember(doc, { id, name: newName.trim(), joinedOn: today }))
    } else {
      await engine.join(circleId, who)
    }
    navigate(`/c/${circleId}`, { replace: true })
  }

  return (
    <main id="main" className="page-narrow wizard">
      <p className="label-caps">You're invited to</p>
      <h1 className="display">{circle.name}</h1>
      <p className="muted">
        {formatNaira(circle.amount)} {circle.frequency} · {plural(circle.order.length, 'member')}
        {coordinator && ` · run by ${coordinator.name}`}
      </p>
      <form className="wizard-body" onSubmit={join} noValidate>
        <fieldset className="field">
          <legend>Which one is you?</legend>
          <ul className="pick-list">
            {circle.order.map((id) => {
              const m = circle.members[id]!
              return (
                <li key={id}>
                  <label className="pick">
                    <input type="radio" name="who" value={id} checked={who === id} onChange={() => setWho(id)} />
                    <Avatar member={m} size={36} />
                    <span>{m.name}</span>
                  </label>
                </li>
              )
            })}
            <li>
              <label className="pick">
                <input type="radio" name="who" value="new" checked={who === 'new'} onChange={() => setWho('new')} />
                <span className="pick-new">
                  <Icon name="plus" size={18} />
                </span>
                <span>I'm new to this circle</span>
              </label>
            </li>
          </ul>
          {tried && !who && <small className="error">Choose yourself, or add yourself as new.</small>}
        </fieldset>
        {who === 'new' && (
          <label className="field" htmlFor={nameId}>
            <span>Your name</span>
            <input id={nameId} className="input" value={newName} onChange={(e) => setNewName(e.target.value)} autoComplete="name" aria-invalid={!!nameError} />
            {nameError ? <small className="error">{nameError}</small> : <small>You'll join the end of the rotation.</small>}
          </label>
        )}
        <div className="wizard-nav">
          <button type="submit" className="btn btn-accent" disabled={busy}>
            {busy ? 'Joining…' : 'Join circle'}
          </button>
        </div>
      </form>
    </main>
  )
}
