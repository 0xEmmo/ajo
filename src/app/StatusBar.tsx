import { useEngine, useEngineState } from './engineContext'
import { formatWhen, plural } from '../domain/dates'
import { Icon } from '../ui/Icon'
import './statusbar.css'

/** The strip at the very top. It always says where your changes are. */
export function StatusBar() {
  const engine = useEngine()
  const { queue, settings, networkOnline, syncing, syncError } = useEngineState()
  const online = networkOnline && settings.signal
  const waiting = queue.length
  const last = settings.lastSyncedAt ? `Last synced ${formatWhen(settings.lastSyncedAt)}` : 'Not synced yet'

  if (!online) {
    return (
      <div className="statusbar is-offline" role="region" aria-label="Connection">
        <Icon name="offline" size={18} className="sb-icon" />
        <p className="sb-main">
          <b>You're offline.</b> <span className="sb-hide-sm">Everything still works.</span>
          {waiting > 0 && <span className="sb-pill num">{plural(waiting, 'change')} waiting to sync</span>}
        </p>
        <p className="sb-meta">
          {last} · Saved on this phone
        </p>
        {networkOnline ? (
          <button type="button" className="btn btn-small btn-on-ink sb-action" onClick={() => void engine.setSignal(true)}>
            Reconnect
          </button>
        ) : (
          <span className="sb-meta sb-action">No network on this device</span>
        )}
      </div>
    )
  }

  return (
    <div className="statusbar is-online" role="region" aria-label="Connection">
      {syncing ? <span className="spinner" aria-hidden="true" /> : <span className={`sb-dot${syncError ? ' is-error' : ''}`} aria-hidden="true" />}
      <p className="sb-main" aria-live="polite">
        {syncError ? (
          <b>Couldn't reach the relay.</b>
        ) : syncing ? (
          <b>{waiting > 0 ? `Sending ${plural(waiting, 'change')}…` : 'Checking for changes…'}</b>
        ) : waiting > 0 ? (
          <b>{plural(waiting, 'change')} waiting to sync</b>
        ) : (
          <b>All changes synced</b>
        )}
      </p>
      <p className="sb-meta">{last}</p>
      {syncError ? (
        <button type="button" className="btn btn-small btn-on-ink sb-action" onClick={() => void engine.sync()}>
          Try again
        </button>
      ) : (
        <button type="button" className="btn btn-small btn-on-ink sb-action" onClick={() => void engine.setSignal(false)}>
          Go offline
        </button>
      )}
    </div>
  )
}
