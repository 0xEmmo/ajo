import { recordPayment } from '../crdt/circleDoc'
import { findConflicts } from '../crdt/conflicts'
import { COORDINATOR_DEVICE, DEMO_CIRCLE_ID, DEMO_DEVICE } from '../crdt/seed'
import { payment } from '../test/fixtures'
import { deleteDatabase } from './storage'
import { Engine, type EngineEvent } from './engine'

const now = () => new Date(2026, 9, 11, 8, 54)

async function wipe() {
  for (const n of ['ajo-relay', `ajo-device-${DEMO_DEVICE}`, `ajo-device-${COORDINATOR_DEVICE}`, 'ajo-device-tunde']) await deleteDatabase(n)
}

async function phone(deviceId: string) {
  const e = new Engine({ deviceId, now })
  await e.init()
  return e
}

const until = async (check: () => boolean, ms = 2000) => {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timed out')
    await new Promise((r) => setTimeout(r, 10))
  }
}

describe('sync engine', () => {
  beforeEach(wipe)

  it("starts Kemi's phone offline with three edits waiting", async () => {
    const kemi = await phone(DEMO_DEVICE)
    const s = kemi.getState()
    expect(s.ready).toBe(true)
    expect(s.settings.signal).toBe(false)
    expect(s.queue.map((q) => q.label)).toEqual(['Ngozi paid ₦20,000 for week 7', 'Mama Bisi paid ₦20,000 for week 7', 'Funke week 5 set to ₦10,000'])
    kemi.close()
  })

  it('keeps edits on the phone while offline and survives a restart', async () => {
    let kemi = await phone(DEMO_DEVICE)
    await kemi.edit(DEMO_CIRCLE_ID, { label: 'Funke paid ₦20,000 for week 7', detail: 'Cash' }, (d) =>
      recordPayment(d, 'funke', 7, payment(20000, '2026-10-11')),
    )
    expect(kemi.getState().queue).toHaveLength(4)
    kemi.close()
    kemi = await phone(DEMO_DEVICE)
    expect(kemi.getState().queue).toHaveLength(4)
    expect(kemi.getState().docs[DEMO_CIRCLE_ID]!.payments['funke:7']?.amount).toBe(20000)
    kemi.close()
  })

  it('flushes the queue on reconnect and reports the clash it finds', async () => {
    const kemi = await phone(DEMO_DEVICE)
    const events: EngineEvent[] = []
    kemi.onEvent((e) => events.push(e))
    await kemi.setSignal(true)
    expect(kemi.getState().queue).toEqual([])
    const conflicts = findConflicts(kemi.getState().docs[DEMO_CIRCLE_ID]!)
    expect(conflicts.map((c) => c.key)).toEqual(['funke:5'])
    expect(events.map((e) => e.type)).toEqual(['conflicts-arrived', 'synced'])
    kemi.close()
  })

  it("gets Kemi's edits to Iya Sade's phone through the relay", async () => {
    const kemi = await phone(DEMO_DEVICE)
    const iya = await phone(COORDINATOR_DEVICE)
    expect(iya.getState().docs[DEMO_CIRCLE_ID]!.payments['ngozi:7']).toBeUndefined()
    await kemi.setSignal(true)
    await until(() => !!iya.getState().docs[DEMO_CIRCLE_ID]?.payments['ngozi:7'])
    expect(findConflicts(iya.getState().docs[DEMO_CIRCLE_ID]!)).toHaveLength(1)
    kemi.close()
    iya.close()
  })

  it('lets a new phone join from the relay but not while offline', async () => {
    const kemi = await phone(DEMO_DEVICE)
    const tunde = await phone('tunde')
    expect(Object.keys(tunde.getState().docs)).toEqual([])
    expect(await tunde.lookup('nope')).toBeNull()
    await tunde.join(DEMO_CIRCLE_ID, 'halima')
    expect(tunde.getState().settings.me[DEMO_CIRCLE_ID]).toBe('halima')
    await tunde.setSignal(false)
    expect(await tunde.lookup('another')).toBe('offline')
    kemi.close()
    tunde.close()
  })
})
