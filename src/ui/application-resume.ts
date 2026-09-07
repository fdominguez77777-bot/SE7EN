function looksLikeJson(value: string) {
  const trimmed = value.trim()
  return trimmed.startsWith('{') || trimmed.startsWith('[')
}

function stripFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

export function parseResumeJson(raw: string | null | undefined): unknown | null {
  if (!raw?.trim()) {
    return null
  }
  let current = stripFence(raw)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!looksLikeJson(current)) {
      return null
    }
    try {
      const parsed: unknown = JSON.parse(current)
      if (typeof parsed === 'string') {
        current = stripFence(parsed)
        continue
      }
      return parsed
    } catch {
      return null
    }
  }
  return null
}

export function hydrateResume(value: unknown, depth = 0): unknown {
  if (depth > 8) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = parseResumeJson(value)
    return parsed === null ? value : hydrateResume(parsed, depth + 1)
  }
  if (Array.isArray(value)) {
    return value.map((item) => hydrateResume(item, depth + 1))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        hydrateResume(nested, depth + 1),
      ]),
    )
  }
  return value
}

export function humanizeResumeKey(key: string) {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d+)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function isEmptyResumeValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true
  }
  if (typeof value === 'string') {
    return value.trim().length === 0
  }
  if (Array.isArray(value)) {
    return value.length === 0 || value.every(isEmptyResumeValue)
  }
  if (typeof value === 'object') {
    return Object.keys(value as object).length === 0
  }
  return false
}

export function isPrimitiveResumeValue(value: unknown) {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

export function formatResumeScalar(value: string | number | boolean) {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }
  return String(value).trim()
}

export function asResumeRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

export function pickResume(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) {
    return null
  }
  const lookup = new Map(
    Object.keys(record).map((key) => [key.toLowerCase(), key]),
  )
  for (const key of keys) {
    const actual = lookup.get(key.toLowerCase())
    if (actual !== undefined && !isEmptyResumeValue(record[actual])) {
      return { key: actual, value: record[actual] }
    }
  }
  return null
}

export function stripMarkdownBold(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
}

export function splitResumeSentences(text: string): string[] {
  const trimmed = stripMarkdownBold(text).trim()
  if (!trimmed) {
    return []
  }
  if (/^[-*•]/.test(trimmed) || trimmed.includes('\n')) {
    return trimmed
      .split(/\n+/)
      .map((line) => line.replace(/^[-*•]\s*/, '').trim())
      .filter(Boolean)
  }
  const sentences = trimmed
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((part) => part.trim())
    .filter(Boolean)
  return sentences.length > 0 ? sentences : [trimmed]
}

export function resumeToBullets(value: unknown): string[] {
  if (isEmptyResumeValue(value)) {
    return []
  }
  if (typeof value === 'string') {
    return splitResumeSentences(value)
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return [formatResumeScalar(value)]
  }
  if (Array.isArray(value)) {
    return value.flatMap(resumeToBullets)
  }
  const record = asResumeRecord(value)
  if (!record) {
    return []
  }
  const bullets: string[] = []
  for (const [key, nested] of Object.entries(record)) {
    if (isEmptyResumeValue(nested)) {
      continue
    }
    if (isPrimitiveResumeValue(nested)) {
      bullets.push(formatResumeScalar(nested))
      continue
    }
    const nestedBullets = resumeToBullets(nested)
    if (nestedBullets.length === 1) {
      bullets.push(nestedBullets[0])
    } else {
      bullets.push(
        ...nestedBullets.map((item) =>
          item.includes(':') ? item : `${humanizeResumeKey(key)}: ${item}`,
        ),
      )
    }
  }
  return bullets
}

export function isExperienceKey(key: string) {
  return /^experience\d*$/i.test(key)
}

export function isRoleTitleKey(key: string) {
  return /^roleTitle\d*$/i.test(key)
}

function prefixedIndex(key: string, prefix: string): number | null {
  const match = key.match(new RegExp(`^${prefix}(\\d+)?$`, 'i'))
  if (!match) {
    return null
  }
  return match[1] ? Number(match[1]) : 0
}

export type PairedResumeJob = {
  index: number
  roleTitle: unknown
  experience: unknown
  company: unknown
  date: unknown
}

export function collectResumeKeywords(value: unknown): string[] {
  const found = new Set<string>([
    'Power BI',
    'D3.js',
    'SQL',
    'Python',
    'Tableau',
    'Looker',
    'Excel',
    'data visualization',
  ])
  walkKeywords(value, found)
  return [...found].filter((item) => item.trim().length >= 2)
}

