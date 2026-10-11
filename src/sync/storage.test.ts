import { A } from '../crdt/automerge'
import { createCircleDoc, recordPayment } from '../crdt/circleDoc'
import { payment, smallCircle } from '../test/fixtures'
import { mergeInto, openStore, readAll, readQueue, readSettings, writeQueue, writeSettings } from './storage'

let n = 0
const fresh = () => openStore(`test-${++n}`)

describe('storage', () => {
  it('stores and reads documents', async () => {
    const db = await fresh()
    const doc = createCircleDoc(smallCircle())
    await mergeInto(db, 'c1', doc)
    const all = await readAll(db)
    expect([...all.keys()]).toEqual(['c1'])
    expect(all.get('c1')!.name).toBe('Test circle')
  })

  it('merges with whatever another tab already wrote', async () => {
    const db = await fresh()
    const base = createCircleDoc(smallCircle())
    const tabA = recordPayment(A.clone(base), 'dayo', 1, payment(20000, '2026-08-29')).doc
    const tabB = recordPayment(A.clone(base), 'chi', 2, payment(20000, '2026-09-05')).doc
    await mergeInto(db, 'c1', tabA)
    const { doc, changed } = await mergeInto(db, 'c1', tabB)
    expect(changed).toBe(true)
    expect(Object.keys(doc.payments)).toEqual(expect.arrayContaining(['dayo:1', 'chi:2']))
    const again = await mergeInto(db, 'c1', doc)
    expect(again.changed).toBe(false)
  })

  it('keeps settings and the queue', async () => {
    const db = await fresh()
    expect(await readSettings(db)).toEqual({ signal: true, me: {} })
    await writeSettings(db, { signal: false, me: { c1: 'ada' } })
    expect((await readSettings(db)).signal).toBe(false)
    await writeQueue(db, [{ hash: 'h', circleId: 'c1', label: 'x', detail: 'y', at: 'z' }])
    expect(await readQueue(db)).toHaveLength(1)
  })
})
