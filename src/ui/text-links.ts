import { safeHttpUrl } from './job-application'

export type LinkedTextPart = {
  text: string
  href?: string
}

export function descriptionToPlainText(value: string | null | undefined) {
  if (!value?.trim()) {
    return ''
  }
  return unwrapEncodedHtml(value)
    .replace(/<(script|style|iframe|object|embed|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
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
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote|table)>/gi, '\n')
    .replace(/<\/td>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const KEPT_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'i',
  'li',
  'ol',
  'p',
  'strong',
  'u',
  'ul',
])

/** Google Calendar event notes, kept as the same links, breaks, and emphasis. */
export function calendarDescriptionHtml(value: string | null | undefined) {
  if (!value?.trim()) {
    return ''
  }
  const source = unwrapEncodedHtml(value).replace(
    /<(script|style|iframe|object|embed|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,
    '',
  )
  if (!source.includes('<')) {
    return highlightMeetingUrls(escapeHtml(source)).replace(/\n/g, '<br>')
  }
  return sanitizeCalendarHtml(source).replace(/(?:<br>\s*){3,}/gi, '<br><br>').trim()
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

export function isMeetingJoinUrl(url: string) {
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

function unwrapEncodedHtml(value: string) {
  const trimmed = value.trim()
  if (trimmed.includes('<') || !trimmed.includes('&lt;')) {
    return trimmed
  }
  return decodeHtml(trimmed)
}

function sanitizeCalendarHtml(html: string) {
  const out: string[] = []
  let openAnchor = false
  let cursor = 0
  while (cursor < html.length) {
    const start = html.indexOf('<', cursor)
    if (start === -1) {
      out.push(textChunk(html.slice(cursor), openAnchor))
      break
    }
    out.push(textChunk(html.slice(cursor, start), openAnchor))
    const tag = readTag(html, start)
    if (!tag) {
      out.push(escapeHtml('<' ))
      cursor = start + 1
      continue
    }
    const name = tag.name.toLowerCase()
    if (name === 'br' || name === 'hr') {
      out.push('<br>')
    } else if (name === 'a') {
      if (tag.closing) {
        if (openAnchor) {
          out.push('</a>')
          openAnchor = false
        }
      } else {
        const href = safeHttpUrl(decodeHtml(attrValue(tag.attrs, 'href') ?? ''))
        if (href) {
          if (openAnchor) {
            out.push('</a>')
          }
          const meet = isMeetingJoinUrl(href) ? ' class="iv-meet-link"' : ''
          out.push(
            `<a${meet} href="${escapeHtml(href)}" target="_blank" rel="noreferrer">`,
          )
          openAnchor = true
        }
      }
    } else if (KEPT_TAGS.has(name)) {
      const tagName = name === 'div' ? 'p' : name
      out.push(tag.closing ? `</${tagName}>` : `<${tagName}>`)
    }
    cursor = tag.end
  }
  if (openAnchor) {
    out.push('</a>')
  }
  return out.join('').replace(/<p>\s*<\/p>/gi, '')
}

function readTag(html: string, start: number) {
  if (html[start] !== '<') {
    return null
  }
  let index = start + 1
  const closing = html[index] === '/'
  if (closing) {
    index += 1
  }
  const nameStart = index
  while (index < html.length && /[a-zA-Z0-9]/.test(html[index])) {
    index += 1
  }
  if (index === nameStart) {
    return null
  }
  const name = html.slice(nameStart, index)
  let quote = ''
  const attrsStart = index
  while (index < html.length) {
    const char = html[index]
    if (quote) {
      if (char === quote) {
        quote = ''
      }
      index += 1
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      index += 1
      continue
    }
    if (char === '>') {
      return { name, closing, attrs: html.slice(attrsStart, index), end: index + 1 }
    }
    index += 1
  }
  return null
}

function attrValue(attrs: string, name: string) {
  const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`, 'i'))
  return match?.[2] ?? match?.[3] ?? match?.[4] ?? null
}

function textChunk(value: string, insideLink: boolean) {
  const escaped = escapeHtml(decodeHtml(value))
  return insideLink ? escaped : highlightMeetingUrls(escaped)
}

function highlightMeetingUrls(escaped: string) {
  return escaped.replace(/https?:\/\/[^\s<]+/gi, (raw) => {
    const decoded = decodeHtml(raw)
    const trimmed = trimTrailingPunctuation(decoded)
    const href = safeHttpUrl(trimmed)
    if (!href || !isMeetingJoinUrl(href)) {
      return raw
    }
    const suffix = escapeHtml(decoded.slice(trimmed.length))
    return `<a class="iv-meet-link" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(trimmed)}</a>${suffix}`
  })
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, '')
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, digits: string) => fromCodePoint(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => fromCodePoint(parseInt(hex, 16)))
    .replace(/&amp;/gi, '&')
}

function fromCodePoint(code: number) {
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) {
    return ''
  }
  return String.fromCodePoint(code)
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
