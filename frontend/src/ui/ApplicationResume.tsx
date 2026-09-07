import type { ReactNode } from 'react'

import {
  asResumeRecord,
  applyProfileWorkHistory,
  collectPairedJobs,
  collectResumeKeywords,
  emphasizeResumeKeywords,
  formatEducationLine,
  formatResumeScalar,
  hydrateResume,
  humanizeResumeKey,
  isEmptyResumeValue,
  isExperienceKey,
  isJobMetaKey,
  isPrimitiveResumeValue,
  isRoleTitleKey,
  parsePipeHeader,
  parseResumeJson,
  pickResume,
  resolveJobHeader,
  resumeToBullets,
  type PairedResumeJob,
  type ProfileEducationItem,
  type ProfileWorkHistoryItem,
} from './application-resume'

function Heading({ children }: { children: ReactNode }) {
  return <h3 className="apps-resume-heading">{children}</h3>
}

function Subheading({ children }: { children: ReactNode }) {
  return <p className="apps-resume-job-title">{children}</p>
}

function Bullets({
  items,
  keywords,
  indented,
}: {
  items: string[]
  keywords?: string[]
  indented?: boolean
}) {
  if (items.length === 0) {
    return null
  }
  return (
    <ul className={`apps-resume-list ${indented ? 'apps-resume-job-list' : ''}`}>
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>
          {keywords && keywords.length > 0 ? (
            <KeywordText text={item} keywords={keywords} />
          ) : (
            item
          )}
        </li>
      ))}
    </ul>
  )
}

function KeywordText({ text, keywords }: { text: string; keywords: string[] }) {
  return (
    <>
      {emphasizeResumeKeywords(text, keywords).map((part, index) =>
        part.bold ? <strong key={index}>{part.text}</strong> : <span key={index}>{part.text}</span>,
      )}
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  if (!children) {
    return null
  }
  return (
    <section className="apps-resume-section">
      <Heading>{title}</Heading>
      {children}
    </section>
  )
}

function scalarText(value: unknown): string | null {
  if (isPrimitiveResumeValue(value)) {
    return formatResumeScalar(value)
  }
  return null
}

function jobHeader(job: PairedResumeJob): string {
  return resolveJobHeader(job)
}

function jobRecords(experience: unknown): string[] {
  const headerLine = (() => {
    if (typeof experience === 'string') {
      return experience.split(/\n/)[0]?.trim() || null
    }
    if (Array.isArray(experience) && typeof experience[0] === 'string') {
      return experience[0].trim()
    }
    return null
  })()
  const piped = parsePipeHeader(headerLine)
  const skipHeader = Boolean(piped?.company || piped?.date)

  if (Array.isArray(experience) && experience.every((item) => !asResumeRecord(item))) {
    const bullets = resumeToBullets(experience)
    return skipHeader ? bullets.filter((item) => item !== headerLine) : bullets
  }
  const record = asResumeRecord(experience)
  if (!record) {
    const bullets = resumeToBullets(experience)
    return skipHeader ? bullets.filter((item) => item !== headerLine) : bullets
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
  const leftover = Object.entries(record).filter(([key]) => {
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
  return leftover.flatMap(([, value]) => resumeToBullets(value))
}

function skillGroupLine(item: unknown): string | null {
  const record = asResumeRecord(item)
  if (!record) {
    return scalarText(item)
  }
  const category = pickResume(record, ['group', 'category', 'name', 'label', 'title'])
  const keywords = pickResume(record, ['keywords', 'skills', 'items', 'list', 'values'])
  const used = new Set([category?.key, keywords?.key].filter(Boolean))
  const extras = Object.entries(record)
    .filter(([key]) => !used.has(key))
    .flatMap(([, nested]) => resumeToBullets(nested))
  const items = [...resumeToBullets(keywords?.value ?? []), ...extras]
  const name = typeof category?.value === 'string' ? category.value : null
  if (name && items.length > 0) {
    return `${name}: ${items.join(', ')}`
  }
  if (name) {
    return name
  }
  if (items.length > 0) {
    return items.join(', ')
  }
  return null
}

function renderSkills(value: unknown) {
  if (Array.isArray(value)) {
    if (value.every(isPrimitiveResumeValue)) {
      return <Bullets items={value.map(formatResumeScalar)} />
    }
    return (
      <Bullets
        items={value.map(skillGroupLine).filter((line): line is string => Boolean(line))}
      />
    )
  }
  const record = asResumeRecord(value)
  if (record) {
    return (
      <Bullets
        items={Object.entries(record)
          .map(([category, keywords]) => {
            const items = resumeToBullets(keywords)
            if (items.length === 0) {
              return null
            }
            return `${humanizeResumeKey(category)}: ${items.join(', ')}`
          })
          .filter((line): line is string => Boolean(line))}
      />
    )
  }
  return <Bullets items={resumeToBullets(value)} />
}

function renderEducation(
  value: unknown,
  fromProfile: ProfileEducationItem[] | undefined,
) {
  const profileLines = (fromProfile ?? [])
    .map(formatEducationLine)
    .filter((line) => line.trim().length > 0)
  if (profileLines.length > 0) {
    return (
      <div className="space-y-2">
        {profileLines.map((line, index) => (
          <p key={`${line}-${index}`} className="apps-resume-education-line">
            {line}
          </p>
        ))}
      </div>
    )
  }

  const items = Array.isArray(value) ? value : value ? [value] : []
  if (items.length === 0) {
    return null
  }
  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const record = asResumeRecord(item)
        if (!record) {
          const text = scalarText(item)
          return text ? (
            <p key={index} className="apps-resume-education-line">
              {text}
            </p>
          ) : null
        }
        const school = pickResume(record, [
          'school',
          'institution',
          'institutionName',
          'university',
          'college',
          'name',
        ])
        const degree = pickResume(record, ['degree', 'credential', 'field', 'major'])
        const date = pickResume(record, [
          'date',
          'dates',
          'period',
          'year',
          'fromDate',
          'toDate',
          'startDate',
          'endDate',
        ])
        const line = [
          scalarText(degree?.value),
          scalarText(school?.value),
          scalarText(date?.value),
        ]
          .filter(Boolean)
          .join(' | ')
        return line ? (
          <p key={index} className="apps-resume-education-line">
            {line}
          </p>
        ) : null
      })}
    </div>
  )
}

