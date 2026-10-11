import { useId, useState } from 'react'
import { useNavigate } from 'react-router'
import { useEngine, useEngineState } from '../app/engineContext'
import { deviceOwner, secondPhoneFor } from '../app/devices'
import { useInstall } from '../app/useInstall'
import { DEMO_CIRCLE_ID } from '../crdt/seed'
import { formatWhen } from '../domain/dates'
import { Icon } from '../ui/Icon'
import { Sheet } from '../ui/Sheet'
import { useCircleView } from './circleContext'
import { ConflictCard } from './ConflictCard'
import { SyncQueue } from './SyncQueue'
import './pages.css'

export function SyncPage() {
  const engine = useEngine()
  const navigate = useNavigate()
  const { deviceId, settings, networkOnline, syncing } = useEngineState()
  const { circle, conflicts } = useCircleView()
  const { canInstall, install, standalone } = useInstall()
  const [confirm, setConfirm] = useState<'reset' | 'leave' | null>(null)
  const switchId = useId()
  const online = networkOnline && settings.signal
  const other = secondPhoneFor(deviceId)
  const otherUrl = circle.id === DEMO_CIRCLE_ID ? `/c/${circle.id}?device=${other}` : `/join/${circle.id}?device=second-phone`

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="display">Sync</h1>
          <p className="muted">Every change is saved on this phone first. When there's signal, it goes to the relay and on to everyone else's phone.</p>
        </div>
      </header>

      <div className="sync-grid">
        <div className="stack">
          <section className="card device-card" aria-labelledby="device-title">
            <h2 id="device-title" className="eyebrow">
              <Icon name="phone" size={18} /> {deviceOwner(deviceId)}'s phone
            </h2>
            <label className="switch" htmlFor={switchId}>
              <input id={switchId} type="checkbox" role="switch" checked={settings.signal} onChange={(e) => void engine.setSignal(e.target.checked)} />
              <span className="track" aria-hidden="true" />
              Signal {settings.signal ? 'on' : 'off'}
            </label>
            <dl className="device-facts">
              <dt>Network</dt>
              <dd>{networkOnline ? 'Connected' : 'No network on this device'}</dd>
              <dt>Status</dt>
              <dd aria-live="polite">{!online ? 'Offline, saving here' : syncing ? 'Syncing…' : 'Up to date'}</dd>
              <dt>Last synced</dt>
              <dd>{settings.lastSyncedAt ? formatWhen(settings.lastSyncedAt) : 'Never'}</dd>
            </dl>
            <div className="row">
              <button type="button" className="btn btn-small" disabled={!online || syncing} onClick={() => void engine.sync()}>
                <Icon name="sync" size={16} /> Sync now
              </button>
              {canInstall && (
                <button type="button" className="btn btn-small" onClick={() => void install()}>
                  <Icon name="install" size={16} /> Install Ajo
                </button>
              )}
              {standalone && <span className="muted">Installed on this device</span>}
            </div>
          </section>

          {conflicts.length > 0 ? (
            conflicts.map((c) => <ConflictCard key={c.key} conflict={c} headingLevel={2} />)
          ) : (
            <p className="card all-clear">
              <Icon name="check" size={20} /> No clashes. Every square has one version.
            </p>
          )}

          <SyncQueue />
        </div>

        <div className="stack">
          <section className="card" aria-labelledby="two-title">
            <h2 id="two-title" className="eyebrow">
              Try it with two phones
            </h2>
            <p className="card-text">
              Open {deviceOwner(other)}'s phone in a new tab. It keeps its own storage, so you can switch either one offline, edit the same square on both, and watch the clash appear when they reconnect.
            </p>
            <a className="btn btn-primary btn-small card-cta" href={otherUrl} target="_blank" rel="noopener">
              Open {deviceOwner(other)}'s phone <Icon name="external" size={15} />
            </a>
          </section>

          <section className="card" aria-labelledby="how-title">
            <h2 id="how-title" className="eyebrow">
              How syncing works here
            </h2>
            <ul className="how">
              <li>Each phone keeps the whole circle as an Automerge document in IndexedDB, so nothing needs the network to work.</li>
              <li>There's no server in this demo. A separate in-browser database stands in for the relay, and BroadcastChannel tells other tabs when it changes.</li>
              <li>Edits to different squares merge cleanly. If two phones change the same square while apart, both versions are kept and you choose.</li>
            </ul>
          </section>

          <section className="card danger-zone" aria-labelledby="danger-title">
            <h2 id="danger-title" className="eyebrow">
              Start over
            </h2>
            <p>Leaving only removes the circle from this phone. Resetting wipes every phone in this browser and brings the demo back.</p>
            <div className="row">
              <button type="button" className="btn btn-small btn-danger" onClick={() => setConfirm('leave')}>
                Leave this circle
              </button>
              <button type="button" className="btn btn-small btn-danger" onClick={() => setConfirm('reset')}>
                <Icon name="reset" size={16} /> Reset demo data
              </button>
            </div>
          </section>
        </div>
      </div>

      <Sheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === 'reset' ? 'Reset all demo data?' : `Leave ${circle.name}?`}
        description={
          confirm === 'reset'
            ? 'Every circle on every phone in this browser is deleted, including anything not synced. The demo circle comes back as new.'
            : 'The circle is removed from this phone only. Other members keep it, and you can join again with the invite link.'
        }
        footer={
          <>
            <button type="button" className="btn" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-destructive"
              onClick={async () => {
                if (confirm === 'reset') {
                  await engine.resetEverything()
                  location.replace('/')
                } else {
                  await engine.leave(circle.id)
                  navigate('/')
                }
              }}
            >
              {confirm === 'reset' ? 'Reset everything' : 'Leave circle'}
            </button>
          </>
        }
      >
        {confirm === 'leave' && settings.signal === false && <p className="note">This phone is offline, so changes still waiting to sync will be lost.</p>}
      </Sheet>
    </div>
  )
}