function walkKeywords(value: unknown, into: Set<string>, parentKey = '') {
  if (isEmptyResumeValue(value)) {
    return
  }
  if (Array.isArray(value)) {
    const fromSkills =
      /skill|keyword|tool/i.test(parentKey) &&
      value.every((item) => isPrimitiveResumeValue(item) || isEmptyResumeValue(item))
    if (fromSkills) {
      for (const item of value) {
        if (isPrimitiveResumeValue(item)) {
          into.add(formatResumeScalar(item))
        }
      }
      return
    }
    for (const item of value) {
      walkKeywords(item, into, parentKey)
    }
    return
  }
  const record = asResumeRecord(value)
  if (!record) {
    return
  }
  for (const [key, nested] of Object.entries(record)) {
    walkKeywords(nested, into, key)
  }
}

export function emphasizeResumeKeywords(
  text: string,
  keywords: string[],
): Array<{ text: string; bold: boolean }> {
  const cleaned = stripMarkdownBold(text)
  const unique = [...new Set(keywords.map((item) => item.trim()).filter(Boolean))].sort(
    (left, right) => right.length - left.length,
  )
  if (unique.length === 0) {
    return [{ text: cleaned, bold: false }]
  }
  const pattern = unique
    .map((keyword) => {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return keyword.includes(' ') ? escaped : `\\b${escaped}\\b`
    })
    .join('|')
  const matcher = new RegExp(`(${pattern})`, 'gi')
  const parts: Array<{ text: string; bold: boolean }> = []
  let last = 0
  for (const match of cleaned.matchAll(matcher)) {
    const index = match.index ?? 0
    if (index > last) {
      parts.push({ text: cleaned.slice(last, index), bold: false })
    }
    parts.push({ text: match[0], bold: true })
    last = index + match[0].length
  }
  if (last < cleaned.length) {
    parts.push({ text: cleaned.slice(last), bold: false })
  }
  return parts.length > 0 ? parts : [{ text: cleaned, bold: false }]
}

function normalizePairIndex(
  map: Map<number, unknown>,
) {
  if (map.has(0) && !map.has(1)) {
    map.set(1, map.get(0))
  }
  map.delete(0)
}

function collectIndexed(record: Record<string, unknown>, prefixes: string[]) {
  const map = new Map<number, unknown>()
  for (const [key, value] of Object.entries(record)) {
    for (const prefix of prefixes) {
      const index = prefixedIndex(key, prefix)
      if (index !== null) {
        map.set(index, value)
        break
      }
    }
  }
  return map
}

export function isJobMetaKey(key: string) {
  return /^(company|companyName|employer|dates?|dateRange|period|startDate|endDate)\d*$/i.test(
    key,
  )
}

export function looksLikeDateRange(value: string) {
  return (
    /\d{4}/.test(value) ||
    /\b(present|current|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i.test(
      value,
    )
  )
}

function asShortLabel(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 80) {
    return null
  }
  return trimmed
}

export function formatResumeDate(value: unknown): string | null {
  const direct = asShortLabel(value)
  if (direct && looksLikeDateRange(direct)) {
    return direct
  }
  const record = asResumeRecord(value)
  if (!record) {
    return null
  }
  const whole = pickResume(record, [
    'dateRange',
    'dates',
    'period',
    'duration',
    'tenure',
    'timeframe',
    'employmentDates',
    'date',
  ])
  if (whole) {
    const label = asShortLabel(whole.value)
    const asRange =
      label && looksLikeDateRange(label) ? label : formatResumeDate(whole.value)
    if (asRange) {
      return asRange
    }
  }
  const start =
    asShortLabel(pickResume(record, ['startDate', 'start', 'from', 'begin'])?.value) ||
    formatResumeDate(pickResume(record, ['startDate', 'start', 'from'])?.value)
  const end =
    asShortLabel(pickResume(record, ['endDate', 'end', 'to', 'finish'])?.value) ||
    (pickResume(record, ['current', 'currentlyWorksHere', 'isCurrent', 'present'])?.value === true
      ? 'Present'
      : formatResumeDate(pickResume(record, ['endDate', 'end', 'to'])?.value))
  const range = [start, end].filter(Boolean).join(' – ')
  return range && looksLikeDateRange(range) ? range : null
}

