import {
  describeSchedule,
  mondayOf,
  occursOn,
  scheduleProblem,
  type TaskSchedule,
  weekdayIndex,
  workWeek,
} from '../../lib/task-schedule';

const base: TaskSchedule = {
  repeat: 'NONE',
  repeatDays: null,
  startDate: '2026-09-28',
  endDate: null,
  dueDate: '2026-10-01',
};

describe('task schedule', () => {
  it('knows the work week', () => {
    expect(weekdayIndex('2026-10-02')).toBe(4);
    expect(mondayOf('2026-10-04')).toBe('2026-09-28');
    expect(workWeek('2026-09-28')).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ]);
  });

  it('places one-time tasks on their due day only', () => {
    expect(occursOn(base, '2026-10-01')).toBe(true);
    expect(occursOn(base, '2026-09-30')).toBe(false);
  });

  it('repeats every work day within the window', () => {
    const schedule: TaskSchedule = { ...base, repeat: 'WEEKDAYS', dueDate: null, endDate: '2026-10-07' };
    expect(occursOn(schedule, '2026-09-27')).toBe(false);
    expect(occursOn(schedule, '2026-09-28')).toBe(true);
    expect(occursOn(schedule, '2026-10-03')).toBe(false);
    expect(occursOn(schedule, '2026-10-07')).toBe(true);
    expect(occursOn(schedule, '2026-10-08')).toBe(false);
    expect(describeSchedule(schedule)).toBe('Every work day until Oct 7');
  });

  it('supports custom weekdays', () => {
    const schedule: TaskSchedule = { ...base, repeat: 'CUSTOM', repeatDays: 1 | 4 | 16, dueDate: null };
    expect(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'].map((day) => occursOn(schedule, day))).toEqual([
      true,
      false,
      true,
      false,
      true,
    ]);
    expect(describeSchedule(schedule)).toBe('Every Mon, Wed, Fri');
  });

  it('rejects incomplete schedules', () => {
    expect(scheduleProblem({ ...base, dueDate: null })).not.toBeNull();
    expect(scheduleProblem({ ...base, repeat: 'CUSTOM', repeatDays: 0 })).not.toBeNull();
    expect(scheduleProblem({ ...base, repeat: 'DAILY', endDate: '2026-09-01' })).not.toBeNull();
    expect(scheduleProblem({ ...base, repeat: 'DAILY', dueDate: null })).toBeNull();
  });
});
