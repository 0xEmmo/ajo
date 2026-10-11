import type { Cell, CellState } from '../domain/ledger'
import { formatCompact, formatNaira } from '../domain/money'
import { formatWithDay, plural } from '../domain/dates'
import type { Circle, PaymentMethod } from '../domain/types'

export const roundWord = (c: Pick<Circle, 'frequency'>) => (c.frequency === 'weekly' ? 'week' : 'month')
export const roundAbbr = (c: Pick<Circle, 'frequency'>) => (c.frequency === 'weekly' ? 'wk' : 'mo')

export const stateName: Record<CellState, string> = {
  paid: 'Paid',
  late: 'Paid late',
  part: 'Part paid',
  missed: 'Missed',
  due: 'Due',
  upcoming: 'Not yet due',
}

export const methodName: Record<PaymentMethod, string> = {
  cash: 'cash',
  transfer: 'transfer',
  pos: 'POS',
}

/** What's printed inside a square. */
export function cellText(cell: Cell, amount: number): string {
  switch (cell.state) {
    case 'paid':
      return formatCompact(cell.payment!.amount)
    case 'late':
      return `+${plural(cell.daysLate!, 'day')}`
    case 'part':
      return `${formatCompact(cell.payment!.amount)} of ${formatCompact(amount)}`
    case 'missed':
      return 'missed'
    case 'due':
      return 'due'
    case 'upcoming':
      return ''
  }
}

/** What a screen reader hears for a square. */
export function cellLabel(cell: Cell, memberName: string, circle: Circle, extra: { unsynced?: boolean; conflict?: boolean } = {}) {
  const parts = [`${memberName}, ${roundWord(circle)} ${cell.round}, ${formatWithDay(cell.date)}`]
  if (cell.payment) {
    parts.push(`${stateName[cell.state].toLowerCase()} ${formatNaira(cell.payment.amount)}`)
    if (cell.state === 'late') parts.push(`${plural(cell.daysLate!, 'day')} late`)
  } else {
    parts.push(stateName[cell.state].toLowerCase())
  }
  if (extra.conflict) parts.push('two versions to check')
  if (extra.unsynced) parts.push('not synced yet')
  return parts.join(', ')
}
