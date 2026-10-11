export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts.at(-1)![0]!).toUpperCase()
}

/** "Funke Adeyemi" -> "Funke". Titles stay with the name: "Iya Sade", "Mama Bisi". */
export function firstName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length > 1 && /^(iya|mama|baba|alhaja|alhaji|mr|mrs|dr|chief)$/i.test(parts[0]!)) return `${parts[0]} ${parts[1]}`
  return parts[0] ?? name
}

/** URL-safe id from a name, with a short random tail so two "Tolu"s don't collide. */
export function slugId(name: string, random: () => number = Math.random): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24)
  const tail = Math.floor(random() * 36 ** 4)
    .toString(36)
    .padStart(4, '0')
  return `${base || 'circle'}-${tail}`
}
