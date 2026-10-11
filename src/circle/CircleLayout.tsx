import { useCallback, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router'
import { useCircle, useEngineState, useToday } from '../app/engineContext'
import { Icon, type IconName } from '../ui/Icon'
import { Mark } from '../ui/Mark'
import { Sheet } from '../ui/Sheet'
import { CircleContext, useCircleView, type CircleView } from './circleContext'
import { ConflictCard } from './ConflictCard'
import { InviteSheet } from './InviteSheet'
import { PaymentSheet } from './PaymentSheet'
import { PayoutSheet } from './PayoutSheet'
import './layout.css'

export function CircleLayout() {
  const { circleId } = useParams()
  const data = useCircle(circleId)
  const { settings } = useEngineState()
  const today = useToday()
  const [payment, setPayment] = useState<{ memberId?: string; round?: number } | null>(null)
  const [payoutRound, setPayoutRound] = useState<number | null>(null)
  const [invite, setInvite] = useState(false)
  const [conflictKey, setConflictKey] = useState<string | null>(null)

  const openPayment = useCallback((t: { memberId?: string; round?: number } = {}) => setPayment(t), [])
  const openPayout = useCallback((r: number) => setPayoutRound(r), [])
  const openInvite = useCallback(() => setInvite(true), [])
  const openConflict = useCallback((k: string) => setConflictKey(k), [])

  const view = useMemo<CircleView | null>(
    () =>
      data && {
        ...data,
        meId: settings.me[data.circle.id],
        today,
        openPayment,
        openPayout,
        openInvite,
        openConflict,
      },
    [data, settings.me, today, openPayment, openPayout, openInvite, openConflict],
  )

  if (!view) return <CircleMissing id={circleId ?? ''} />

  const openConflictItem = view.conflicts.find((c) => c.key === conflictKey)

  return (
    <CircleContext.Provider value={view}>
      <CircleNav />
      <main id="main" className="circle-main" tabIndex={-1}>
        <Outlet />
      </main>
      <TabBar />
      <PaymentSheet target={payment} onClose={() => setPayment(null)} />
      <PayoutSheet round={payoutRound} onClose={() => setPayoutRound(null)} />
      <InviteSheet open={invite} onClose={() => setInvite(false)} />
      <Sheet open={!!openConflictItem} onClose={() => setConflictKey(null)} title="Settle this square">
        {openConflictItem && <ConflictCard conflict={openConflictItem} headingLevel={3} onResolved={() => setConflictKey(null)} />}
      </Sheet>
    </CircleContext.Provider>
  )
}

const tabs: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '', label: 'Ledger', icon: 'ledger', end: true },
  { to: 'rotation', label: 'Rotation', icon: 'rotation' },
  { to: 'members', label: 'Members', icon: 'members' },
  { to: 'sync', label: 'Sync', icon: 'sync' },
]

function useSyncBadge(circleId: string, conflicts: number) {
  const { queue } = useEngineState()
  return queue.filter((q) => q.circleId === circleId).length + conflicts
}

function CircleNav() {
  const { circle, conflicts, openInvite, openPayment } = useCircleView()
  const badge = useSyncBadge(circle.id, conflicts.length)
  return (
    <header className="circle-nav">
      <Link to="/" className="wordmark" aria-label="Ajo, all circles">
        <Mark /> Ajo
      </Link>
      <nav aria-label="Circle" className="circle-tabs">
        {tabs.map((t) => (
          <NavLink key={t.label} to={t.to} end={t.end} className="circle-tab">
            {t.label}
            {t.label === 'Sync' && badge > 0 && <span className="badge num">{badge}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="circle-nav-actions">
        <button type="button" className="btn" onClick={openInvite}>
          <Icon name="qr" size={18} /> Invite
        </button>
        <button type="button" className="btn btn-accent" onClick={() => openPayment()}>
          <Icon name="plus" size={16} strokeWidth={3} /> Record payment
        </button>
      </div>
    </header>
  )
}

function TabBar() {
  const { circle, conflicts, openPayment } = useCircleView()
  const badge = useSyncBadge(circle.id, conflicts.length)
  const { pathname } = useLocation()
  const showFab = !/\/(sync|rotation)$/.test(pathname)
  return (
    <>
      {showFab && (
        <button type="button" className="fab" onClick={() => openPayment()}>
          <Icon name="plus" size={14} strokeWidth={3} /> Record payment
        </button>
      )}
      <nav className="tabbar" aria-label="Circle">
        {tabs.map((t) => (
          <NavLink key={t.label} to={t.to} end={t.end} className="tabbar-item">
            <Icon name={t.icon} size={22} />
            <span>
              {t.label}
              {t.label === 'Sync' && badge > 0 && <span className="num"> · {badge}</span>}
            </span>
          </NavLink>
        ))}
      </nav>
    </>
  )
}

function CircleMissing({ id }: { id: string }) {
  return (
    <main id="main" className="page-narrow missing">
      <h1 className="display">This circle isn't on this phone</h1>
      <p>
        There's no circle called <code className="num">{id}</code> saved here. If someone sent you an invite, open it to join; it needs signal the first time.
      </p>
      <div className="row">
        <Link className="btn btn-primary" to={`/join/${encodeURIComponent(id)}`}>
          Try to join it
        </Link>
        <Link className="btn" to="/">
          Back to your circles
        </Link>
      </div>
    </main>
  )
}
