import { Injectable } from '@nestjs/common';

import { ActivityService } from '../activity/activity.service';
import { User } from '../users/user.entity';

@Injectable()
export class DashboardService {
  constructor(private readonly activity: ActivityService) {}

  async getSummary(actor: User, from?: string, to?: string) {
    const end = to ? new Date(to) : new Date();
    const start = from
      ? new Date(from)
      : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    const byCandidate = await this.activity.summarize(actor, start, end);
    return {
      role: actor.role,
      from: start.toISOString(),
      to: end.toISOString(),
      bidderProfileId: actor.bidderProfileId ?? null,
      byCandidate,
    };
  }
}
