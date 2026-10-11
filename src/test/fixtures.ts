import type { Circle, Payment } from '../domain/types'
import { cellKey } from '../domain/types'

export function payment(amount: number, paidOn: string, extra: Partial<Payment> = {}): Payment {
  return { amount, method: 'cash', paidOn, recordedBy: 'test', recordedAt: `${paidOn}T09:00:00.000Z`, ...extra }
}

/** Four members, ₦20,000 weekly from Sat 29 Aug 2026. */
export function smallCircle(): Circle {
  const ids = ['ada', 'bola', 'chi', 'dayo']
  return {
    id: 'test-circle',
    name: 'Test circle',
    amount: 20000,
    frequency: 'weekly',
    startDate: '2026-08-29',
    coordinatorId: 'ada',
    createdAt: '2026-08-20T10:00:00.000Z',
    members: Object.fromEntries(ids.map((id) => [id, { id, name: id[0]!.toUpperCase() + id.slice(1), joinedOn: '2026-08-20' }])),
    order: ids,
    payments: {
      [cellKey('ada', 1)]: payment(20000, '2026-08-29'),
      [cellKey('bola', 1)]: payment(20000, '2026-08-31'),
      [cellKey('chi', 1)]: payment(10000, '2026-08-29'),
      [cellKey('ada', 2)]: payment(40000, '2026-09-05'),
    },
    payouts: {},
  }
}
