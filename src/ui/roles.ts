import type { Role } from '../api/types'

export const DEFAULT_MEMBER_PASSWORD = '12345678'

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Admin',
  BID_MANAGER: 'Bid Manager',
  BIDDER: 'Bidder',
}

export function roleBadgeTone(role: Role): 'info' | 'warning' | 'neutral' {
  if (role === 'ADMIN') {
    return 'info'
  }
  if (role === 'BID_MANAGER') {
    return 'warning'
  }
  return 'neutral'
}

export function splitName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim()
  const space = trimmed.indexOf(' ')
  if (space === -1) {
    return { firstName: trimmed, lastName: '' }
  }
  return {
    firstName: trimmed.slice(0, space),
    lastName: trimmed.slice(space + 1).trim(),
  }
}

export function composeName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
}

export function formatMemberDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
