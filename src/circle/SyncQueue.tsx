import { useEngineState } from '../app/engineContext'
import { formatWhen } from '../domain/dates'
import { useCircleView } from './circleContext'
import './queue.css'

export function SyncQueue({ circleOnly = true }: { circleOnly?: boolean }) {
  const { queue, settings, networkOnline, syncing } = useEngineState()
  const { circle, conflicts } = useCircleView()
  const items = circleOnly ? queue.filter((q) => q.circleId === circle.id) : queue
  const conflictKeys = new Set(conflicts.map((c) => c.key))
  const online = networkOnline && settings.signal

  return (
    <section className="queue card" aria-labelledby="queue-title">
      <h3 id="queue-title" className="eyebrow queue-title">
        Waiting to sync <span className="num">{items.length}</span>
      </h3>
      {items.length === 0 ? (
        <p className="queue-empty">Nothing waiting. Every change on this phone has reached the relay.</p>
      ) : (
        <ol className="queue-list">
          {items.map((q) => (
            <li key={q.hash} className={`queue-item${syncing && online ? ' is-sending' : ''}`}>
              <span className="queue-dot" aria-hidden="true" />
              <div>
                {q.label}
                <small>
                  Recorded by you · {q.key && conflictKeys.has(q.key) ? 'has a conflict, see above' : q.detail || 'Saved on this phone'}
                </small>
              </div>
              <time className="num" dateTime={q.at}>
                {formatWhen(q.at)}
              </time>
            </li>
          ))}
        </ol>
      )}
      {items.length > 0 && !online && <p className="queue-note">They'll go as soon as you have signal.</p>}
    </section>
  )
}
