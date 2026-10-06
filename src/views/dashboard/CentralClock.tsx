import { useEffect, useId, useState } from 'react'

import { WatchFace, WatchHands } from './WatchFace'

const CHICAGO_TZ = 'America/Chicago'

type ClockState = {
  hour: number
  minute: number
  second: number
  day: string
  label: string
}

function readChicagoClock(now = new Date()): ClockState {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CHICAGO_TZ,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
    day: '2-digit',
    weekday: 'long',
    month: 'short',
  }).formatToParts(now)

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return {
    hour: Number(pick('hour')) || 0,
    minute: Number(pick('minute')) || 0,
    second: Number(pick('second')) || 0,
    day: pick('day'),
    label: `${pick('weekday')} · ${pick('month')} ${Number(pick('day'))}`,
  }
}

export function CentralClock() {
  const uid = useId().replace(/:/g, '')
  const [clock, setClock] = useState(() => readChicagoClock())

  useEffect(() => {
    const tick = () => setClock(readChicagoClock())
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="dash-watch" aria-hidden="true">
      <div className="dash-watch-case">
        <WatchFace uid={uid} windowText={clock.day}>
          <WatchHands hour={clock.hour} minute={clock.minute} second={clock.second} />
        </WatchFace>
      </div>
    </div>
  )
}
