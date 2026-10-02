import { UserRole } from '../users/user-role.enum';

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_TYPES = ['TASK', 'BUG', 'REQUEST', 'IMPROVEMENT'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_SCOPES = ['all', 'mine', 'reported'] as const;
export type TaskScope = (typeof TASK_SCOPES)[number];

export const TaskActivityKind = {
  CREATED: 'CREATED',
  COMMENT: 'COMMENT',
  STATUS: 'STATUS',
  ASSIGNEE: 'ASSIGNEE',
  PRIORITY: 'PRIORITY',
  TYPE: 'TYPE',
  DUE_DATE: 'DUE_DATE',
  TITLE: 'TITLE',
  DESCRIPTION: 'DESCRIPTION',
  SCHEDULE: 'SCHEDULE',
  COMPLETED: 'COMPLETED',
  REOPENED: 'REOPENED',
} as const;
export type TaskActivityKind =
  (typeof TaskActivityKind)[keyof typeof TaskActivityKind];

export const TASK_MESSAGES = {
  notFound: 'Task not found.',
  forbidden: 'You do not have access to this task.',
  deleteForbidden: 'Only an admin can delete this task.',
  createForbidden: 'Only an admin can create tasks.',
  editForbidden: 'Only an admin can change this task.',
  commentForbidden: 'You can only delete your own comments.',
  assigneeInvalid: 'Choose an active teammate to assign.',
  titleRequired: 'Give the task a title.',
  dueDateInvalid: 'Due date must be a valid date.',
  commentRequired: 'Write a comment first.',
  occurrenceInvalid: 'This task is not scheduled on that day.',
  completeForbidden: 'Only an admin can complete or reopen a task.',
  dailyForbidden: 'Only assignees can complete their daily task.',
  taskClosed: 'This task is already completed.',
} as const;

const PRIORITY_RANK: Record<TaskPriority, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

type Actor = { id: number; role: string };
type Involvement = { reporterUserId: number | null; assigneeIds: number[] };

export function isInvolved(actor: Actor, task: Involvement) {
  return task.reporterUserId === actor.id || task.assigneeIds.includes(actor.id);
}

export function canViewTask(actor: Actor, task: Involvement) {
  return isInvolved(actor, task);
}

/** Admins plan the work: only they create tasks. */
export function canCreateTask(actor: Actor) {
  return actor.role === UserRole.ADMIN;
}

export function canEditTask(actor: Actor, task: Involvement) {
  return actor.role === UserRole.ADMIN && canViewTask(actor, task);
}

/** Closing (or reopening) the whole task is an admin decision. */
export function canCompleteTask(actor: Actor) {
  return actor.role === UserRole.ADMIN;
}

/** Each assignee ticks off their own part of the task, day by day. */
export function canCompleteDaily(actor: Actor, task: Involvement) {
  return task.assigneeIds.includes(actor.id);
}

export function canDeleteTask(actor: Actor, task: Involvement) {
  return canEditTask(actor, task);
}

export function taskKey(id: number) {
  return `TSK-${id}`;
}

/** Accepts "TSK-12", "tsk12" or "12" and returns the id. */
export function parseTaskKey(value: string): number | null {
  const match = /^\s*(?:tsk-?)?(\d{1,9})\s*$/i.exec(value);
  return match ? Number(match[1]) : null;
}

export function parseDueDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (
    date.getUTCFullYear() !== Number(y) ||
    date.getUTCMonth() !== Number(m) - 1 ||
    date.getUTCDate() !== Number(d)
  ) {
    return null;
  }
  return `${y}-${m}-${d}`;
}

export function isOverdue(
  task: { status: string; dueDate: string | null },
  today: string,
) {
  return Boolean(task.dueDate && task.status !== 'DONE' && task.dueDate < today);
}

export function compareTasks(
  left: { priority: string; dueDate: string | null; id: number },
  right: { priority: string; dueDate: string | null; id: number },
) {
  const byPriority =
    (PRIORITY_RANK[left.priority as TaskPriority] ?? 9) -
    (PRIORITY_RANK[right.priority as TaskPriority] ?? 9);
  if (byPriority !== 0) {
    return byPriority;
  }
  if (left.dueDate !== right.dueDate) {
    if (!left.dueDate) return 1;
    if (!right.dueDate) return -1;
    return left.dueDate < right.dueDate ? -1 : 1;
  }
  return right.id - left.id;
}

export type TaskSnapshot = {
  title: string;
  description: string | null;
  status: string;
  priority: string;
  type: string;
  dueDate: string | null;
  schedule: string;
  assignees: { id: number; name: string }[];
};

export type TaskChange = {
  kind: TaskActivityKind;
  fromValue: string | null;
  toValue: string | null;
};

export function diffTask(before: TaskSnapshot, after: TaskSnapshot): TaskChange[] {
  const changes: TaskChange[] = [];
  if (before.status !== after.status) {
    changes.push({ kind: TaskActivityKind.STATUS, fromValue: before.status, toValue: after.status });
  }
  const beforeIds = new Set(before.assignees.map((person) => person.id));
  const afterIds = new Set(after.assignees.map((person) => person.id));
  const added = after.assignees.filter((person) => !beforeIds.has(person.id));
  const removed = before.assignees.filter((person) => !afterIds.has(person.id));
  if (added.length > 0 || removed.length > 0) {
    changes.push({
      kind: TaskActivityKind.ASSIGNEE,
      fromValue: removed.map((person) => person.name).join(', ') || null,
      toValue: added.map((person) => person.name).join(', ') || null,
    });
  }
  if (before.priority !== after.priority) {
    changes.push({ kind: TaskActivityKind.PRIORITY, fromValue: before.priority, toValue: after.priority });
  }
  if (before.type !== after.type) {
    changes.push({ kind: TaskActivityKind.TYPE, fromValue: before.type, toValue: after.type });
  }
  if (before.schedule !== after.schedule) {
    changes.push({ kind: TaskActivityKind.SCHEDULE, fromValue: before.schedule, toValue: after.schedule });
  }
  if (before.title !== after.title) {
    changes.push({ kind: TaskActivityKind.TITLE, fromValue: before.title, toValue: after.title });
  }
  if ((before.description ?? '') !== (after.description ?? '')) {
    changes.push({ kind: TaskActivityKind.DESCRIPTION, fromValue: null, toValue: null });
  }
  return changes;
}

export function summarizeTasks(
  tasks: { status: string; dueDate: string | null; completedAt: Date | null; assigneeIds: number[] }[],
  actorId: number,
  today: string,
  weekStart: Date,
) {
  let open = 0;
  let inProgress = 0;
  let overdue = 0;
  let doneThisWeek = 0;
  let assignedToMe = 0;
  for (const task of tasks) {
    if (task.status === 'DONE') {
      if (task.completedAt && task.completedAt >= weekStart) {
        doneThisWeek += 1;
      }
      continue;
    }
    open += 1;
    if (task.status === 'IN_PROGRESS') {
      inProgress += 1;
    }
    if (isOverdue(task, today)) {
      overdue += 1;
    }
    if (task.assigneeIds.includes(actorId)) {
      assignedToMe += 1;
    }
  }
  return { open, inProgress, overdue, doneThisWeek, assignedToMe };
}
