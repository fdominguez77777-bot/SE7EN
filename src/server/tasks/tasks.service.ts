import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Brackets, In, Repository } from 'typeorm';

import { avatarPublicUrl } from '../storage/image-kind';
import { User } from '../users/user.entity';
import {
  addDays,
  describeSchedule,
  mondayOf,
  occursOn,
  scheduleProblem,
  type TaskRepeat,
  type TaskSchedule,
} from '../../lib/task-schedule';
import {
  CreateTaskCommentDto,
  CreateTaskDto,
  TaskOccurrenceDto,
  UpdateTaskDto,
} from './dto/task.dto';
import { TaskActivity } from './task-activity.entity';
import { TaskCompletion } from './task-completion.entity';
import { Task } from './task.entity';
import {
  canDeleteTask,
  canEditTask,
  canViewTask,
  compareTasks,
  diffTask,
  parseDueDate,
  parseTaskKey,
  summarizeTasks,
  TASK_MESSAGES,
  TASK_SCOPES,
  TaskActivityKind,
  taskKey,
  type TaskScope,
  type TaskSnapshot,
} from './task.rules';

type PersonRow = Pick<User, 'id' | 'name' | 'role' | 'avatarPath'>;

function todayIso() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function startOfWeek() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function person(user: PersonRow | null | undefined) {
  if (!user) {
    return null;
  }
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    avatarUrl: avatarPublicUrl(user.avatarPath),
  };
}

const ASSIGNED_TO_ACTOR =
  'EXISTS (SELECT 1 FROM "task_assignee" ta WHERE ta."taskId" = task.id AND ta."userId" = :actorId)';

function assigneeIds(task: Task) {
  return (task.assignees ?? []).map((user) => user.id);
}

function involvement(task: Task) {
  return { reporterUserId: task.reporterUserId, assigneeIds: assigneeIds(task) };
}

function scheduleOf(task: Task): TaskSchedule {
  return {
    repeat: task.repeat as TaskRepeat,
    repeatDays: task.repeatDays,
    startDate: task.startDate,
    endDate: task.endDate,
    dueDate: task.dueDate,
  };
}

/** Whether the task has anything to show between from and to (inclusive). */
function touchesRange(task: Task, from: string, to: string) {
  if (task.repeat === 'NONE') {
    if (!task.dueDate || task.dueDate > to) return false;
    return task.dueDate >= from || task.status !== 'DONE';
  }
  if (task.startDate > to) return false;
  if (task.endDate && task.endDate < from) return false;
  if (task.status === 'DONE' && task.completedAt) {
    return task.completedAt.toISOString().slice(0, 10) >= from;
  }
  return true;
}

