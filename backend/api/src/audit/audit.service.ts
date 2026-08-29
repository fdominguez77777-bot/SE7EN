import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuditEvent } from './audit-event.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditEvent)
    private readonly events: Repository<AuditEvent>,
  ) {}

  record(
    entityType: string,
    entityId: number,
    action: string,
    actorId: number | null,
    payload?: Record<string, unknown>,
  ): Promise<AuditEvent> {
    return this.events.save(
      this.events.create({
        entityType,
        entityId,
        action,
        actorId,
        payload: payload ?? null,
      }),
    );
  }
}
