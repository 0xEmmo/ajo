import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type Push, type ToastItem } from './toastContext'
import './toast.css'

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const next = useRef(1)

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), [])

  const push = useCallback<Push>(
    (message, opts = {}) => {
      const id = next.current++
      setItems((all) => [...all.slice(-2), { id, message, action: opts.action, tone: opts.tone }])
      setTimeout(() => dismiss(id), opts.ms ?? (opts.action ? 6000 : 3500))
    },
    [dismiss],
  )

  const value = useMemo(() => push, [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone ?? 'default'}`}>
            <span>{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  t.action!.run()
                  dismiss(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
