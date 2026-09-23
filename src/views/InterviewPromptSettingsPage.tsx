import { type FormEvent, useMemo, useState } from 'react'
import { Link } from '@/lib/navigation'

import { Alert, Button, SectionCard } from '../ui/chrome'
import { PageHeader } from '../ui/page-header'
import {
  DEFAULT_INTERVIEW_PROMPT_TEMPLATE,
  INTERVIEW_PROMPT_PLACEHOLDERS,
  readInterviewPromptTemplate,
  resetInterviewPromptTemplate,
  writeInterviewPromptTemplate,
} from '../ui/interview-prompt'

export function InterviewPromptSettingsPage() {
  const [draft, setDraft] = useState(() => readInterviewPromptTemplate())
  const [saved, setSaved] = useState(() => readInterviewPromptTemplate())
  const [notice, setNotice] = useState('')
  const dirty = draft !== saved

  const missingPlaceholders = useMemo(() => {
    return INTERVIEW_PROMPT_PLACEHOLDERS.filter(
      ({ token }) => !draft.includes(token),
    ).map(({ token }) => token)
  }, [draft])

  function onSave(event: FormEvent) {
    event.preventDefault()
    const next = writeInterviewPromptTemplate(draft)
    setDraft(next)
    setSaved(next)
    setNotice('Interview prompt template saved. Copy interview prompt will use this text.')
  }

  function onReset() {
    const next = resetInterviewPromptTemplate()
    setDraft(next)
    setSaved(next)
    setNotice('Restored the default interview prompt template.')
  }

  return (
    <section>
      <PageHeader
        eyebrow="Admin"
        title="Interview prompt"
        description="Edit the template used when you copy an interview prompt from an application. Placeholders are filled from that application."
        actions={
          <Link
            to="/applications"
            className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]"
          >
            Open applications
          </Link>
        }
      />

      {notice ? (
        <div className="mt-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}

      {missingPlaceholders.length > 0 ? (
        <div className="mt-4">
          <Alert tone="info">
            Missing placeholders: {missingPlaceholders.join(', ')}. Save still works — those
            fields just will not be filled when copying.
          </Alert>
        </div>
      ) : null}

      <form onSubmit={onSave} className="mt-5 space-y-4">
        <SectionCard title="Template">
          <p className="text-sm text-[var(--text-secondary)]">
            Use these tokens in the text below. They are replaced when you copy from an
            application.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {INTERVIEW_PROMPT_PLACEHOLDERS.map(({ token, label }) => (
              <li key={token}>
                <button
                  type="button"
                  className="rounded-md border border-[var(--border-glass)] bg-white/[0.04] px-2.5 py-1.5 text-left text-xs transition hover:bg-white/[0.08]"
                  title={label}
                  onClick={() => {
                    setDraft((current) => `${current}${current.endsWith('\n') ? '' : '\n'}${token}`)
                    setNotice('')
                  }}
                >
                  <span className="font-mono text-[var(--accent)]">{token}</span>
                  <span className="mt-0.5 block text-[10px] text-[var(--text-muted)]">
                    {label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <label className="mt-4 block">
            <span className="sr-only">Interview prompt template</span>
            <textarea
              className="input-field mt-1 min-h-[28rem] font-mono text-[12px] leading-relaxed"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value)
                setNotice('')
              }}
              spellCheck={false}
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="submit" disabled={!dirty}>
              {dirty ? 'Save template' : 'Saved'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onReset}
              disabled={draft === DEFAULT_INTERVIEW_PROMPT_TEMPLATE}
            >
              Reset to default
            </Button>
          </div>
        </SectionCard>
      </form>
    </section>
  )
}
