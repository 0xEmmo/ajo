import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'
import './sheet.css'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

/**
 * A native <dialog>: modal focus trapping, Escape and the inert backdrop come
 * from the browser. It docks to the bottom on phones and centres on desktop.
 */
export function Sheet({ open, onClose, title, description, children, footer, wide }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`sheet${wide ? ' sheet-wide' : ''}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      {open && (
        <div className="sheet-body">
          <header className="sheet-head">
            <div>
              <h2 id={titleId} className="sheet-title">
                {title}
              </h2>
              {description && (
                <p id={descId} className="sheet-desc">
                  {description}
                </p>
              )}
            </div>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <Icon name="close" />
            </button>
          </header>
          <div className="sheet-content">{children}</div>
          {footer && <footer className="sheet-foot">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}
