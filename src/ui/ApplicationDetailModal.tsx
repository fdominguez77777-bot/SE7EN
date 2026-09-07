import { useState } from 'react'
import { Check, Copy, ExternalLink, X } from 'lucide-react'

import type { ApplicationTableRow } from '../api/types'
import { formatApplicationCopy } from './application-resume'
import { ApplicationResume } from './ApplicationResume'
import { Button } from './chrome'
import { jobApplicationStatusLabel, safeHttpUrl } from './job-application'

const STATUSES = ['Draft', 'Applied']

function sameChoice(current: string | null | undefined, option: string) {
  return (current || '').trim().toLowerCase() === option.toLowerCase()
}

function formatStamp(iso: string | null | undefined) {
  if (!iso) {
    return ''
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return date.toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  })
}

export function ApplicationDetailModal({
  application,
  loading,
  onClose,
}: {
  application: ApplicationTableRow
  loading: boolean
  onClose: () => void
}) {
  const jobUrl = safeHttpUrl(application.jobUrl)
  const resumeUrl = safeHttpUrl(application.resumeUrl)
  const interviews = application.interviews ?? []
  const history = application.statusHistory ?? []
  const [copied, setCopied] = useState(false)

  async function copyApplication() {
    const text = formatApplicationCopy({
      jobDescriptionText: application.jobDescriptionText,
      resumeText: application.resumeText,
      workHistory: application.profileWorkHistory,
      educationHistory: application.profileEducation,
    })
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="apps-modal" onClick={onClose} role="presentation">
      <div
        className="apps-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="apps-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="apps-modal-head">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--text-muted)] uppercase">
              {application.companyName}
            </p>
            <h2
              id="apps-detail-title"
              className="mt-1 text-[22px] font-bold tracking-tight text-[var(--text-primary)]"
            >
              {application.jobTitle}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {application.salary ? (
                <span className="apps-choice is-on">Salary: {application.salary}</span>
              ) : null}
              {application.expYears ? (
                <span className="apps-choice is-on">Experience: {application.expYears}</span>
              ) : null}
            </div>
          </div>
          <div className="apps-modal-actions">
            {jobUrl ? (
              <a
                className="apps-icon-btn"
                href={jobUrl}
                target="_blank"
                rel="noreferrer"
                title="Open job URL"
                aria-label="Open job URL"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : (
              <button
                type="button"
                className="apps-icon-btn"
                disabled
                title="No job URL"
                aria-label="No job URL"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              className="apps-icon-btn"
              onClick={() => void copyApplication()}
              title={copied ? 'Copied' : 'Copy job description and resume'}
              aria-label={copied ? 'Copied' : 'Copy job description and resume'}
              disabled={loading}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
            <Button variant="ghost" onClick={onClose} className="shrink-0">
              <X className="h-4 w-4" />
              Close
            </Button>
          </div>
        </div>

        <div className="space-y-3 border-b border-[var(--border-subtle)] px-[22px] py-3">
          <div className="apps-pill-row">
            <span className="w-16 text-[12px] font-semibold text-[var(--text-muted)]">Status:</span>
            {STATUSES.map((status) => (
              <span
                key={status}
                className={`apps-choice apps-choice-${status.toLowerCase()} ${sameChoice(application.status, status) ? 'is-on' : ''}`}
              >
                {status}
              </span>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="px-[22px] py-8 text-[13px] text-[var(--text-muted)]">Loading details…</p>
        ) : (
          <div className="apps-modal-split">
            <div className="apps-modal-main">
              <div className="apps-block-bar">Job Description</div>
              <div className="apps-block-body">
                {application.jobDescriptionText || 'No job description available.'}
              </div>
              <div className="apps-block-bar">Resume</div>
              <div className="apps-block-body">
                {resumeUrl ? (
                  <p className="mb-3">
                    <a
                      href={resumeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--accent)] hover:text-[var(--accent-hover)]"
                    >
                      Open resume
                    </a>
                  </p>
                ) : null}
                {application.resumeText ? (
                  <ApplicationResume
                    content={application.resumeText}
                    workHistory={application.profileWorkHistory}
                    educationHistory={application.profileEducation}
                  />
                ) : resumeUrl ? null : (
                  <p>No resume text available.</p>
                )}
              </div>
            </div>
            <aside className="apps-modal-side">
              <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Status history</h3>
              <ul className="mt-2 space-y-2 text-[13px] text-[var(--text-secondary)]">
                {history.length === 0 ? (
                  <li>
                    {jobApplicationStatusLabel(application.status)}
                    {application.appliedAt ? ` at ${formatStamp(application.appliedAt)}` : ''}
                  </li>
                ) : (
                  history.map((entry) => (
                    <li key={entry.id}>
                      {jobApplicationStatusLabel(entry.status || '')}
                      {entry.changedAt ? ` at ${formatStamp(entry.changedAt)}` : ''}
                      {entry.changedBy ? ` by ${entry.changedBy}` : ''}
                    </li>
                  ))
                )}
              </ul>

              <h3 className="mt-6 text-[13px] font-bold text-[var(--text-primary)]">
                Related interviews
              </h3>
              <input
                className="input-field mt-2"
                placeholder="Search your calendar events..."
                readOnly
              />
              {interviews.length === 0 ? (
                <p className="mt-2 text-[13px] text-[var(--text-muted)]">No interviews linked yet.</p>
              ) : (
                <ul className="mt-2 space-y-2 text-[13px] text-[var(--text-secondary)]">
                  {interviews.map((item) => (
                    <li key={item.id}>
                      {item.summary || 'Interview'}
                      {item.startsAt ? ` · ${formatStamp(item.startsAt)}` : ''}
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="mt-6 text-[13px] font-bold text-[var(--text-primary)]">Notes</h3>
              <textarea
                className="input-field mt-2 min-h-28"
                placeholder="Add notes about this application..."
                value={application.notes || ''}
                readOnly
              />
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}
