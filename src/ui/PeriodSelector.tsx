import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'

import { Button } from './chrome'
import { DateRangePicker } from './DateRangePicker'
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

  function applyCustom(nextFrom: string, nextTo: string) {
    setPreset('custom')
    setFromDate(nextFrom)
    setToDate(nextTo)
    setApplied({ preset: 'custom', fromDate: nextFrom, toDate: nextTo })
  }

  return {
    preset,
    fromDate,
    toDate,
    setFromDate,
    setToDate,
    onPreset,
    applyFilter,
    applyCustom,
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
  onRange,
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
  /** Picking a range on the calendar switches to Custom; when set, it applies immediately. */
  onRange?: (fromDate: string, toDate: string) => void
  onFilter?: () => void
  onRefresh?: () => void
  label?: string
}) {
  const shown = datesForPreset(preset, fromDate, toDate)

  function pickRange(nextFrom: string, nextTo: string) {
    if (onRange) {
      onRange(nextFrom, nextTo)
      return
    }
    onPreset('custom')
    onFromDate(nextFrom)
    onToDate(nextTo)
  }

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
        <label htmlFor="period-dates">Dates</label>
        <DateRangePicker
          id="period-dates"
          from={shown.fromDate}
          to={shown.toDate}
          onChange={pickRange}
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
