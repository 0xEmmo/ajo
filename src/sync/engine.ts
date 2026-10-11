import { A } from '../crdt/automerge'
import type { CircleDoc, Edit } from '../crdt/circleDoc'
import { findConflicts, type Conflict } from '../crdt/conflicts'
import { buildDemo, COORDINATOR_DEVICE, DEMO_CIRCLE_ID, DEMO_DEVICE, type QueuedEdit } from '../crdt/seed'
import {
  deleteDatabase,
  deleteDoc,
  deviceDbName,
  mergeInto,
  openStore,
  readAll,
  readDoc,
  readQueue,
  readSettings,
  RELAY_DB,
  writeQueue,
  writeSettings,
  type Db,
  type DeviceSettings,
} from './storage'

export interface EngineState {
  ready: boolean
  fatal?: string
  deviceId: string
  docs: Record<string, CircleDoc>
  queue: QueuedEdit[]
  settings: DeviceSettings
  networkOnline: boolean
  syncing: boolean
  syncError?: string
}

export type EngineEvent =
  | { type: 'conflicts-arrived'; circleId: string; conflicts: Conflict[] }
  | { type: 'synced'; count: number }
  | { type: 'reset' }

export interface EngineOptions {
  deviceId: string
  /** Pretend round trip to the relay so the UI's "sending" state is visible. */
  latencyMs?: number
  now?: () => Date
  networkOnline?: () => boolean
  seedDemo?: boolean
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

type ChannelMessage =
  | { type: 'relay-updated'; circleId: string; from: string }
  | { type: 'device-saved'; circleId: string; from: string }
  | { type: 'reset'; from: string }

/**
 * Owns one phone's copy of every circle. There's no server: the "relay" is a
 * separate IndexedDB database standing in for one, and BroadcastChannel plays
 * the push notification that tells other tabs something new is there. Each
 * tab with a different ?device= is a different phone with its own database.
 */
export class Engine {
  readonly tabId = Math.random().toString(36).slice(2)
  private state: EngineState
  private listeners = new Set<() => void>()
  private eventListeners = new Set<(e: EngineEvent) => void>()
  private device?: Db
  private relay?: Db
  private channel?: BroadcastChannel
  private syncTimer?: ReturnType<typeof setTimeout>
  private syncing?: Promise<void>
  private resyncRequested = false
  private readonly opts: Required<EngineOptions>

  constructor(opts: EngineOptions) {
    this.opts = {
      latencyMs: 0,
      now: () => new Date(),
      networkOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine),
      seedDemo: true,
      ...opts,
    }
    this.state = {
      ready: false,
      deviceId: opts.deviceId,
      docs: {},
      queue: [],
      settings: { signal: true, me: {} },
      networkOnline: this.opts.networkOnline(),
      syncing: false,
    }
  }

  getState = () => this.state

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  onEvent(fn: (e: EngineEvent) => void) {
    this.eventListeners.add(fn)
    return () => this.eventListeners.delete(fn)
  }

  get online() {
    return this.state.networkOnline && this.state.settings.signal
  }

  private set(patch: Partial<EngineState>) {
    this.state = { ...this.state, ...patch }
    for (const fn of this.listeners) fn()
  }

  private emit(e: EngineEvent) {
    for (const fn of this.eventListeners) fn(e)
  }

  async init(): Promise<void> {
    try {
      this.device = await openStore(deviceDbName(this.opts.deviceId))
      this.relay = await openStore(RELAY_DB)
      let settings = await readSettings(this.device)
      if (!settings.seeded && this.opts.seedDemo) settings = await this.seed(settings)
      const docs = Object.fromEntries(await readAll(this.device))
      const queue = await readQueue(this.device)
      this.channel = new BroadcastChannel('ajo')
      this.channel.onmessage = (e: MessageEvent<ChannelMessage>) => this.onMessage(e.data)
      this.set({ ready: true, docs, queue, settings })
      // Don't hold the first paint hostage to the network.
      if (this.online) void this.sync()
    } catch (err) {
      this.set({ fatal: err instanceof Error ? err.message : String(err) })
    }
  }

  close() {
    this.channel?.close()
    clearTimeout(this.syncTimer)
    this.device?.close()
    this.relay?.close()
  }

