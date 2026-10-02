import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'

import type { TaskPerson } from '../../api/types'
import { PersonAvatar } from './task-bits'

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  BID_MANAGER: 'Bid Manager',
  BIDDER: 'Bidder',
}

type Anchor = { top: number; left: number; width: number; above: boolean }

/** Multi-select for assignees. Changes are committed when the popover closes. */
export function MemberPicker({
  people,
  selected,
  currentUserId,
  disabled = false,
  onChange,
}: {
  people: TaskPerson[]
  selected: TaskPerson[]
  currentUserId: number | undefined
  disabled?: boolean
  onChange: (ids: number[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<number[]>([])
  const [query, setQuery] = useState('')
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const options = useMemo(() => {
    const byId = new Map(people.map((person) => [person.id, person]))
    for (const person of selected) {
      if (!byId.has(person.id)) byId.set(person.id, person)
    }
    return [...byId.values()].sort((left, right) => {
      if (left.id === currentUserId) return -1
      if (right.id === currentUserId) return 1
      return left.name.localeCompare(right.name)
    })
  }, [people, selected, currentUserId])

  const filtered = query.trim()
    ? options.filter((person) => person.name.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  function place() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const above = window.innerHeight - rect.bottom < 320 && rect.top > 320
    setAnchor({
      top: above ? rect.top - 6 : rect.bottom + 6,
      left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, 280) - 8),
      width: Math.max(rect.width, 280),
      above,
    })
  }

  function show() {
    if (disabled) return
    setDraft(selected.map((person) => person.id))
    setQuery('')
    place()
    setOpen(true)
  }

  function close() {
    setOpen(false)
    const before = selected.map((person) => person.id).sort((a, b) => a - b).join(',')
    const after = [...draft].sort((a, b) => a - b).join(',')
    if (before !== after) onChange(draft)
  }

  function toggle(id: number) {
    setDraft((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  }

  useLayoutEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      const target = event.target as Node
      if (popRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      close()
    }
    function onMove() {
      place()
    }
    document.addEventListener('mousedown', onPointer)
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  })

  return (
    <>
      <div
        ref={triggerRef}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-disabled={disabled}
        className={`tsk-picker${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`}
        onClick={() => (open ? close() : show())}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
            event.preventDefault()
            if (!open) show()
          }
        }}
      >
        {selected.length === 0 ? (
          <span className="tsk-picker-empty">Unassigned</span>
        ) : (
          selected.map((person) => (
            <span key={person.id} className="tsk-chip">
              <PersonAvatar person={person} />
              {person.name}
              {!disabled ? (
                <button
                  type="button"
                  aria-label={`Remove ${person.name}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onChange(selected.filter((item) => item.id !== person.id).map((item) => item.id))
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </span>
          ))
        )}
        {!disabled ? <ChevronDown className="tsk-picker-caret h-4 w-4" aria-hidden="true" /> : null}
      </div>

      {open && anchor
        ? createPortal(
            <div
              ref={popRef}
              className="tsk-pop"
              style={{
                top: anchor.top,
                left: anchor.left,
                width: anchor.width,
                transform: anchor.above ? 'translateY(-100%)' : undefined,
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation()
                  close()
                }
              }}
            >
              <label className="tsk-pop-search">
                <Search className="h-4 w-4" aria-hidden="true" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search members"
                  aria-label="Search members"
                />
              </label>
              <ul className="tsk-pop-list" role="listbox" aria-multiselectable="true">
                {filtered.map((person) => {
                  const on = draft.includes(person.id)
                  return (
                    <li key={person.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={on}
                        className={on ? 'is-on' : ''}
                        onClick={() => toggle(person.id)}
                      >
                        <span className="tsk-pop-check">{on ? <Check className="h-3 w-3" /> : null}</span>
                        <PersonAvatar person={person} />
                        <span className="tsk-pop-name">
                          {person.name}
                          {person.id === currentUserId ? <em> (me)</em> : null}
                        </span>
                        <span className="tsk-pop-role">{ROLE_LABEL[person.role] ?? person.role}</span>
                      </button>
                    </li>
                  )
                })}
                {filtered.length === 0 ? <li className="tsk-pop-empty">No members found</li> : null}
              </ul>
              <div className="tsk-pop-foot">
                <span>{draft.length} selected</span>
                {draft.length > 0 ? (
                  <button type="button" onClick={() => setDraft([])}>
                    Clear
                  </button>
                ) : null}
                <button type="button" className="is-primary" onClick={close}>
                  Done
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
