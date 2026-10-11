import { DEMO_DEVICE } from '../crdt/seed'

const known: Record<string, { name: string; first: string }> = {
  kemi: { name: 'Kemi Ogun', first: 'Kemi' },
  'iya-sade': { name: 'Iya Sade', first: 'Iya Sade' },
}

const KEY = 'ajo:device'

/**
 * Which phone this tab is pretending to be. `?device=iya-sade` opens a second
 * phone with its own storage; the choice sticks for the tab as you navigate.
 */
export function resolveDeviceId(search = location.search): string {
  const fromUrl = new URLSearchParams(search).get('device')
  const clean = (v: string | null) => (v && /^[a-z0-9-]{2,32}$/.test(v) ? v : null)
  const id = clean(fromUrl) ?? clean(sessionStorage.getItem(KEY)) ?? DEMO_DEVICE
  sessionStorage.setItem(KEY, id)
  return id
}

export function deviceOwner(id: string): string {
  return known[id]?.first ?? id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** "you" when it's this phone, otherwise the owner's first name. */
export function recorder(recordedBy: string, viewer: string): string {
  return recordedBy === viewer ? 'you' : deviceOwner(recordedBy)
}

/** "Your phone" / "Iya Sade's phone" */
export function phoneOf(recordedBy: string, viewer: string): string {
  return recordedBy === viewer ? 'Your phone' : `${deviceOwner(recordedBy)}'s phone`
}

export function secondPhoneFor(viewer: string): string {
  return viewer === 'iya-sade' ? DEMO_DEVICE : 'iya-sade'
}