  private async seed(settings: DeviceSettings): Promise<DeviceSettings> {
    const device = this.device!
    const relay = this.relay!
    const hasDemo = await readDoc(relay, DEMO_CIRCLE_ID)
    const demo = buildDemo(this.opts.now())
    if (!hasDemo) await mergeInto(relay, DEMO_CIRCLE_ID, demo.relay)
    let next: DeviceSettings = { ...settings, seeded: true }
    if (this.opts.deviceId === DEMO_DEVICE && !hasDemo) {
      await mergeInto(device, DEMO_CIRCLE_ID, demo.kemi)
      await writeQueue(device, demo.kemiQueue)
      next = { ...next, signal: false, lastSyncedAt: demo.lastSyncedAt, me: { [DEMO_CIRCLE_ID]: 'kemi' } }
    } else if (this.opts.deviceId === DEMO_DEVICE || this.opts.deviceId === COORDINATOR_DEVICE) {
      const shared = await readDoc(relay, DEMO_CIRCLE_ID)
      if (shared) await mergeInto(device, DEMO_CIRCLE_ID, shared)
      const memberId = this.opts.deviceId === DEMO_DEVICE ? 'kemi' : 'iya-sade'
      next = { ...next, lastSyncedAt: this.opts.now().toISOString(), me: { [DEMO_CIRCLE_ID]: memberId } }
    }
    await writeSettings(device, next)
    return next
  }

  private onMessage(msg: ChannelMessage) {
    if (msg.from === this.tabId) return
    if (msg.type === 'reset') {
      this.emit({ type: 'reset' })
      return
    }
    if (msg.type === 'device-saved' && msg.from.startsWith(`${this.opts.deviceId}/`)) {
      void this.reloadFromDevice()
    }
    if (msg.type === 'relay-updated' && this.online && this.state.docs[msg.circleId]) {
      this.scheduleSync(50)
    }
  }

  private post(msg: DistributiveOmit<ChannelMessage, 'from'>) {
    const from = msg.type === 'device-saved' ? `${this.opts.deviceId}/${this.tabId}` : this.tabId
    this.channel?.postMessage({ ...msg, from })
  }

  /** Another tab on the same phone saved; pick up its docs and queue. */
  private async reloadFromDevice() {
    const device = this.device!
    const docs = { ...this.state.docs }
    for (const [id, stored] of await readAll(device)) {
      docs[id] = docs[id] ? A.merge(A.clone(docs[id]), stored) : stored
    }
    const queue = await readQueue(device)
    const settings = await readSettings(device)
    this.set({ docs, queue, settings })
  }

  /** Apply a local edit: save on this phone first, queue it, then try to send. */
  async edit(circleId: string, item: Omit<QueuedEdit, 'hash' | 'circleId' | 'at'>, run: (doc: CircleDoc) => Edit | null) {
    const current = this.state.docs[circleId]
    if (!current) throw new Error(`No circle ${circleId} on this phone`)
    const result = run(A.clone(current))
    if (!result) return null
    const { doc } = await mergeInto(this.device!, circleId, result.doc)
    const queued: QueuedEdit = { ...item, hash: result.hash, circleId, at: this.opts.now().toISOString() }
    const queue = [...(await readQueue(this.device!)), queued]
    await writeQueue(this.device!, queue)
    this.set({ docs: { ...this.state.docs, [circleId]: doc }, queue })
    this.post({ type: 'device-saved', circleId })
    this.scheduleSync()
    return queued
  }

  async addCircle(doc: CircleDoc, memberId: string, label: string) {
    const id = doc.id
    const { doc: saved } = await mergeInto(this.device!, id, doc)
    const heads = A.getHeads(saved)
    const queued: QueuedEdit = { hash: heads[heads.length - 1]!, circleId: id, label, detail: 'New circle', at: this.opts.now().toISOString() }
    const queue = [...(await readQueue(this.device!)), queued]
    await writeQueue(this.device!, queue)
    await this.updateSettings({ me: { ...this.state.settings.me, [id]: memberId } })
    this.set({ docs: { ...this.state.docs, [id]: saved }, queue })
    this.post({ type: 'device-saved', circleId: id })
    this.scheduleSync()
  }

  /** Look a circle up on the relay before joining. Needs signal, the first time only. */
  async lookup(circleId: string): Promise<CircleDoc | 'offline' | null> {
    if (this.state.docs[circleId]) return this.state.docs[circleId]
    if (!this.online) return 'offline'
    await this.wait()
    return (await readDoc(this.relay!, circleId)) ?? null
  }