export function parsePipeHeader(text: string | null | undefined) {
  if (!text?.includes('|')) {
    return null
  }
  const line = text.split(/\n/)[0]?.trim() ?? ''
  const parts = line.split('|').map((part) => part.trim()).filter(Boolean)
  if (parts.length < 2 || parts.length > 4) {
    return null
  }
  const datePart = [...parts].reverse().find(looksLikeDateRange) ?? null
  const rest = datePart ? parts.filter((part) => part !== datePart) : parts
  return {
    title: rest[0] ?? null,
    company: rest[1] ?? null,
    date: datePart,
  }
}

function firstHeaderLine(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.split(/\n/)[0]?.trim() || null
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0].trim()
  }
  return null
}

export function findResumeCompany(value: unknown, title: string | null, depth = 0): string | null {
  if (depth > 6 || isEmptyResumeValue(value)) {
    return null
  }
  const record = asResumeRecord(value)
  if (!record) {
    return null
  }
  const preferred = pickResume(record, [
    'company',
    'companyName',
    'employer',
    'organization',
    'organisation',
    'org',
    'client',
    'workplace',
    'employerName',
  ])
  if (preferred) {
    const nested = asResumeRecord(preferred.value)
    const label =
      asShortLabel(preferred.value) ||
      asShortLabel(pickResume(nested, ['name', 'title', 'label', 'value', 'text'])?.value)
    if (label && label.toLowerCase() !== title?.toLowerCase() && !looksLikeDateRange(label)) {
      return label
    }
  }
  for (const nested of Object.values(record)) {
    const found = findResumeCompany(nested, title, depth + 1)
    if (found) {
      return found
    }
  }
  return null
}

export function findResumeDate(value: unknown, depth = 0): string | null {
  if (depth > 6 || isEmptyResumeValue(value)) {
    return null
  }
  const formatted = formatResumeDate(value)
  if (formatted) {
    return formatted
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findResumeDate(item, depth + 1)
      if (found) {
        return found
      }
    }
    return null
  }
  const record = asResumeRecord(value)
  if (!record) {
    return null
  }
  for (const nested of Object.values(record)) {
    const found = findResumeDate(nested, depth + 1)
    if (found) {
      return found
    }
  }
  return null
}

export function resolveJobHeader(job: PairedResumeJob): string {
  const piped =
    parsePipeHeader(asShortLabel(job.roleTitle) ?? undefined) ||
    parsePipeHeader(firstHeaderLine(job.experience)) ||
    parsePipeHeader(asShortLabel(job.date) ?? undefined)
  if (piped?.company && piped.date) {
    return [piped.title, piped.company, piped.date].filter(Boolean).join(' | ')
  }

  const title =
    (piped?.title && !looksLikeDateRange(piped.title) ? piped.title : null) ||
    asShortLabel(job.roleTitle) ||
    asShortLabel(
      pickResume(asResumeRecord(job.roleTitle), ['jobTitle', 'title', 'role', 'position'])?.value,
    ) ||
    asShortLabel(
      pickResume(asResumeRecord(job.experience), ['jobTitle', 'title', 'role', 'position'])?.value,
    )

  const company =
    piped?.company ||
    asShortLabel(job.company) ||
    findResumeCompany(job.roleTitle, title) ||
    findResumeCompany(job.experience, title)

  const date =
    piped?.date ||
    formatResumeDate(job.date) ||
    findResumeDate(job.roleTitle) ||
    findResumeDate(job.experience)

  const parts: string[] = []
  const seen = new Set<string>()
  for (const part of [title, company, date]) {
    const value = part?.trim()
    if (!value) {
      continue
    }
    const key = value.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    if (part === company && title && key === title.toLowerCase()) {
      continue
    }
    if (part === date && !looksLikeDateRange(value)) {
      continue
    }
    seen.add(key)
    parts.push(value)
  }
  return parts.join(' | ')
}

