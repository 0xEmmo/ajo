import { useState } from 'react'
import { initials } from '../domain/names'
import type { Member } from '../domain/types'
import './avatar.css'

interface Props {
  member: Pick<Member, 'name' | 'photo'>
  size?: number
  className?: string
}

/** Decorative: the name is always printed next to it, so the image has empty alt text. */
export function Avatar({ member, size = 32, className = '' }: Props) {
  const [broken, setBroken] = useState(false)
  const showPhoto = member.photo && !broken
  return (
    <span className={`avatar ${className}`} style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }} aria-hidden="true">
      {showPhoto ? (
        <img src={member.photo} alt="" width={size} height={size} loading="lazy" decoding="async" onError={() => setBroken(true)} />
      ) : (
        initials(member.name)
      )}
    </span>
  )
}
