import { isWithinBidWindow } from './project-window';
import { ProjectStatus } from './project-status.enum';
import type { Project } from './project.entity';

function project(overrides: Partial<Project>): Project {
  return {
    id: 1,
    title: 'Test',
    description: null,
    status: ProjectStatus.OPEN,
    opensAt: null,
    closesAt: null,
    awardedSubmissionId: null,
    createdById: 1,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as Project;
}

describe('isWithinBidWindow', () => {
  it('allows OPEN projects with no dates', () => {
    expect(isWithinBidWindow(project({}))).toBe(true);
  });

  it('rejects DRAFT projects', () => {
    expect(isWithinBidWindow(project({ status: ProjectStatus.DRAFT }))).toBe(
      false,
    );
  });

  it('rejects after closesAt', () => {
    expect(
      isWithinBidWindow(
        project({ closesAt: new Date('2020-01-01T00:00:00Z') }),
        new Date('2020-01-02T00:00:00Z'),
      ),
    ).toBe(false);
  });

  it('rejects before opensAt', () => {
    expect(
      isWithinBidWindow(
        project({ opensAt: new Date('2030-01-02T00:00:00Z') }),
        new Date('2030-01-01T00:00:00Z'),
      ),
    ).toBe(false);
  });
});