function renderExperienceJobs(jobs: PairedResumeJob[], keywords: string[]) {
  if (jobs.length === 0) {
    return null
  }
  return (
    <div className="space-y-6">
      {jobs.map((job) => (
        <article key={job.index} className="apps-resume-job">
          {jobHeader(job) ? <Subheading>{jobHeader(job)}</Subheading> : null}
          <Bullets items={jobRecords(job.experience)} keywords={keywords} indented />
        </article>
      ))}
    </div>
  )
}

function renderUnknown(value: unknown): ReactNode {
  if (isEmptyResumeValue(value)) {
    return null
  }
  if (isPrimitiveResumeValue(value) || Array.isArray(value)) {
    return <Bullets items={resumeToBullets(value)} />
  }
  const record = asResumeRecord(value)
  if (!record) {
    return null
  }
  return (
    <div className="space-y-3">
      {Object.entries(record).map(([key, nested]) => (
        <div key={key}>
          <p className="mb-1 text-[12px] font-semibold text-[var(--text-primary)]">
            {humanizeResumeKey(key)}
          </p>
          {renderUnknown(nested)}
        </div>
      ))}
    </div>
  )
}

export function ApplicationResume({
  content,
  workHistory,
  educationHistory,
}: {
  content: string | null | undefined
  workHistory?: ProfileWorkHistoryItem[]
  educationHistory?: ProfileEducationItem[]
}) {
  if (!content?.trim()) {
    return <p>No resume text available.</p>
  }

  const parsed = hydrateResume(parseResumeJson(content) ?? content)
  const record = asResumeRecord(parsed)
  if (!record) {
    return <p className="whitespace-pre-wrap">{content.trim()}</p>
  }

  const jobs = applyProfileWorkHistory(collectPairedJobs(record), workHistory)
  const keywords = collectResumeKeywords(record)
  const summary = record.summary ?? record.Summary
  const skills = record.skills ?? record.Skills
  const education = record.education ?? record.educations ?? record.Education
  const consumed = new Set(
    Object.keys(record).filter(
      (key) =>
        isRoleTitleKey(key) ||
        isExperienceKey(key) ||
        isJobMetaKey(key) ||
        ['summary', 'skills', 'education', 'educations'].includes(key.toLowerCase()),
    ),
  )
  const extras = Object.keys(record).filter(
    (key) => !consumed.has(key) && !isEmptyResumeValue(record[key]),
  )

  return (
    <div className="apps-resume">
      {isEmptyResumeValue(summary) ? null : (
        <Section title="Summary">
          <Bullets items={resumeToBullets(summary)} />
        </Section>
      )}
      {isEmptyResumeValue(skills) ? null : (
        <Section title="Skills">{renderSkills(skills)}</Section>
      )}
      {jobs.length > 0 ? (
        <Section title="Experience">{renderExperienceJobs(jobs, keywords)}</Section>
      ) : null}
      {extras.map((key) => (
        <Section key={key} title={humanizeResumeKey(key)}>
          {key.toLowerCase() === 'records' || key.toLowerCase() === 'projects' ? (
            <Bullets items={resumeToBullets(record[key])} />
          ) : (
            renderUnknown(record[key])
          )}
        </Section>
      ))}
      {isEmptyResumeValue(education) && !(educationHistory && educationHistory.length > 0) ? null : (
        <Section title="Education">{renderEducation(education, educationHistory)}</Section>
      )}
    </div>
  )
}
