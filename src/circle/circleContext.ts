import { createContext, useContext } from 'react'
import type { CircleDoc } from '../crdt/circleDoc'
import type { Conflict } from '../crdt/conflicts'
import type { Circle } from '../domain/types'

export interface CircleView {
  doc: CircleDoc
  circle: Circle
  conflicts: Conflict[]
  /** Member this phone belongs to, if it has said. */
  meId?: string
  today: string
  openPayment: (target?: { memberId?: string; round?: number }) => void
  openPayout: (round: number) => void
  openInvite: () => void
  openConflict: (key: string) => void
}

export const CircleContext = createContext<CircleView | null>(null)

export function useCircleView(): CircleView {
  const v = useContext(CircleContext)
  if (!v) throw new Error('useCircleView outside a circle')
  return v
}
