import { Mark } from '../ui/Mark'
import './boot.css'

/** First paint while the ledger engine loads, and the screen we show if storage is unavailable. */
export function Boot({ error }: { error?: string }) {
  if (error) {
    return (
      <main className="boot boot-error">
        <Mark size={40} />
        <h1 className="display">Ajo can't open its storage</h1>
        <p>
          This browser isn't letting Ajo save anything on the device, so it can't keep your ledger. Private browsing modes often do this. Try a normal window, or another browser.
        </p>
        <pre className="num">{error}</pre>
        <button type="button" className="btn btn-primary" onClick={() => location.reload()}>
          Try again
        </button>
      </main>
    )
  }
  return (
    <main className="boot" aria-busy="true">
      <Mark size={40} />
      <p className="muted">Opening your ledger…</p>
    </main>
  )
}