type ListExtras = { assignedAt: Date | null; completedOn: string[] };

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly tasks: Repository<Task>,
    @InjectRepository(TaskActivity)
    private readonly activity: Repository<TaskActivity>,
    @InjectRepository(TaskCompletion)
    private readonly completions: Repository<TaskCompletion>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async people() {
    const rows = await this.users.find({
      where: { isActive: true },
      select: { id: true, name: true, role: true, avatarPath: true },
      order: { name: 'ASC' },
    });
    return rows.map((row) => person(row));
  }

  async list(
    actor: User,
    query: {
      scope?: string;
      status?: string;
      priority?: string;
      type?: string;
      assignee?: string;
      search?: string;
      from?: string;
      to?: string;
    },
  ) {
    const scope: TaskScope = TASK_SCOPES.includes(query.scope as TaskScope)
      ? (query.scope as TaskScope)
      : 'all';
    const qb = this.tasks
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.reporter', 'reporter')
      .leftJoinAndSelect('task.assignees', 'assignee');
    qb.andWhere(
      new Brackets((where) => {
        where.where('task.reporterUserId = :actorId').orWhere(ASSIGNED_TO_ACTOR);
      }),
      { actorId: actor.id },
    );
    if (scope === 'mine') {
      qb.andWhere(ASSIGNED_TO_ACTOR, { actorId: actor.id });
    } else if (scope === 'reported') {
      qb.andWhere('task.reporterUserId = :actorId', { actorId: actor.id });
    }
    const scoped = await qb.getMany();
    const summary = summarizeTasks(
      scoped.map((task) => ({ ...task, assigneeIds: assigneeIds(task) })),
      actor.id,
      todayIso(),
      startOfWeek(),
    );

    const status = query.status?.trim().toUpperCase();
    const priority = query.priority?.trim().toUpperCase();
    const type = query.type?.trim().toUpperCase();
    const assignee = query.assignee?.trim();
    const search = query.search?.trim().toLowerCase();
    const searchId = search ? parseTaskKey(search) : null;
    const filtered = scoped.filter((task) => {
      if (status && status !== 'ALL') {
        if (status === 'OPEN' ? task.status === 'DONE' : task.status !== status) {
          return false;
        }
      }
      if (priority && priority !== 'ALL' && task.priority !== priority) {
        return false;
      }
      if (type && type !== 'ALL' && task.type !== type) {
        return false;
      }
      if (assignee && assignee !== 'all') {
        const ids = assigneeIds(task);
        if (assignee === 'unassigned') {
          if (ids.length > 0) return false;
        } else if (!ids.includes(Number(assignee))) {
          return false;
        }
      }
      if (search) {
        if (searchId !== null && task.id === searchId) {
          return true;
        }
        const haystack = `${task.title} ${task.description ?? ''}`.toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }
      return true;
    });
    const from = parseDueDate(query.from ?? '') ?? mondayOf(todayIso());
    const to = parseDueDate(query.to ?? '') ?? addDays(from, 6);
    const ranged =
      query.from || query.to ? filtered.filter((task) => touchesRange(task, from, to)) : filtered;
    ranged.sort(compareTasks);
    const ids = ranged.map((task) => task.id);
    const [commentCounts, assignedAt, completedOn] = await Promise.all([
      this.commentCounts(ids),
      this.assignedAt(ids, actor.id),
      this.completedOn(ids, from, to),
    ]);
    return {
      summary,
      range: { from, to },
      tasks: ranged.map((task) =>
        this.toListItem(task, commentCounts.get(task.id) ?? 0, {
          assignedAt: assignedAt.get(task.id) ?? null,
          completedOn: completedOn.get(task.id) ?? [],
        }),
      ),
    };
  }

  async detail(id: number, actor: User) {
    const task = await this.findVisible(id, actor);
    const events = await this.activity.find({
      where: { taskId: id },
      relations: { actor: true },
      order: { id: 'ASC' },
    });
    const comments = events.filter((event) => event.kind === TaskActivityKind.COMMENT).length;
    const monday = mondayOf(todayIso());
    const [assignedAt, completedOn] = await Promise.all([
      this.assignedAt([id], actor.id),
      this.completedOn([id], monday, addDays(monday, 6)),
    ]);
    return {
      ...this.toListItem(task, comments, {
        assignedAt: assignedAt.get(id) ?? null,
        completedOn: completedOn.get(id) ?? [],
      }),
      activity: events.map((event) => ({
        id: event.id,
        kind: event.kind,
        fromValue: event.fromValue,
        toValue: event.toValue,
        body: event.body,
        created_at: event.created_at,
        actor: person(event.actor),
      })),
      permissions: {
        canEdit: canEditTask(actor, involvement(task)),
        canDelete: canDeleteTask(actor, involvement(task)),
      },
    };
  }

  async create(dto: CreateTaskDto, actor: User) {
    const title = cleanText(dto.title);
    if (!title) {
      throw new BadRequestException(TASK_MESSAGES.titleRequired);
    }
    const assignees = await this.activeUsers(dto.assigneeUserIds ?? []);
    const status = dto.status ?? 'TODO';
    const today = todayIso();
    const schedule = this.resolveSchedule(dto, {
      repeat: 'NONE',
      repeatDays: null,
      startDate: today,
      endDate: null,
      dueDate: today,
    });
    const task = await this.tasks.save(
      this.tasks.create({
        title,
        description: cleanText(dto.description),
        status,
        priority: dto.priority ?? 'MEDIUM',
        type: dto.type ?? 'TASK',
        ...schedule,
        completedAt: status === 'DONE' ? new Date() : null,
        reporterUserId: actor.id,
        assignees,
      }),
    );
    await this.activity.save(
      this.activity.create({
        taskId: task.id,
        actorUserId: actor.id,
        kind: TaskActivityKind.CREATED,
        toValue: assignees.map((user) => user.name).join(', ') || null,
      }),
    );
    return this.detail(task.id, actor);
  }

  async update(id: number, dto: UpdateTaskDto, actor: User) {
    const task = await this.findVisible(id, actor);
    if (!canEditTask(actor, involvement(task))) {
      throw new ForbiddenException(TASK_MESSAGES.forbidden);
    }
    const before = this.snapshot(task);
    if (dto.title !== undefined) {
      const title = cleanText(dto.title);
      if (!title) {
        throw new BadRequestException(TASK_MESSAGES.titleRequired);
      }
      task.title = title;
    }
    if (dto.description !== undefined) {
      task.description = cleanText(dto.description);
    }
    if (dto.priority !== undefined) {
      task.priority = dto.priority;
    }
    if (dto.type !== undefined) {
      task.type = dto.type;
    }
    if (
      dto.repeat !== undefined ||
      dto.repeatDays !== undefined ||
      dto.startDate !== undefined ||
      dto.endDate !== undefined ||
      dto.dueDate !== undefined
    ) {
      Object.assign(task, this.resolveSchedule(dto, scheduleOf(task)));
    }
    if (dto.assigneeUserIds !== undefined) {
      const current = new Map(task.assignees.map((user) => [user.id, user]));
      const added = dto.assigneeUserIds.filter((userId) => !current.has(userId));
      const kept = dto.assigneeUserIds.flatMap((userId) => current.get(userId) ?? []);
      task.assignees = [...kept, ...(await this.activeUsers(added))];
    }
    if (dto.status !== undefined && dto.status !== task.status) {
      task.completedAt = dto.status === 'DONE' ? new Date() : null;
      task.status = dto.status;
    }
    const changes = diffTask(before, this.snapshot(task));
    if (changes.length === 0) {
      return this.detail(id, actor);
    }
    await this.tasks.save(task);
    await this.activity.save(
      changes.map((change) =>
        this.activity.create({
          taskId: id,
          actorUserId: actor.id,
          kind: change.kind,
          fromValue: change.fromValue,
          toValue: change.toValue,
        }),
      ),
    );
    return this.detail(id, actor);
  }

  async comment(id: number, dto: CreateTaskCommentDto, actor: User) {
    await this.findVisible(id, actor);
    const body = cleanText(dto.body);
    if (!body) {
      throw new BadRequestException(TASK_MESSAGES.commentRequired);
    }
    await this.activity.save(
      this.activity.create({
        taskId: id,
        actorUserId: actor.id,
        kind: TaskActivityKind.COMMENT,
        body,
      }),
    );
    await this.tasks.update(id, { updated_at: new Date() });
    return this.detail(id, actor);
  }

  async removeComment(id: number, commentId: number, actor: User) {
    await this.findVisible(id, actor);
    const event = await this.activity.findOne({
      where: { id: commentId, taskId: id, kind: TaskActivityKind.COMMENT },
    });
    if (!event) {
      throw new NotFoundException(TASK_MESSAGES.notFound);
    }
    if (event.actorUserId !== actor.id && actor.role !== 'ADMIN') {
      throw new ForbiddenException(TASK_MESSAGES.commentForbidden);
    }
    await this.activity.delete(event.id);
    return this.detail(id, actor);
  }

  async setOccurrence(id: number, dto: TaskOccurrenceDto, actor: User) {
    const task = await this.findVisible(id, actor);
    if (!canEditTask(actor, involvement(task))) {
      throw new ForbiddenException(TASK_MESSAGES.forbidden);
    }
    const date = parseDueDate(dto.date);
    if (!date) {
      throw new BadRequestException(TASK_MESSAGES.dueDateInvalid);
    }
    if (task.repeat === 'NONE') {
      return this.update(id, { status: dto.done ? 'DONE' : 'TODO' }, actor);
    }
    if (!occursOn(scheduleOf(task), date)) {
      throw new BadRequestException(TASK_MESSAGES.occurrenceInvalid);
    }
    const existing = await this.completions.findOne({ where: { taskId: id, occursOn: date } });
    if (dto.done === Boolean(existing)) {
      return this.detail(id, actor);
    }
    if (dto.done) {
      await this.completions.insert({ taskId: id, occursOn: date, completedByUserId: actor.id });
    } else {
      await this.completions.delete({ taskId: id, occursOn: date });
    }
    await this.activity.save(
      this.activity.create({
        taskId: id,
        actorUserId: actor.id,
        kind: dto.done ? TaskActivityKind.COMPLETED : TaskActivityKind.REOPENED,
        toValue: date,
      }),
    );
    await this.tasks.update(id, { updated_at: new Date() });
    return this.detail(id, actor);
  }

  async remove(id: number, actor: User) {
    const task = await this.findVisible(id, actor);
    if (!canDeleteTask(actor, involvement(task))) {
      throw new ForbiddenException(TASK_MESSAGES.deleteForbidden);
    }
    await this.tasks.delete(task.id);
    return { ok: true };
  }

  private async findVisible(id: number, actor: User) {
    const task = await this.tasks.findOne({
      where: { id },
      relations: { reporter: true, assignees: true },
    });
    if (!task) {
      throw new NotFoundException(TASK_MESSAGES.notFound);
    }
    if (!canViewTask(actor, involvement(task))) {
      throw new ForbiddenException(TASK_MESSAGES.forbidden);
    }
    return task;
  }

  private async activeUsers(ids: number[]) {
    const unique = [...new Set(ids)];
    if (unique.length === 0) {
      return [];
    }
    const users = await this.users.find({ where: { id: In(unique), isActive: true } });
    if (users.length !== unique.length) {
      throw new BadRequestException(TASK_MESSAGES.assigneeInvalid);
    }
    const byId = new Map(users.map((user) => [user.id, user]));
    return unique.map((id) => byId.get(id) as User);
  }

  private resolveSchedule(dto: CreateTaskDto | UpdateTaskDto, current: TaskSchedule): TaskSchedule {
    const repeat = (dto.repeat ?? current.repeat) as TaskRepeat;
    const pick = (value: string | null | undefined, fallback: string | null) =>
      value === undefined ? fallback : cleanText(value);
    const switchedToRepeat = current.repeat === 'NONE' && repeat !== 'NONE';
    const schedule: TaskSchedule = {
      repeat,
      repeatDays: repeat === 'CUSTOM' ? (dto.repeatDays ?? current.repeatDays) : null,
      startDate:
        pick(dto.startDate, switchedToRepeat ? todayIso() : current.startDate) ?? todayIso(),
      endDate: repeat === 'NONE' ? null : pick(dto.endDate, current.endDate),
      dueDate: repeat === 'NONE' ? (pick(dto.dueDate, current.dueDate) ?? todayIso()) : null,
    };
    const problem = scheduleProblem(schedule);
    if (problem) {
      throw new BadRequestException(problem);
    }
    return schedule;
  }

  private async assignedAt(ids: number[], userId: number) {
    const map = new Map<number, Date>();
    if (ids.length === 0) {
      return map;
    }
    const rows: { taskId: number; assignedAt: Date }[] = await this.tasks.query(
      `SELECT "taskId", "assignedAt" FROM "task_assignee" WHERE "userId" = $1 AND "taskId" = ANY($2)`,
      [userId, ids],
    );
    for (const row of rows) {
      map.set(Number(row.taskId), new Date(row.assignedAt));
    }
    return map;
  }

  private async completedOn(ids: number[], from: string, to: string) {
    const map = new Map<number, string[]>();
    if (ids.length === 0) {
      return map;
    }
    const rows = await this.completions.find({
      where: { taskId: In(ids), occursOn: Between(from, to) },
      order: { occursOn: 'ASC' },
    });
    for (const row of rows) {
      map.set(row.taskId, [...(map.get(row.taskId) ?? []), row.occursOn]);
    }
    return map;
  }

  private snapshot(task: Task): TaskSnapshot {
    return {
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      type: task.type,
      dueDate: task.dueDate,
      schedule: describeSchedule(scheduleOf(task)),
      assignees: (task.assignees ?? []).map((user) => ({ id: user.id, name: user.name })),
    };
  }

  private async commentCounts(ids: number[]) {
    const counts = new Map<number, number>();
    if (ids.length === 0) {
      return counts;
    }
    const rows = await this.activity
      .createQueryBuilder('event')
      .select('event.taskId', 'taskId')
      .addSelect('COUNT(*)', 'count')
      .where({ taskId: In(ids), kind: TaskActivityKind.COMMENT })
      .groupBy('event.taskId')
      .getRawMany<{ taskId: number; count: string }>();
    for (const row of rows) {
      counts.set(Number(row.taskId), Number(row.count));
    }
    return counts;
  }

  private toListItem(
    task: Task,
    commentCount: number,
    extras: ListExtras = { assignedAt: null, completedOn: [] },
  ) {
    return {
      id: task.id,
      key: taskKey(task.id),
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      type: task.type,
      dueDate: task.dueDate,
      repeat: task.repeat,
      repeatDays: task.repeatDays,
      startDate: task.startDate,
      endDate: task.endDate,
      assignedAt: extras.assignedAt,
      completedOn: extras.completedOn,
      completedAt: task.completedAt,
      created_at: task.created_at,
      updated_at: task.updated_at,
      reporter: person(task.reporter),
      assignees: [...(task.assignees ?? [])]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((user) => person(user)),
      commentCount,
    };
  }
}
