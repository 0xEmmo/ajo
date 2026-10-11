import { useState } from 'react'
import type { Member } from '../domain/types'
import './avatar.css'

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts.at(-1)![0]!).toUpperCase()
}

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
