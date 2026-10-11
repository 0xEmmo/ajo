import { useEffect } from 'react'
import { createBrowserRouter, Outlet, RouterProvider, ScrollRestoration } from 'react-router'
import { CircleLayout } from '../circle/CircleLayout'
import { Ledger } from '../circle/Ledger'
import { RotationPage } from '../circle/RotationPage'
import { MembersPage } from '../circle/MembersPage'
import { MemberPage } from '../circle/MemberPage'
import { SyncPage } from '../circle/SyncPage'
import { Home } from '../pages/Home'
import { NewCircle } from '../pages/NewCircle'
import { Join } from '../pages/Join'
import { Credits } from '../pages/Credits'
import { NotFound } from '../pages/NotFound'
import { ToastProvider } from '../ui/Toast'
import { useToast } from '../ui/toastContext'
import { useEngine } from './engineContext'
import { StatusBar } from './StatusBar'

function Root() {
  return (
    <ToastProvider>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <StatusBar />
      <EngineEvents />
      <Outlet />
      <ScrollRestoration />
    </ToastProvider>
  )
}

/** Turns engine events into toasts, and reloads when another tab resets the demo. */
function EngineEvents() {
  const engine = useEngine()
  const toast = useToast()
  useEffect(() => {
    const onOnline = () => engine.setNetworkOnline(true)
    const onOffline = () => engine.setNetworkOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const off = engine.onEvent((e) => {
      if (e.type === 'reset') location.replace('/')
      if (e.type === 'synced') toast(`${e.count === 1 ? '1 change' : `${e.count} changes`} synced`)
      if (e.type === 'conflicts-arrived') {
        toast(e.conflicts.length === 1 ? 'Another phone changed a square you edited. Check it in the ledger.' : `${e.conflicts.length} squares have two versions to check.`, { tone: 'warn', ms: 6000 })
      }
    })
    return () => {
      off()
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [engine, toast])
  return null
}

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/new', element: <NewCircle /> },
      { path: '/join', element: <Join /> },
      { path: '/join/:circleId', element: <Join /> },
      { path: '/credits', element: <Credits /> },
      {
        path: '/c/:circleId',
        element: <CircleLayout />,
        children: [
          { index: true, element: <Ledger /> },
          { path: 'rotation', element: <RotationPage /> },
          { path: 'members', element: <MembersPage /> },
          { path: 'members/:memberId', element: <MemberPage /> },
          { path: 'sync', element: <SyncPage /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
