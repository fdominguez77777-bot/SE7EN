import { safeHttpUrl } from './job-application'

export type LinkedTextPart = {
  text: string
  href?: string
}

export function descriptionToPlainText(value: string | null | undefined) {
  if (!value?.trim()) {
    return ''
  }
  return value
    .replace(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
      const url = safeHttpUrl(decodeHtml(String(href)))
      const text = stripTags(String(inner)).trim()
      if (!url) {
        return text
      }
      if (!text || text.includes(url) || looksLikeUrl(text)) {
        return text || url
      }
      return `${text}\n${url}`
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function splitLinkedText(value: string): LinkedTextPart[] {
  const parts: LinkedTextPart[] = []
  const pattern = /https?:\/\/[^\s<>"'`]+/gi
  let last = 0
  for (const match of value.matchAll(pattern)) {
    const raw = match[0]
    const start = match.index ?? 0
    const trimmed = trimTrailingPunctuation(raw)
    if (start > last) {
      parts.push({ text: value.slice(last, start) })
    }
    const href = safeHttpUrl(trimmed)
    parts.push(href ? { text: trimmed, href } : { text: trimmed })
    last = start + trimmed.length
  }
  if (last < value.length) {
    parts.push({ text: value.slice(last) })
  }
  return parts.length ? parts : [{ text: value }]
}

export function firstHttpUrl(value: string | null | undefined) {
  if (!value) {
    return null
  }
  const hrefs = splitLinkedText(value)
    .map((part) => part.href)
    .filter((href): href is string => Boolean(href))
  return hrefs.find((href) => isMeetingJoinUrl(href)) ?? hrefs[0] ?? null
}

function isMeetingJoinUrl(url: string) {
  const value = url.toLowerCase()
  if (value.includes('help.') || value.includes('/support')) {
    return false
  }
  return (
    value.includes('teams.microsoft.com') ||
    value.includes('meet.google.com') ||
    value.includes('zoom.us') ||
    value.includes('/j.php') ||
    value.includes('/meetup-join') ||
    value.includes('/meet/') ||
    value.includes('webex.com')
  )
}

function looksLikeUrl(value: string) {
  return /^https?:\/\//i.test(value.trim())
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, '')
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function trimTrailingPunctuation(value: string) {
  let url = value
  while (url.length > 0) {
    const last = url[url.length - 1]
    if (last === ')' && url.includes('(')) {
      break
    }
    if (!'.),;:!?\'"]'.includes(last)) {
      break
    }
    url = url.slice(0, -1)
  }
  return url
}
