import { BadRequestException } from '@nestjs/common';

import { Project } from './project.entity';

export function parseOptionalDate(
  value: string | Date | undefined,
): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!value) {
    return null;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('Invalid date value');
  }
  return parsed;
}

export function toProjectDto(project: Project) {
  return {
    id: project.id,
    title: project.title,
    description: project.description,
    status: project.status,
    opensAt: project.opensAt,
    closesAt: project.closesAt,
    awardedSubmissionId: project.awardedSubmissionId,
    createdById: project.createdById,
    created_at: project.created_at,
    updated_at: project.updated_at,
  };
}
