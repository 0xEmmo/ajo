import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { A } from '../crdt/automerge'
import type { CircleDoc } from '../crdt/circleDoc'
import type { QueuedEdit } from '../crdt/seed'

interface AjoSchema extends DBSchema {
  docs: { key: string; value: Uint8Array }
  meta: { key: string; value: unknown }
}

export type Db = IDBPDatabase<AjoSchema>

export const deviceDbName = (deviceId: string) => `ajo-device-${deviceId}`
export const RELAY_DB = 'ajo-relay'

export function openStore(name: string): Promise<Db> {
  return openDB<AjoSchema>(name, 1, {
    upgrade(db) {
      db.createObjectStore('docs')
      db.createObjectStore('meta')
    },
  })
}

export async function readAll(db: Db): Promise<Map<string, CircleDoc>> {
  const tx = db.transaction('docs')
  const keys = await tx.store.getAllKeys()
  const values = await tx.store.getAll()
  await tx.done
  return new Map(keys.map((k, i) => [k, A.load(values[i]!)]))
}

export async function readDoc(db: Db, id: string): Promise<CircleDoc | undefined> {
  const bytes = await db.get('docs', id)
  return bytes ? A.load(bytes) : undefined
}

/**
 * Merge-on-write. Another tab (same phone, or the relay's other clients) may
 * have written since we last read, so we never overwrite: we merge what's
 * stored into what we have and store the union. The merge is synchronous, so
 * it all happens inside one IndexedDB transaction.
 */
export async function mergeInto(db: Db, id: string, doc: CircleDoc): Promise<{ doc: CircleDoc; changed: boolean }> {
  const tx = db.transaction('docs', 'readwrite')
  const stored = await tx.store.get(id)
  let merged = doc
  let changed = true
  if (stored) {
    const theirs = A.load<CircleDoc>(stored)
    merged = A.merge(A.clone(doc), theirs)
    changed = !sameHeads(A.getHeads(merged), A.getHeads(theirs))
  }
  if (changed) await tx.store.put(A.save(merged), id)
  await tx.done
  return { doc: merged, changed }
}

export async function deleteDoc(db: Db, id: string): Promise<void> {
  await db.delete('docs', id)
}

export function sameHeads(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((h) => set.has(h))
}

export interface DeviceSettings {
  /** The demo's airplane-mode switch. Real connectivity still applies on top. */
  signal: boolean
  lastSyncedAt?: string
  seeded?: boolean
  tipDismissed?: boolean
  /** circleId -> which member this phone belongs to in that circle. */
  me: Record<string, string>
}

export const defaultSettings: DeviceSettings = { signal: true, me: {} }

export async function readSettings(db: Db): Promise<DeviceSettings> {
  return { ...defaultSettings, ...((await db.get('meta', 'settings')) as Partial<DeviceSettings> | undefined) }
}

export async function writeSettings(db: Db, settings: DeviceSettings): Promise<void> {
  await db.put('meta', settings, 'settings')
}

export async function readQueue(db: Db): Promise<QueuedEdit[]> {
  return ((await db.get('meta', 'queue')) as QueuedEdit[] | undefined) ?? []
}

export async function writeQueue(db: Db, queue: QueuedEdit[]): Promise<void> {
  await db.put('meta', queue, 'queue')
}

export function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => resolve()
  })
}
