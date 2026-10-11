import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Sheet } from '../ui/Sheet'
import { Icon } from '../ui/Icon'
import { useToast } from '../ui/toastContext'
import { useCircleView } from './circleContext'
import { inviteLink } from './links'
import './invite.css'

export function InviteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { circle } = useCircleView()
  const toast = useToast()
  const link = inviteLink(circle.id)
  const [svg, setSvg] = useState('')

  useEffect(() => {
    if (!open) return
    let live = true
    QRCode.toString(link, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#14231d', light: '#ffffff' } }).then((s) => live && setSvg(s))
    return () => {
      live = false
    }
  }, [open, link])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      toast('Invite link copied')
    } catch {
      toast('Copying is blocked here. Long-press the link to copy it.', { tone: 'warn' })
    }
  }

  const share = async () => {
    try {
      await navigator.share({ title: circle.name, text: `Join ${circle.name} on Ajo`, url: link })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') void copy()
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Invite to ${circle.name}`}
      description="Members scan this at the stall, or you send the link. Their phone needs signal the first time; after that it works offline too."
    >
      <div className="invite">
        <div className="qr" role="img" aria-label={`QR code for ${link}`} dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="invite-link">
          <span className="label-caps">Circle code</span>
          <code className="num">{circle.id}</code>
          <a href={link} className="invite-url">
            {link.replace(/^https?:\/\//, '')}
          </a>
        </div>
        <div className="invite-actions">
          <button type="button" className="btn" onClick={() => void copy()}>
            <Icon name="copy" size={18} /> Copy link
          </button>
          {'share' in navigator && (
            <button type="button" className="btn btn-primary" onClick={() => void share()}>
              <Icon name="share" size={18} /> Share
            </button>
          )}
        </div>
      </div>
    </Sheet>
  )
}
