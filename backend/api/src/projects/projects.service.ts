import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { isStaff } from '../auth/role-utils';
import { BidInvitation } from '../bid-invitations/bid-invitation.entity';
import { User } from '../users/user.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Project } from './project.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(BidInvitation)
    private readonly invitations: Repository<BidInvitation>,
  ) {}

  create(dto: CreateProjectDto, actor: User): Promise<Project> {
    return this.projects.save(
      this.projects.create({
        title: dto.title.trim(),
        description: dto.description?.trim() ?? null,
        createdById: actor.id,
      }),
    );
  }

  async findAll(actor: User): Promise<Project[]> {
    if (isStaff(actor)) {
      return this.projects.find({ order: { id: 'ASC' } });
    }

    if (!actor.bidderProfileId) {
      return [];
    }

    const invites = await this.invitations.find({
      where: { bidderProfileId: actor.bidderProfileId },
      select: { projectId: true },
    });
    const projectIds = invites.map((invite) => invite.projectId);
    if (projectIds.length === 0) {
      return [];
    }

    return this.projects.find({
      where: { id: In(projectIds) },
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number, actor: User): Promise<Project> {
    const project = await this.projects.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (isStaff(actor)) {
      return project;
    }

    if (!actor.bidderProfileId) {
      throw new ForbiddenException();
    }

    const invited = await this.invitations.exists({
      where: {
        projectId: id,
        bidderProfileId: actor.bidderProfileId,
      },
    });
    if (!invited) {
      throw new ForbiddenException();
    }

    return project;
  }

  async update(
    id: number,
    dto: UpdateProjectDto,
    actor: User,
  ): Promise<Project> {
    if (!isStaff(actor)) {
      throw new ForbiddenException();
    }
    const project = await this.projects.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (dto.title !== undefined) {
      project.title = dto.title.trim();
    }
    if (dto.description !== undefined) {
      project.description = dto.description.trim();
    }
    if (dto.status !== undefined) {
      project.status = dto.status;
    }
    return this.projects.save(project);
  }

  async remove(id: number, actor: User): Promise<void> {
    if (!isStaff(actor)) {
      throw new ForbiddenException();
    }
    const project = await this.projects.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    await this.projects.remove(project);
  }
}
