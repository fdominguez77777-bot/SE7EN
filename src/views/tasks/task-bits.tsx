import type { TaskPerson } from '../../api/types'
import { EntityAvatar } from '../../ui/avatar'

export function PersonAvatar({ person, done = false }: { person: TaskPerson | null; done?: boolean }) {
  if (!person) {
    return (
      <span className="tsk-avatar is-empty" title="Unassigned">
        <span className="sr-only">Unassigned</span>
      </span>
    )
  }
  return (
    <span className={`tsk-avatar${done ? ' is-done' : ''}`} title={done ? `${person.name} · done` : person.name}>
      <EntityAvatar name={person.name} src={person.avatarUrl} size="sm" tone="accent" />
    </span>
  )
}

export function AvatarStack({
  people,
  max = 3,
  doneIds = [],
}: {
  people: TaskPerson[]
  max?: number
  doneIds?: number[]
}) {
  if (people.length === 0) {
    return <PersonAvatar person={null} />
  }
  const shown = people.slice(0, max)
  const extra = people.length - shown.length
  return (
    <span
      className="tsk-stack"
      title={people.map((person) => `${person.name}${doneIds.includes(person.id) ? ' ✓' : ''}`).join(', ')}
    >
      {shown.map((person) => (
        <PersonAvatar key={person.id} person={person} done={doneIds.includes(person.id)} />
      ))}
      {extra > 0 ? <span className="tsk-stack-more">+{extra}</span> : null}
    </span>
  )
}