import { useId, useState, type FormEvent } from 'react'
import type { Member } from '../domain/types'
import { Avatar } from '../ui/Avatar'
import { Icon } from '../ui/Icon'
import { photoToDataUrl } from '../ui/photo'

export interface MemberDraft {
  name: string
  phone?: string
  photo?: string
}

interface Props {
  initial?: Partial<Member>
  submitLabel: string
  onSubmit: (draft: MemberDraft) => void | Promise<void>
  taken?: string[]
}

export function MemberForm({ initial, submitLabel, onSubmit, taken = [] }: Props) {
  const ids = { name: useId(), phone: useId(), photo: useId() }
  const [name, setName] = useState(initial?.name ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [photo, setPhoto] = useState(initial?.photo)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const trimmed = name.trim()
  const duplicate = taken.some((t) => t.toLowerCase() === trimmed.toLowerCase())
  const nameError = submitted && !trimmed ? 'Add a name so everyone knows who this is.' : submitted && duplicate ? 'Someone in this circle already has that name.' : null
  const phoneError = phone && !/^\+?[\d\s-]{7,16}$/.test(phone.trim()) ? 'Use digits only, like 0803 555 0142.' : null

  const pick = async (file?: File) => {
    if (!file) return
    setPhotoError(null)
    try {
      setPhoto(await photoToDataUrl(file))
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not use that photo.')
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (!trimmed || duplicate || phoneError) return
    await onSubmit({ name: trimmed, phone: phone.trim() || undefined, photo })
  }

  return (
    <form className="member-form" onSubmit={submit} noValidate>
      <div className="photo-pick">
        <Avatar member={{ name: trimmed || '?', photo }} size={72} />
        <div>
          <label htmlFor={ids.photo} className="btn btn-small">
            <Icon name="camera" size={16} /> {photo ? 'Change photo' : 'Add photo'}
          </label>
          <input id={ids.photo} type="file" accept="image/*" capture="user" className="visually-hidden" onChange={(e) => void pick(e.target.files?.[0])} />
          {photo && (
            <button type="button" className="btn btn-small btn-ghost" onClick={() => setPhoto(undefined)}>
              Remove
            </button>
          )}
          {photoError && <p className="error">{photoError}</p>}
        </div>
      </div>
      <label className="field" htmlFor={ids.name}>
        <span>Name</span>
        <input id={ids.name} className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-invalid={!!nameError} />
        {nameError && <small className="error">{nameError}</small>}
      </label>
      <label className="field" htmlFor={ids.phone}>
        <span>Phone</span>
        <input id={ids.phone} className="input num" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional, for reminders" aria-invalid={!!phoneError} />
        {phoneError && <small className="error">{phoneError}</small>}
      </label>
      <button type="submit" className="btn btn-primary btn-block">
        {submitLabel}
      </button>
    </form>
  )
}
