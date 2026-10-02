import type { TaskPerson } from '../../api/types'
import { EntityAvatar } from '../../ui/avatar'

export function PersonAvatar({ person }: { person: TaskPerson | null }) {
  if (!person) {
    return (
      <span className="tsk-avatar is-empty" title="Unassigned">
        <span className="sr-only">Unassigned</span>
      </span>
    )
  }
  return (
    <span className="tsk-avatar" title={person.name}>
      <EntityAvatar name={person.name} src={person.avatarUrl} size="sm" tone="accent" />
    </span>
  )
}

export function AvatarStack({ people, max = 3 }: { people: TaskPerson[]; max?: number }) {
  if (people.length === 0) {
    return <PersonAvatar person={null} />
  }
  const shown = people.slice(0, max)
  const extra = people.length - shown.length
  return (
    <span className="tsk-stack" title={people.map((person) => person.name).join(', ')}>
      {shown.map((person) => (
        <PersonAvatar key={person.id} person={person} />
      ))}
      {extra > 0 ? <span className="tsk-stack-more">+{extra}</span> : null}
    </span>
  )
}