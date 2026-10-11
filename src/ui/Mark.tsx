/** The app mark: a rotation ring with the current collector's seat in mustard. */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0f4a36" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="#dcebe2" strokeWidth="3" strokeDasharray="4.2 2.9" />
      <circle cx="16" cy="7" r="3.4" fill="#e3a21a" />
    </svg>
  )
}