export function collectPairedJobs(record: Record<string, unknown>): PairedResumeJob[] {
  const titles = collectIndexed(record, ['roleTitle'])
  normalizePairIndex(titles)

  const experiences = collectIndexed(record, ['experience'])
  const unnumberedExperience = experiences.get(0)
  if (Array.isArray(unnumberedExperience) && unnumberedExperience.some(asResumeRecord)) {
    experiences.delete(0)
    unnumberedExperience.forEach((item, index) => {
      experiences.set(index + 1, item)
    })
  }
  normalizePairIndex(experiences)

  const companies = collectIndexed(record, ['company', 'companyName', 'employer'])
  normalizePairIndex(companies)
  const dates = collectIndexed(record, [
    'dateRange',
    'startDate',
    'dates',
    'period',
    'tenure',
    'timeframe',
    'date',
  ])
  normalizePairIndex(dates)

  for (const [key, value] of Object.entries(record)) {
    const attached = key.match(/^(?:experience|roleTitle|role)(\d+)(.+)$/i)
    if (!attached) {
      continue
    }
    const index = Number(attached[1])
    const suffix = attached[2]
    if (/company|employer|org/i.test(suffix) && !companies.has(index)) {
      companies.set(index, value)
    }
    if (/date|period|tenure|time/i.test(suffix) && !dates.has(index)) {
      dates.set(index, value)
    }
  }

  const indexes = [
    ...new Set([...titles.keys(), ...experiences.keys(), ...companies.keys(), ...dates.keys()]),
  ].sort((left, right) => left - right)

  return indexes
    .map((index) => ({
      index,
      roleTitle: titles.get(index),
      experience: experiences.get(index),
      company: companies.get(index),
      date: dates.get(index),
    }))
    .filter(
      (job) =>
        !isEmptyResumeValue(job.roleTitle) ||
        !isEmptyResumeValue(job.experience) ||
        !isEmptyResumeValue(job.company) ||
        !isEmptyResumeValue(job.date),
    )
}

export type ProfileWorkHistoryItem = {
  companyName: string | null
  startDate: string | null
  endDate: string | null
  isPresent: boolean
}

export type DateRangeFields = {
  startDate: string | null
  endDate: string | null
  isPresent: boolean
}

function formatMonthYear(value: string | null): string | null {
  if (!value?.trim()) {
    return null
  }
  const ym = value.trim().match(/^(\d{4})-(\d{2})(?:-\d{2})?/)
  if (ym) {
    return new Date(Number(ym[1]), Number(ym[2]) - 1, 1).toLocaleString('en-US', {
      month: 'short',
      year: 'numeric',
    })
  }
  return value.trim()
}

export function formatEmploymentRange(item: DateRangeFields): string | null {
  const start = formatMonthYear(item.startDate)
  if (item.isPresent) {
    return start ? `${start} – Present` : 'Present'
  }
  const end = formatMonthYear(item.endDate)
  if (start && end) {
    return `${start} – ${end}`
  }
  return start || end
}

export type ProfileEducationItem = {
  degree: string | null
  institutionName: string | null
  startDate: string | null
  endDate: string | null
  isPresent: boolean
}

export function formatEducationLine(item: ProfileEducationItem): string {
  return [item.degree, item.institutionName, formatEmploymentRange(item)].filter(Boolean).join(' | ')
}

export function applyProfileWorkHistory(
  jobs: PairedResumeJob[],
  history: ProfileWorkHistoryItem[] | undefined,
): PairedResumeJob[] {
  if (!history?.length) {
    return jobs
  }
  return jobs.map((job) => {
    const item = history[job.index - 1]
    if (!item) {
      return job
    }
    return {
      ...job,
      company: asShortLabel(job.company) ? job.company : item.companyName,
      date: formatResumeDate(job.date) ? job.date : formatEmploymentRange(item),
    }
  })
}

export function sortResumeKeys(keys: string[]) {
  const preferred = [
    'summary',
    'skills',
    'records',
    'projects',
    'certifications',
    'tools',
    'keywords',
    'education',
    'educations',
  ]
  const used = new Set<string>()
  const ordered: string[] = []
  for (const name of preferred) {
    const match = keys.find((key) => key.toLowerCase() === name.toLowerCase())
    if (match && !used.has(match)) {
      used.add(match)
      ordered.push(match)
    }
  }
  for (const key of keys) {
    if (!used.has(key)) {
      ordered.push(key)
    }
  }
  return ordered
}

function experienceBulletLines(experience: unknown): string[] {
  const headerLine = firstHeaderLine(experience)
  const piped = parsePipeHeader(headerLine)
  const skipHeader = Boolean(piped?.company || piped?.date)
  const bullets = (() => {
    const record = asResumeRecord(experience)
    if (!record) {
      return resumeToBullets(experience)
    }
    const records = pickResume(record, [
      'records',
      'bullets',
      'highlights',
      'responsibilities',
      'achievements',
      'description',
      'summary',
    ])
    if (records) {
      return resumeToBullets(records.value)
    }
    return Object.entries(record)
      .filter(([key]) => {
        const name = key.toLowerCase()
        return ![
          'jobtitle',
          'title',
          'role',
          'position',
          'roletitle',
          'company',
          'employer',
          'organization',
          'org',
          'client',
          'date',
          'dates',
          'period',
          'duration',
          'daterange',
          'startdate',
          'enddate',
          'end',
          'to',
          'skills',
          'keywords',
          'tools',
        ].includes(name)
      })
      .flatMap(([, value]) => resumeToBullets(value))
  })()
  return skipHeader ? bullets.filter((item) => item !== headerLine) : bullets
}

