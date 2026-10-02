import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

import { parseLocalDate, toIsoDate } from './reporting-period'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const GAP = 6
const EDGE = 8

function monthKey(iso: string) {
  return iso.slice(0, 7)
}

function shiftMonthKey(ym: string, delta: number) {
  const [year, month] = ym.split('-').map(Number)
  const date = new Date(year, month - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthTitle(ym: string) {
  return parseLocalDate(`${ym}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function monthCells(ym: string) {
  const first = parseLocalDate(`${ym}-01`)
  const start = new Date(first)
  start.setDate(1 - first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const iso = toIsoDate(date)
    return { iso, day: date.getDate(), weekday: date.getDay(), outside: monthKey(iso) !== ym }
  })
}

function ordered(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a]
}

function formatRangeText(from: string, to: string) {
  if (!from || !to) return 'Select dates'
  const [start, end] = ordered(from, to)
  const a = parseLocalDate(start)
  const b = parseLocalDate(end)
  const full: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  if (start === end) return b.toLocaleDateString('en-US', full)
  const left = a.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: a.getFullYear() === b.getFullYear() ? undefined : 'numeric',
  })
  return `${left} – ${b.toLocaleDateString('en-US', full)}`
}

function useNarrow() {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 640px)')
    const update = () => setNarrow(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return narrow
}

export function DateRangePicker({
  from,
  to,
  onChange,
  onClose,
  id,
  max,
  defaultOpen = false,
  disabled = false,
  className = '',
}: {
  from: string
  to: string
  onChange: (from: string, to: string) => void
  onClose?: () => void
  id?: string
  max?: string
  defaultOpen?: boolean
  disabled?: boolean
  className?: string
}) {
  const narrow = useNarrow()
  const monthsShown = narrow ? 1 : 2
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(defaultOpen)
  const [view, setView] = useState(() => monthKey(from || toIsoDate(new Date())))
  const [anchor, setAnchor] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const drag = useRef({ active: false, moved: false })
  const today = toIsoDate(new Date())

  useEffect(() => setMounted(true), [])

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const close = useCallback(() => {
    setOpen(false)
    setAnchor(null)
    setHover(null)
    drag.current = { active: false, moved: false }
    onCloseRef.current?.()
  }, [])

  function openPicker() {
    if (disabled) return
    setView(monthKey(from || today))
    setAnchor(null)
    setHover(null)
    setOpen(true)
  }

  const place = useCallback(() => {
    const trigger = triggerRef.current
    const pop = popRef.current
    if (!trigger || !pop) return
    const rect = trigger.getBoundingClientRect()
    const width = pop.offsetWidth
    const height = pop.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    const left = Math.min(Math.max(EDGE, rect.left), Math.max(EDGE, vw - width - EDGE))
    const below = rect.bottom + GAP
    const top = below + height > vh - EDGE && rect.top - GAP - height >= EDGE ? rect.top - GAP - height : below
    setPosition({ top, left, visibility: 'visible' })
  }, [])

  useLayoutEffect(() => {
    if (!open || !mounted) return
    place()
  }, [open, mounted, monthsShown, view, place])

  useEffect(() => {
    if (!open) return
    function onDown(event: PointerEvent) {
      const target = event.target as Node
      if (popRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      close()
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      if (anchor) {
        setAnchor(null)
        setHover(null)
      } else {
        close()
        triggerRef.current?.focus()
      }
    }
    function onUp() {
      const state = drag.current
      if (!state.active) return
      drag.current = { active: false, moved: false }
      if (state.moved && anchor && hover && hover !== anchor) commit(anchor, hover)
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  })

  function commit(a: string, b: string) {
    const [start, end] = ordered(a, b)
    onChange(start, end)
    close()
  }

  function pick(iso: string) {
    if (max && iso > max) return
    if (!anchor) {
      setAnchor(iso)
      setHover(iso)
      return
    }
    commit(anchor, iso)
  }

  function dateAt(event: ReactPointerEvent) {
    const node = document.elementFromPoint(event.clientX, event.clientY)
    const cell = node instanceof Element ? node.closest<HTMLElement>('[data-date]') : null
    const iso = cell?.dataset.date
    if (!iso || (max && iso > max)) return null
    return iso
  }

  function onDayDown(event: ReactPointerEvent, iso: string) {
    if (event.button !== 0) return
    event.preventDefault()
    if (max && iso > max) return
    if (!anchor) {
      setAnchor(iso)
      setHover(iso)
      drag.current = { active: true, moved: false }
      return
    }
    commit(anchor, iso)
  }

  function onGridMove(event: ReactPointerEvent) {
    if (!anchor) return
    const iso = dateAt(event)
    if (!iso) return
    if (iso !== hover) setHover(iso)
    if (drag.current.active && iso !== anchor) drag.current.moved = true
  }

  function onDayKey(event: ReactKeyboardEvent, iso: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      pick(iso)
    }
  }

  const [rangeStart, rangeEnd] = anchor ? ordered(anchor, hover ?? anchor) : from && to ? ordered(from, to) : ['', '']
  const months = Array.from({ length: monthsShown }, (_, index) => shiftMonthKey(view, index))
  const canNext = !max || shiftMonthKey(view, monthsShown) <= monthKey(max)

  const popover = open && mounted
    ? createPortal(
        <div
          ref={popRef}
          className={`drp-pop${anchor ? ' is-picking' : ''}`}
          style={position}
          role="dialog"
          aria-label="Choose a date range"
        >
          <div className="drp-months">
            {months.map((ym, monthIndex) => (
              <div key={ym} className="drp-month">
                <div className="drp-head">
                  <strong>{monthTitle(ym)}</strong>
                  {monthIndex === months.length - 1 ? (
                    <div className="drp-nav">
                      <button type="button" aria-label="Previous month" onClick={() => setView((v) => shiftMonthKey(v, -1))}>
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Next month"
                        disabled={!canNext}
                        onClick={() => setView((v) => shiftMonthKey(v, 1))}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="drp-grid" onPointerMove={onGridMove}>
                  {WEEKDAYS.map((label, index) => (
                    <span key={`${label}-${index}`} className="drp-weekday">
                      {label}
                    </span>
                  ))}
                  {monthCells(ym).map((cell) => {
                    const off = Boolean(max && cell.iso > max)
                    const inRange = !cell.outside && rangeStart && cell.iso >= rangeStart && cell.iso <= rangeEnd
                    const isStart = !cell.outside && cell.iso === rangeStart
                    const isEnd = !cell.outside && cell.iso === rangeEnd
                    const classes = [
                      'drp-day',
                      cell.outside ? 'is-outside' : '',
                      cell.iso === today ? 'is-today' : '',
                      inRange ? 'is-in' : '',
                      isStart ? 'is-start' : '',
                      isEnd ? 'is-end' : '',
                      inRange && (cell.weekday === 0 || cell.day === 1) ? 'is-row-start' : '',
                      inRange && (cell.weekday === 6 || monthKey(shiftIso(cell.iso, 1)) !== ym) ? 'is-row-end' : '',
                      off ? 'is-off' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')
                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        data-date={cell.iso}
                        className={classes}
                        disabled={off}
                        tabIndex={cell.outside ? -1 : 0}
                        aria-pressed={isStart || isEnd}
                        aria-label={parseLocalDate(cell.iso).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        onPointerDown={(event) => onDayDown(event, cell.iso)}
                        onKeyDown={(event) => onDayKey(event, cell.iso)}
                      >
                        <span>{cell.day}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="drp-foot">
            <span>{anchor ? `Start ${formatRangeText(anchor, anchor)} · pick an end date` : 'Click a start date, then an end date'}</span>
            <button type="button" onClick={close}>
              Cancel
            </button>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`input-field drp-trigger${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? close() : openPicker())}
      >
        <CalendarDays className="h-4 w-4" />
        <span>{formatRangeText(from, to)}</span>
      </button>
      {popover}
    </>
  )
}

function shiftIso(iso: string, days: number) {
  const date = parseLocalDate(iso)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}
