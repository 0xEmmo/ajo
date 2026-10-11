export function inviteLink(circleId: string, origin = location.origin) {
  return `${origin}/join/${circleId}`
}