  async join(circleId: string, memberId: string, extra?: (doc: CircleDoc) => Edit) {
    const found = await this.lookup(circleId)
    if (!found || found === 'offline') throw new Error('Circle not available')
    let doc = found
    let queued: QueuedEdit | undefined
    if (extra) {
      const res = extra(A.clone(doc))
      doc = res.doc
      queued = { hash: res.hash, circleId, label: 'Joined the circle', detail: 'Added to the end of the rotation', at: this.opts.now().toISOString() }
    }
    const { doc: saved } = await mergeInto(this.device!, circleId, doc)
    const queue = queued ? [...(await readQueue(this.device!)), queued] : await readQueue(this.device!)
    await writeQueue(this.device!, queue)
    await this.updateSettings({ me: { ...this.state.settings.me, [circleId]: memberId } })
    this.set({ docs: { ...this.state.docs, [circleId]: saved }, queue })
    this.scheduleSync()
  }

  async leave(circleId: string) {
    await deleteDoc(this.device!, circleId)
    const queue = this.state.queue.filter((q) => q.circleId !== circleId)
    await writeQueue(this.device!, queue)
    const docs = { ...this.state.docs }
    delete docs[circleId]
    const me = { ...this.state.settings.me }
    delete me[circleId]
    await this.updateSettings({ me })
    this.set({ docs, queue })
  }

  async updateSettings(patch: Partial<DeviceSettings>) {
    const settings = { ...this.state.settings, ...patch }
    await writeSettings(this.device!, settings)
    this.set({ settings })
  }

  async setSignal(signal: boolean) {
    await this.updateSettings({ signal })
    if (this.online) await this.sync()
  }

  setNetworkOnline(networkOnline: boolean) {
    this.set({ networkOnline })
    if (this.online) this.scheduleSync(0)
  }

  scheduleSync(delay = 300) {
    clearTimeout(this.syncTimer)
    if (!this.online) return
    this.syncTimer = setTimeout(() => void this.sync(), delay)
  }

  private wait() {
    const ms = this.opts.latencyMs
    return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve()
  }

  /** Push and pull every circle with the relay. Safe to call repeatedly. */
  async sync(): Promise<void> {
    if (!this.online || !this.state.ready) return
    if (this.syncing) {
      this.resyncRequested = true
      return this.syncing
    }
    this.syncing = this.runSync().finally(() => {
      this.syncing = undefined
      if (this.resyncRequested) {
        this.resyncRequested = false
        void this.sync()
      }
    })
    return this.syncing
  }

  private async runSync() {
    this.set({ syncing: true, syncError: undefined })
    try {
      await this.wait()
      if (!this.online) return
      const docs = { ...this.state.docs }
      const sentBefore = this.state.queue.length
      let queue = await readQueue(this.device!)
      for (const [id, local] of Object.entries(docs)) {
        const before = new Set(findConflicts(local).map((c) => c.key))
        const pushed = await mergeInto(this.relay!, id, local)
        const { doc } = await mergeInto(this.device!, id, pushed.doc)
        docs[id] = doc
        queue = queue.filter((q) => q.circleId !== id || !A.hasHeads(pushed.doc, [q.hash]))
        if (pushed.changed) this.post({ type: 'relay-updated', circleId: id })
        const arrived = findConflicts(doc).filter((c) => !before.has(c.key))
        if (arrived.length) this.emit({ type: 'conflicts-arrived', circleId: id, conflicts: arrived })
      }
      await writeQueue(this.device!, queue)
      const settings = { ...this.state.settings, lastSyncedAt: this.opts.now().toISOString() }
      await writeSettings(this.device!, settings)
      this.set({ docs, queue, settings })
      const sent = sentBefore - queue.length
      if (sent > 0) this.emit({ type: 'synced', count: sent })
    } catch (err) {
      this.set({ syncError: err instanceof Error ? err.message : 'Sync failed' })
    } finally {
      this.set({ syncing: false })
    }
  }

  /** Wipes every phone and the relay, then asks other tabs to reload. */
  async resetEverything() {
    this.post({ type: 'reset' })
    this.close()
    const names = (await indexedDB.databases?.())?.map((d) => d.name).filter((n): n is string => !!n?.startsWith('ajo-')) ?? [
      RELAY_DB,
      deviceDbName(this.opts.deviceId),
      deviceDbName(DEMO_DEVICE),
      deviceDbName(COORDINATOR_DEVICE),
    ]
    await Promise.all(names.map(deleteDatabase))
  }
}