function skillPlainLines(value: unknown): string[] {
  if (Array.isArray(value)) {
    if (value.every(isPrimitiveResumeValue)) {
      return value.map(formatResumeScalar)
    }
    return value
      .map((item) => {
        const record = asResumeRecord(item)
        if (!record) {
          return isPrimitiveResumeValue(item) ? formatResumeScalar(item) : null
        }
        const category = pickResume(record, ['group', 'category', 'name', 'label', 'title'])
        const keywords = pickResume(record, ['skills', 'keywords', 'items', 'list', 'values'])
        const items = resumeToBullets(keywords?.value ?? [])
        const name = typeof category?.value === 'string' ? category.value : null
        if (name && items.length > 0) {
          return `${name}: ${items.join(', ')}`
        }
        return name || (items.length > 0 ? items.join(', ') : null)
      })
      .filter((line): line is string => Boolean(line))
  }
  const record = asResumeRecord(value)
  if (record) {
    return Object.entries(record)
      .map(([category, keywords]) => {
        const items = resumeToBullets(keywords)
        return items.length > 0 ? `${humanizeResumeKey(category)}: ${items.join(', ')}` : null
      })
      .filter((line): line is string => Boolean(line))
  }
  return resumeToBullets(value)
}

function bulletBlock(lines: string[]) {
  return lines.map((line) => `- ${stripMarkdownBold(line)}`).join('\n')
}

export function formatApplicationCopy(params: {
  jobDescriptionText?: string | null
  resumeText?: string | null
  workHistory?: ProfileWorkHistoryItem[]
  educationHistory?: ProfileEducationItem[]
}) {
  const jobDescription = stripMarkdownBold(
    (params.jobDescriptionText ?? '').replace(/\r\n/g, '\n'),
  ).trim()
  const resume = formatResumeCopy(
    params.resumeText,
    params.workHistory,
    params.educationHistory,
  )
  return `Job Description:\n\n${jobDescription || 'No job description available.'}\n\nResume:\n\n${resume}`
}

function formatResumeCopy(
  content: string | null | undefined,
  workHistory?: ProfileWorkHistoryItem[],
  educationHistory?: ProfileEducationItem[],
) {
  if (!content?.trim()) {
    return 'No resume text available.'
  }
  const parsed = hydrateResume(parseResumeJson(content) ?? content)
  const record = asResumeRecord(parsed)
  if (!record) {
    return stripMarkdownBold(content).trim()
  }

  const jobs = applyProfileWorkHistory(collectPairedJobs(record), workHistory)
  const summary = record.summary ?? record.Summary
  const skills = record.skills ?? record.Skills
  const education = record.education ?? record.educations ?? record.Education
  const parts: string[] = []

  if (!isEmptyResumeValue(summary)) {
    parts.push(`Summary\n${bulletBlock(resumeToBullets(summary))}`)
  }
  if (!isEmptyResumeValue(skills)) {
    parts.push(`Skills\n${bulletBlock(skillPlainLines(skills))}`)
  }
  if (jobs.length > 0) {
    const jobsText = jobs
      .map((job) => {
        const header = resolveJobHeader(job)
        const bullets = bulletBlock(experienceBulletLines(job.experience))
        return [header, bullets].filter(Boolean).join('\n')
      })
      .join('\n\n')
    parts.push(`Experience\n${jobsText}`)
  }

  const consumed = new Set(
    Object.keys(record).filter(
      (key) =>
        isRoleTitleKey(key) ||
        isExperienceKey(key) ||
        isJobMetaKey(key) ||
        ['summary', 'skills', 'education', 'educations'].includes(key.toLowerCase()),
    ),
  )
  for (const key of Object.keys(record)) {
    if (consumed.has(key) || isEmptyResumeValue(record[key])) {
      continue
    }
    const body = bulletBlock(resumeToBullets(record[key]))
    if (body) {
      parts.push(`${humanizeResumeKey(key)}\n${body}`)
    }
  }

  const educationLines = (educationHistory ?? [])
    .map(formatEducationLine)
    .filter((line) => line.trim().length > 0)
  if (educationLines.length > 0) {
    parts.push(`Education\n${educationLines.join('\n')}`)
  } else if (!isEmptyResumeValue(education)) {
    parts.push(`Education\n${resumeToBullets(education).join('\n')}`)
  }

  return parts.filter(Boolean).join('\n\n') || stripMarkdownBold(content).trim()
}

