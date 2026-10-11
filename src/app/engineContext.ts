import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { Engine } from '../sync/engine'
import { snapshot } from '../crdt/circleDoc'
import { findConflicts } from '../crdt/conflicts'
import { today, type ISODate } from '../domain/dates'

export const EngineContext = createContext<Engine | null>(null)

export function useEngine(): Engine {
  const engine = useContext(EngineContext)
  if (!engine) throw new Error('useEngine outside EngineContext')
  return engine
}

export function useEngineState() {
  const engine = useEngine()
  return useSyncExternalStore(engine.subscribe, engine.getState)
}

export function useOnline(): boolean {
  const s = useEngineState()
  return s.networkOnline && s.settings.signal
}

export function useCircle(circleId: string | undefined) {
  const { docs } = useEngineState()
  const doc = circleId ? docs[circleId] : undefined
  return useMemo(() => (doc ? { doc, circle: snapshot(doc), conflicts: findConflicts(doc) } : null), [doc])
}

/** Today's date, refreshed when the tab comes back or the day rolls over. */
export function useToday(): ISODate {
  const [day, setDay] = useState(today)
  useEffect(() => {
    const check = () => setDay(today())
    const timer = setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
  return day
}
