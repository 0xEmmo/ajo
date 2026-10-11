import { useMemo } from 'react'
import { useEngineState } from '../app/engineContext'

export function visibleRounds(total: number, now: number): number[] {
  const upTo = Math.min(total, Math.max(1, now))
  return Array.from({ length: upTo }, (_, i) => i + 1)
}

export function usePendingKeys(circleId: string) {
  const { queue } = useEngineState()
  return useMemo(() => new Set(queue.filter((q) => q.circleId === circleId && q.key).map((q) => q.key!)), [queue, circleId])
}
