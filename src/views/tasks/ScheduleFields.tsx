import type { TaskRepeat } from '../../api/types'
import { repeatMask, WEEKDAY_LABELS, WORKDAYS_MASK, type TaskSchedule } from '../../lib/task-schedule'
import { todayIso } from './task-meta'

const REPEAT_OPTIONS: { id: TaskRepeat; label: string }[] = [
  { id: 'NONE', label: 'One time' },
  { id: 'DAILY', label: 'Every day' },
  { id: 'WEEKDAYS', label: 'Work days' },
  { id: 'CUSTOM', label: 'Custom' },
]

export function ScheduleFields({
  value,
  onChange,
  disabled = false,
  compact = false,
}: {
  value: TaskSchedule
  onChange: (next: TaskSchedule) => void
  disabled?: boolean
  compact?: boolean
}) {
  function setRepeat(repeat: TaskRepeat) {
    if (repeat === value.repeat) return
    const today = todayIso()
    if (repeat === 'NONE') {
      onChange({ ...value, repeat, repeatDays: null, endDate: null, dueDate: value.dueDate ?? today })
      return
    }
    onChange({
      ...value,
      repeat,
      repeatDays: repeat === 'CUSTOM' ? repeatMask(value) || WORKDAYS_MASK : null,
      startDate: value.repeat === 'NONE' ? (value.dueDate && value.dueDate > today ? value.dueDate : today) : value.startDate,
      dueDate: null,
    })
  }

  function toggleDay(index: number) {
    const mask = repeatMask(value) ^ (1 << index)
    if (mask === 0) return
    onChange({ ...value, repeatDays: mask })
  }

  const mask = repeatMask(value)

  return (
    <div className={`tsk-schedule${compact ? ' is-compact' : ''}`}>
      <div className="tsk-repeat" role="radiogroup" aria-label="Repeat">
        {REPEAT_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={value.repeat === option.id}
            className={value.repeat === option.id ? 'is-on' : ''}
            disabled={disabled}
            onClick={() => setRepeat(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {value.repeat === 'CUSTOM' ? (
        <div className="tsk-weekdays" role="group" aria-label="Repeat on">
          {WEEKDAY_LABELS.map((label, index) => {
            const on = (mask & (1 << index)) !== 0
            return (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                className={on ? 'is-on' : ''}
                disabled={disabled}
                onClick={() => toggleDay(index)}
                title={label}
              >
                {label.slice(0, 2)}
              </button>
            )
          })}
        </div>
      ) : null}

      {value.repeat === 'NONE' ? (
        <label className="tsk-label">
          <span>Due date</span>
          <input
            type="date"
            className="input-field tsk-side-input"
            value={value.dueDate ?? ''}
            disabled={disabled}
            required
            onChange={(event) => event.target.value && onChange({ ...value, dueDate: event.target.value })}
          />
        </label>
      ) : (
        <div className="tsk-schedule-dates">
          <label className="tsk-label">
            <span>Starts</span>
            <input
              type="date"
              className="input-field tsk-side-input"
              value={value.startDate}
              disabled={disabled}
              required
              onChange={(event) => event.target.value && onChange({ ...value, startDate: event.target.value })}
            />
          </label>
          <label className="tsk-label">
            <span>
              Until <em>optional</em>
            </span>
            <input
              type="date"
              className="input-field tsk-side-input"
              value={value.endDate ?? ''}
              min={value.startDate}
              disabled={disabled}
              onChange={(event) => onChange({ ...value, endDate: event.target.value || null })}
            />
          </label>
        </div>
      )}
    </div>
  )
}
