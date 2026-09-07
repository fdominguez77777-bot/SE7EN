import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'

import { Button } from './chrome'
import {
  PERIOD_PRESET_OPTIONS,
  datesForPreset,
  resolveRange,
  type PeriodPreset,
} from './reporting-period'

export function usePeriodFilter(defaultPreset: PeriodPreset = 'today') {
  const initial = datesForPreset(defaultPreset, '', '')
  const [preset, setPreset] = useState<PeriodPreset>(defaultPreset)
  const [fromDate, setFromDate] = useState(initial.fromDate)
  const [toDate, setToDate] = useState(initial.toDate)
  const [applied, setApplied] = useState({
    preset: defaultPreset,
    fromDate: initial.fromDate,
    toDate: initial.toDate,
  })
  const range = useMemo(
    () => resolveRange(applied.preset, applied.fromDate, applied.toDate),
    [applied],
  )

  function onPreset(next: PeriodPreset) {
    setPreset(next)
    if (next === 'custom') {
      return
    }
    const dates = datesForPreset(next, fromDate, toDate)
    setFromDate(dates.fromDate)
    setToDate(dates.toDate)
    setApplied({ preset: next, fromDate: dates.fromDate, toDate: dates.toDate })
  }

  function applyFilter() {
    setApplied({ preset, fromDate, toDate })
  }

  return {
    preset,
    fromDate,
    toDate,
    setFromDate,
    setToDate,
    onPreset,
    applyFilter,
    range,
    applied,
  }
}

export function PeriodSelector({
  preset,
  fromDate,
  toDate,
  onPreset,
  onFromDate,
  onToDate,
  onFilter,
  onRefresh,
  label,
}: {
  preset: PeriodPreset
  fromDate: string
  toDate: string
  onPreset: (preset: PeriodPreset) => void
  onFromDate: (value: string) => void
  onToDate: (value: string) => void
  onFilter?: () => void
  onRefresh?: () => void
  label?: string
}) {
  const shown = datesForPreset(preset, fromDate, toDate)
  const custom = preset === 'custom'

  return (
    <div className="period-toolbar glass-toolbar">
      <div className="apps-field">
        <label htmlFor="period-range">Date Range</label>
        <select
          id="period-range"
          className="input-field"
          value={preset}
          onChange={(event) => onPreset(event.target.value as PeriodPreset)}
        >
          {PERIOD_PRESET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="apps-field">
        <label htmlFor="period-from">From</label>
        <input
          id="period-from"
          className="input-field"
          type="date"
          value={custom ? fromDate : shown.fromDate}
          disabled={!custom}
          onChange={(event) => onFromDate(event.target.value)}
        />
      </div>
      <div className="apps-field">
        <label htmlFor="period-to">To</label>
        <input
          id="period-to"
          className="input-field"
          type="date"
          value={custom ? toDate : shown.toDate}
          disabled={!custom}
          onChange={(event) => onToDate(event.target.value)}
        />
      </div>
      <div className="period-toolbar-actions">
        <Button type="button" onClick={() => onFilter?.()}>
          Filter
        </Button>
        {onRefresh ? (
          <Button type="button" variant="secondary" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        ) : null}
        {label ? <p className="period-toolbar-range">{label}</p> : null}
      </div>
    </div>
  )
}
