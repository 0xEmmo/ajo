import { useRegisterSW } from 'virtual:pwa-register/react'
import './update.css'

/** A new build is waiting in the service worker; let the person choose when to reload. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh && !offlineReady) return null

  return (
    <div className="update" role="status">
      {needRefresh ? (
        <>
          <span>A new version of Ajo is ready.</span>
          <button type="button" className="btn btn-small btn-accent" onClick={() => void updateServiceWorker(true)}>
            Reload
          </button>
          <button type="button" className="btn btn-small btn-on-ink" onClick={() => setNeedRefresh(false)}>
            Later
          </button>
        </>
      ) : (
        <>
          <span>Ajo is saved on this device and will open without signal.</span>
          <button type="button" className="btn btn-small btn-on-ink" onClick={() => setOfflineReady(false)}>
            OK
          </button>
        </>
      )}
    </div>
  )
}
