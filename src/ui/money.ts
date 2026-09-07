export function isPositiveUsd(value: string | number | null | undefined) {
  return Number(value) > 0
}

export function formatUsd(value: string | number) {
  const amount = Number(value)
  if (Number.isNaN(amount)) {
    return String(value)
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

/** Max 2 decimals, trailing zeros stripped. Use for rates only — never counts. */
export function formatRate(value: string | number) {
  if (value === '' || value === null || value === undefined) {
    return ''
  }
  const amount = Number(value)
  if (!Number.isFinite(amount)) {
    return String(value)
  }
  return Number(amount.toFixed(2)).toString()
}

/** Currency-prefixed rate ($0.03, $1, $1.5). Totals still use formatUsd. */
export function formatUsdRate(value: string | number) {
  const formatted = formatRate(value)
  if (!formatted) {
    return String(value)
  }
  if (formatted.startsWith('-')) {
    return `-$${formatted.slice(1)}`
  }
  return `$${formatted}`
}

export function paymentStatusLabel(status: string) {
  if (status === 'PAID') {
    return 'Paid'
  }
  if (status === 'REVIEWED') {
    return 'Reviewed'
  }
  return status === 'DRAFT' ? 'Estimated' : status
}
