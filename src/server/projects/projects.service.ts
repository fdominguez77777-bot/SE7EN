import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { AuditService } from '../audit/audit.service';
import { isStaff } from '../auth/role-utils';
import { BidInvitation } from '../bid-invitations/bid-invitation.entity';
import { BidSubmission } from '../bid-submissions/bid-submission.entity';
import { SubmissionStatus } from '../bid-submissions/submission-status.enum';
import { User } from '../users/user.entity';
import { AwardProjectDto } from './dto/award-project.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Project } from './project.entity';
import { parseOptionalDate, toProjectDto } from './project.mapper';
import { ProjectStatus } from './project-status.enum';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(BidInvitation)
    private readonly invitations: Repository<BidInvitation>,
    @InjectRepository(BidSubmission)
    private readonly submissions: Repository<BidSubmission>,
    private readonly audit: AuditService,
  ) {}

  create(dto: CreateProjectDto, actor: User) {
    const opensAt = parseOptionalDate(dto.opensAt) ?? null;
    const closesAt = parseOptionalDate(dto.closesAt) ?? null;
    this.assertWindow(opensAt, closesAt);
    return this.projects
      .save(
        this.projects.create({
          title: dto.title.trim(),
          description: dto.description?.trim() ?? null,
          status: ProjectStatus.DRAFT,
          opensAt,
          closesAt,
          createdById: actor.id,
        }),
      )
      .then((project) => toProjectDto(project));
  }

  async findAll(actor: User) {
    const rows = await this.loadVisible(actor);
    return rows.map(toProjectDto);
  }

  async findOne(id: number, actor: User) {
    const project = await this.requireVisible(id, actor);
    return toProjectDto(project);
  }

  async update(id: number, dto: UpdateProjectDto, actor: User) {
    if (!isStaff(actor)) {
      throw new ForbiddenException('Only staff can update projects');
    }
    const project = await this.requireProject(id);
    if (dto.title !== undefined) {
      project.title = dto.title.trim();
    }
    if (dto.description !== undefined) {
      project.description = dto.description.trim();
    }
    const opensAt =
      dto.opensAt !== undefined ? parseOptionalDate(dto.opensAt) : project.opensAt;
    const closesAt =
      dto.closesAt !== undefined ? parseOptionalDate(dto.closesAt) : project.closesAt;
    this.assertWindow(opensAt ?? null, closesAt ?? null);
    if (dto.opensAt !== undefined) {
      project.opensAt = opensAt ?? null;
    }
    if (dto.closesAt !== undefined) {
      project.closesAt = closesAt ?? null;
    }
    return toProjectDto(await this.projects.save(project));
  }

  async open(id: number, actor: User) {
    const project = await this.requireStaffProject(id, actor);
    if (project.status !== ProjectStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT projects can be opened');
    }
    project.status = ProjectStatus.OPEN;
    if (!project.opensAt) {
      project.opensAt = new Date();
    }
    const saved = await this.projects.save(project);
    await this.audit.record('project', id, 'open', actor.id, {
      status: saved.status,
    });
    return toProjectDto(saved);
  }

  async close(id: number, actor: User) {
    const project = await this.requireStaffProject(id, actor);
    if (project.status !== ProjectStatus.OPEN) {
      throw new BadRequestException('Only OPEN projects can be closed');
    }
    project.status = ProjectStatus.CLOSED;
    const saved = await this.projects.save(project);
    await this.audit.record('project', id, 'close', actor.id, {
      status: saved.status,
    });
    return toProjectDto(saved);
  }

  async cancel(id: number, actor: User) {
    const project = await this.requireStaffProject(id, actor);
    if (
      project.status !== ProjectStatus.DRAFT &&
      project.status !== ProjectStatus.OPEN
    ) {
      throw new BadRequestException('Only DRAFT or OPEN projects can be cancelled');
    }
    project.status = ProjectStatus.CANCELLED;
    const saved = await this.projects.save(project);
    await this.audit.record('project', id, 'cancel', actor.id, {
      status: saved.status,
    });
    return toProjectDto(saved);
  }

  async award(id: number, dto: AwardProjectDto, actor: User) {
    const project = await this.requireStaffProject(id, actor);
    if (project.status !== ProjectStatus.OPEN) {
      throw new BadRequestException('Only OPEN projects can be awarded');
    }
    const winner = await this.submissions.findOne({
      where: { id: dto.submissionId, projectId: id },
    });
    if (!winner) {
      throw new NotFoundException('Submission not found on this project');
    }
    if (
      winner.status !== SubmissionStatus.SUBMITTED &&
      winner.status !== SubmissionStatus.ACCEPTED
    ) {
      throw new BadRequestException(
        'Only submitted or accepted bids can be awarded',
      );
    }

    const others = await this.submissions.find({ where: { projectId: id } });
    for (const row of others) {
      if (row.id === winner.id) {
        row.status = SubmissionStatus.AWARDED;
      } else if (
        row.status === SubmissionStatus.SUBMITTED ||
        row.status === SubmissionStatus.ACCEPTED
      ) {
        row.status = SubmissionStatus.REJECTED;
      }
    }
    await this.submissions.save(others);
    project.status = ProjectStatus.AWARDED;
    project.awardedSubmissionId = winner.id;
    const saved = await this.projects.save(project);
    await this.audit.record('project', id, 'award', actor.id, {
      submissionId: winner.id,
    });
    return toProjectDto(saved);
  }

  async remove(id: number, actor: User): Promise<void> {
    if (!isStaff(actor)) {
      throw new ForbiddenException('Only staff can delete projects');
    }
    const project = await this.requireProject(id);
    await this.projects.remove(project);
  }

  private assertWindow(opensAt: Date | null, closesAt: Date | null) {
    if (opensAt && closesAt && closesAt <= opensAt) {
      throw new BadRequestException('closesAt must be after opensAt');
    }
  }

  private async requireProject(id: number): Promise<Project> {
    const project = await this.projects.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  private async requireStaffProject(id: number, actor: User): Promise<Project> {
    if (!isStaff(actor)) {
      throw new ForbiddenException('Only staff can change project status');
    }
    return this.requireProject(id);
  }

  private async requireVisible(id: number, actor: User): Promise<Project> {
    const project = await this.requireProject(id);
    if (isStaff(actor)) {
      return project;
    }
    const invited = await this.invitations
      .createQueryBuilder('invite')
      .innerJoin('invite.bidderProfile', 'profile')
      .where('invite.projectId = :id', { id })
      .andWhere('profile.assignedBidderId = :bidderId', { bidderId: actor.id })
      .getExists();
    if (!invited) {
      throw new ForbiddenException('You are not invited to this project');
    }
    return project;
  }

  private async loadVisible(actor: User): Promise<Project[]> {
    if (isStaff(actor)) {
      return this.projects.find({ order: { id: 'ASC' } });
    }
    const invites = await this.invitations
      .createQueryBuilder('invite')
      .innerJoin('invite.bidderProfile', 'profile')
      .where('profile.assignedBidderId = :bidderId', { bidderId: actor.id })
      .select(['invite.projectId'])
      .getMany();
    const projectIds = invites.map((invite) => invite.projectId);
    if (projectIds.length === 0) {
      return [];
    }
    return this.projects.find({
      where: { id: In(projectIds) },
      order: { id: 'ASC' },
    });
  }
}
