import { UserRole } from '../users/user-role.enum';
import {
  canCompleteDaily,
  canCompleteTask,
  canCreateTask,
  canDeleteTask,
  canEditTask,
  canViewTask,
  compareTasks,
  diffTask,
  isOverdue,
  parseDueDate,
  parseTaskKey,
  summarizeTasks,
  TaskActivityKind,
  type TaskSnapshot,
} from './task.rules';

const admin = { id: 1, role: UserRole.ADMIN };
const manager = { id: 2, role: UserRole.BID_MANAGER };
const bidder = { id: 3, role: UserRole.BIDDER };
const otherBidder = { id: 4, role: UserRole.BIDDER };

describe('task rules', () => {
  it('shows a ticket only to its reporter and assignees, whatever their role', () => {
    const task = { reporterUserId: 2, assigneeIds: [3, 5] };
    expect(canViewTask(admin, task)).toBe(false);
    expect(canViewTask(manager, task)).toBe(true);
    expect(canViewTask(bidder, task)).toBe(true);
    expect(canViewTask({ id: 5, role: UserRole.BIDDER }, task)).toBe(true);
    expect(canViewTask(otherBidder, task)).toBe(false);
  });

  it('lets only admins create, change and delete tasks', () => {
    const task = { reporterUserId: 1, assigneeIds: [3] };
    expect(canCreateTask(admin)).toBe(true);
    expect(canCreateTask(manager)).toBe(false);
    expect(canCreateTask(bidder)).toBe(false);
    expect(canEditTask(admin, task)).toBe(true);
    expect(canEditTask(bidder, task)).toBe(false);
    expect(canDeleteTask(admin, task)).toBe(true);
    expect(canDeleteTask(bidder, task)).toBe(false);
    expect(canEditTask(admin, { reporterUserId: 2, assigneeIds: [3] })).toBe(false);
  });

  it('lets only admins complete a task and only assignees complete their daily part', () => {
    const task = { reporterUserId: 2, assigneeIds: [3] };
    expect(canCompleteTask(admin)).toBe(true);
    expect(canCompleteTask(manager)).toBe(false);
    expect(canCompleteTask(bidder)).toBe(false);
    expect(canCompleteDaily(bidder, task)).toBe(true);
    expect(canCompleteDaily(manager, task)).toBe(false);
    expect(canCompleteDaily(admin, task)).toBe(false);
  });

  it('parses task keys and due dates', () => {
    expect(parseTaskKey('TSK-42')).toBe(42);
    expect(parseTaskKey('tsk42')).toBe(42);
    expect(parseTaskKey(' 7 ')).toBe(7);
    expect(parseTaskKey('resume update')).toBeNull();
    expect(parseDueDate('2026-10-09')).toBe('2026-10-09');
    expect(parseDueDate('2026-02-30')).toBeNull();
    expect(parseDueDate('10/09/2026')).toBeNull();
  });

  it('flags overdue open tasks only', () => {
    expect(isOverdue({ status: 'TODO', dueDate: '2026-10-01' }, '2026-10-02')).toBe(true);
    expect(isOverdue({ status: 'DONE', dueDate: '2026-10-01' }, '2026-10-02')).toBe(false);
    expect(isOverdue({ status: 'TODO', dueDate: '2026-10-02' }, '2026-10-02')).toBe(false);
    expect(isOverdue({ status: 'TODO', dueDate: null }, '2026-10-02')).toBe(false);
  });

  it('sorts by priority, then due date, then newest', () => {
    const rows = [
      { id: 1, priority: 'LOW', dueDate: null },
      { id: 2, priority: 'MEDIUM', dueDate: null },
      { id: 3, priority: 'HIGH', dueDate: '2026-10-09' },
      { id: 4, priority: 'HIGH', dueDate: '2026-10-05' },
      { id: 5, priority: 'HIGH', dueDate: null },
    ];
    expect([...rows].sort(compareTasks).map((row) => row.id)).toEqual([4, 3, 5, 2, 1]);
  });

  it('records each changed field once', () => {
    const before: TaskSnapshot = {
      title: 'Prep',
      description: 'a',
      status: 'TODO',
      priority: 'MEDIUM',
      type: 'TASK',
      dueDate: null,
      schedule: 'Due Oct 1',
      assignees: [{ id: 5, name: 'Ben' }],
    };
    const after: TaskSnapshot = {
      ...before,
      status: 'IN_PROGRESS',
      assignees: [{ id: 3, name: 'Ana' }],
      dueDate: '2026-10-09',
      schedule: 'Due Oct 9',
    };
    expect(diffTask(before, after)).toEqual([
      { kind: TaskActivityKind.STATUS, fromValue: 'TODO', toValue: 'IN_PROGRESS' },
      { kind: TaskActivityKind.ASSIGNEE, fromValue: 'Ben', toValue: 'Ana' },
      { kind: TaskActivityKind.SCHEDULE, fromValue: 'Due Oct 1', toValue: 'Due Oct 9' },
    ]);
    expect(diffTask(before, { ...before, description: 'a' })).toEqual([]);
    expect(diffTask({ ...before, description: null }, { ...before, description: '' })).toEqual([]);
  });

  it('summarizes open work for the signed-in member', () => {
    const weekStart = new Date('2026-09-28T00:00:00');
    const summary = summarizeTasks(
      [
        { status: 'TODO', dueDate: '2026-09-30', completedAt: null, assigneeIds: [3] },
        { status: 'IN_PROGRESS', dueDate: null, completedAt: null, assigneeIds: [3] },
        { status: 'IN_PROGRESS', dueDate: '2026-10-10', completedAt: null, assigneeIds: [4, 3] },
        { status: 'DONE', dueDate: '2026-09-01', completedAt: new Date('2026-09-29T10:00:00'), assigneeIds: [3] },
        { status: 'DONE', dueDate: null, completedAt: new Date('2026-09-20T10:00:00'), assigneeIds: [3] },
      ],
      3,
      '2026-10-02',
      weekStart,
    );
    expect(summary).toEqual({ open: 3, inProgress: 2, overdue: 1, doneThisWeek: 1, assignedToMe: 3 });
  });
});
