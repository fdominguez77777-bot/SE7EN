import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CalendarService } from '../calendar/calendar.service';
import { singleflight, TtlCache } from '../cache/singleflight';
import {
  creditInterviewBidderId,
} from '../integrations/jiracoders/bidder-name';
import { JiracodersApplicationsService } from '../integrations/jiracoders/jiracoders.service';
import { Interview } from '../interviews/interview.entity';
import { JobApplication } from '../job-applications/job-application.entity';
import { mondaySundayWeek } from '../reporting/week-range';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';
import {
  canSeeTeamDashboard,
  countInRange,
  dailyCounts,
  inTimeRange,
  previousWindow,
  rollupTeamBidderPerformance,
  startOfLocalDay,
  type TeamBidderInput,
} from './dashboard-team';

const SUMMARY_CACHE_MS = 8_000;

function parseBound(value?: string): Date | null {
  if (!value?.trim()) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export type DashboardBounds = {
  from?: string;
  to?: string;
  todayFrom?: string;
  todayTo?: string;
  weekFrom?: string;
  weekTo?: string;
};

@Injectable()
export class DashboardService {
  private readonly summaryCache: TtlCache<any>;
  private readonly summaryInflight: Map<string, Promise<any>>;

  constructor(
    private readonly jiraApplications: JiracodersApplicationsService,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(JobApplication)
    private readonly applications: Repository<JobApplication>,
    @InjectRepository(Interview)
    private readonly interviews: Repository<Interview>,
    private readonly calendar: CalendarService,
  ) {
    this.summaryCache = new TtlCache(SUMMARY_CACHE_MS);
    this.summaryInflight = new Map();
  }

  async getSummary(actor: User, bounds: DashboardBounds = {}) {
    const key = [
      actor.id,
      actor.role,
      bounds.from ?? '',
      bounds.to ?? '',
      bounds.todayFrom ?? '',
      bounds.todayTo ?? '',
      bounds.weekFrom ?? '',
      bounds.weekTo ?? '',
    ].join(':');
    const cached = this.summaryCache.get(key);
    if (cached) {
      return cached;
    }
    return singleflight(this.summaryInflight, key, async () => {
      const again = this.summaryCache.get(key);
      if (again) {
        return again;
      }
      const value = await this.computeSummary(actor, bounds);
      this.summaryCache.set(key, value);
      return value;
    });
  }

  private async computeSummary(actor: User, bounds: DashboardBounds) {
    const fallbackWeek = mondaySundayWeek();
    const fallbackToday = startOfLocalDay();
    const fallbackTomorrow = new Date(fallbackToday);
    fallbackTomorrow.setDate(fallbackTomorrow.getDate() + 1);

    const today =
      parseBound(bounds.todayFrom) ?? fallbackToday;
    const tomorrow =
      parseBound(bounds.todayTo) ?? fallbackTomorrow;
    const weekFrom =
      parseBound(bounds.weekFrom) ?? fallbackWeek.from;
    const weekTo =
      parseBound(bounds.weekTo) ?? fallbackWeek.to;
    const end = parseBound(bounds.to) ?? weekTo;
    const start = parseBound(bounds.from) ?? weekFrom;
    const base = {
      role: actor.role,
      from: start.toISOString(),
      to: end.toISOString(),
      byCandidate: [] as {
        candidateProfileId: number;
        profileName: string;
        resumesGenerated: number;
        applications: number;
        interviews: number;
      }[],
    };
    if (!canSeeTeamDashboard(actor.role)) {
      return {
        ...base,
        activeBidderCount: 0,
        bidderCount: 0,
        applications: 0,
        interviews: 0,
        previousApplications: 0,
        previousInterviews: 0,
        todayApplications: 0,
        todayInterviews: 0,
        weekApplications: 0,
        weekInterviews: 0,
        daily: [],
        bidders: [],
        recent: [],
      };
    }

    const previous = previousWindow(start, end);
    const weekdayEnd = new Date(weekFrom);
    weekdayEnd.setDate(weekdayEnd.getDate() + 5);
    const windowFrom = new Date(
      Math.min(
        previous.from.getTime(),
        start.getTime(),
        weekFrom.getTime(),
        today.getTime(),
      ),
    );
    const windowTo = new Date(
      Math.max(end.getTime(), weekTo.getTime(), tomorrow.getTime()),
    );

    const people = await this.users.find({
      where: [
        { role: UserRole.ADMIN },
        { role: UserRole.BID_MANAGER },
        { role: UserRole.BIDDER },
      ],
      order: { name: 'ASC' },
      select: { id: true, name: true, email: true, isActive: true, role: true },
    });
    const bidderInputs = people.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      isActive: row.isActive !== false,
      role: row.role,
    }));

    const [applicationRows, interviewRows] = await Promise.all([
      this.loadApplicationCredits(windowFrom, windowTo),
      this.loadInterviewCredits(windowFrom, windowTo, bidderInputs, actor),
    ]);

    const selectedApps = applicationRows.filter((row) =>
      inTimeRange(row.appliedAt, start, end),
    );
    const selectedInts = interviewRows.filter((row) =>
      inTimeRange(row.startsAt, start, end),
    );
    const creditedSelectedInts = selectedInts.filter(
      (row) => row.bidderId != null,
    );
    const todayApps = applicationRows.filter((row) =>
      inTimeRange(row.appliedAt, today, tomorrow),
    );
    const todayInts = interviewRows.filter((row) =>
      inTimeRange(row.startsAt, today, tomorrow),
    );
    const weekApps = applicationRows.filter((row) =>
      inTimeRange(row.appliedAt, weekFrom, weekTo),
    );
    const weekInts = interviewRows.filter((row) =>
      inTimeRange(row.startsAt, weekFrom, weekTo),
    );

    // One rollup source for period / today / week so KPI, sidebar, and ranking match.
    const periodTeam = rollupTeamBidderPerformance(
      bidderInputs,
      selectedApps,
      creditedSelectedInts,
    );
    const todayTeam = rollupTeamBidderPerformance(
      bidderInputs,
      todayApps,
      todayInts.filter((row) => row.bidderId != null),
    );
    const weekTeam = rollupTeamBidderPerformance(
      bidderInputs,
      weekApps,
      weekInts.filter((row) => row.bidderId != null),
    );
    const todayById = new Map(todayTeam.map((row) => [row.id, row]));
    const weekById = new Map(weekTeam.map((row) => [row.id, row]));
    const team = periodTeam.map((row) => ({
      ...row,
      todayApplications: todayById.get(row.id)?.applications ?? 0,
      todayInterviews: todayById.get(row.id)?.interviews ?? 0,
      weekApplications: weekById.get(row.id)?.applications ?? 0,
      weekInterviews: weekById.get(row.id)?.interviews ?? 0,
    }));

    const recent = [
      ...selectedApps.slice(0, 8).map((row) => ({
        id: `app-${row.id}`,
        at: row.appliedAt.toISOString(),
        title: 'Applications recorded',
        detail: `${row.companyName} · ${row.bidderName ?? 'Bidder'}`,
      })),
      ...selectedInts.slice(0, 8).map((row) => ({
        id: `int-${row.id}`,
        at: row.startsAt.toISOString(),
        title: 'Interview scheduled',
        detail: `${row.title} · ${row.bidderName ?? 'Unassigned'}`,
      })),
    ]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 8);

    const interviewByDay = new Map(
      dailyCounts(
        selectedInts.map((row) => row.startsAt),
        start,
        end,
      ).map((row) => [row.date, row.applications]),
    );
    const weekInterviewByDay = new Map(
      dailyCounts(
        interviewRows
          .filter((row) => inTimeRange(row.startsAt, weekFrom, weekdayEnd))
          .map((row) => row.startsAt),
        weekFrom,
        weekdayEnd,
      ).map((row) => [row.date, row.applications]),
    );

    return {
      ...base,
      activeBidderCount: bidderInputs.filter(
        (row) => row.role === UserRole.BIDDER && row.isActive,
      ).length,
      bidderCount: bidderInputs.filter((row) => row.role === UserRole.BIDDER)
        .length,
      applications: selectedApps.length,
      interviews: selectedInts.length,
      previousApplications: countInRange(
        applicationRows.map((row) => row.appliedAt),
        previous.from,
        previous.to,
      ),
      previousInterviews: countInRange(
        interviewRows.map((row) => row.startsAt),
        previous.from,
        previous.to,
      ),
      todayApplications: todayApps.length,
      todayInterviews: todayInts.length,
      weekApplications: weekApps.length,
      weekInterviews: weekInts.length,
      daily: dailyCounts(
        selectedApps.map((row) => row.appliedAt),
        start,
        end,
      ).map((row) => ({
        ...row,
        interviews: interviewByDay.get(row.date) ?? 0,
      })),
      weekDaily: dailyCounts(
        applicationRows
          .filter((row) => inTimeRange(row.appliedAt, weekFrom, weekdayEnd))
          .map((row) => row.appliedAt),
        weekFrom,
        weekdayEnd,
      ).map((row) => ({
        ...row,
        interviews: weekInterviewByDay.get(row.date) ?? 0,
      })),
      bidders: team,
      recent,
    };
  }

  private async loadInterviewCredits(
    from: Date,
    to: Date,
    bidders: TeamBidderInput[],
    actor: User,
  ) {
    try {
      const events = await this.calendar.listEvents(
        from.toISOString(),
        to.toISOString(),
        actor,
        'lite',
      );
      const names = new Map(bidders.map((row) => [row.id, row.name]));
      return events
        .map((event) => {
          const bidderId = creditInterviewBidderId(event, bidders);
          return {
            id: event.id,
            bidderId,
            bidderName: (bidderId && names.get(bidderId)) || event.email,
            title: event.title,
            startsAt: new Date(event.start),
          };
        })
        .filter((row) => !Number.isNaN(row.startsAt.getTime()))
        .sort((left, right) => right.startsAt.getTime() - left.startsAt.getTime());
    } catch {
      const rows = await this.interviews
        .createQueryBuilder('interview')
        .leftJoinAndSelect('interview.bidder', 'bidder')
        .leftJoinAndSelect('interview.candidateProfile', 'profile')
        .where('interview.startsAt >= :from AND interview.startsAt < :to', {
          from,
          to,
        })
        .orderBy('interview.startsAt', 'DESC')
        .getMany();
      return rows.map((row) => ({
        id: row.id,
        bidderId: creditInterviewBidderId(
          { bidderId: row.bidderId, email: row.bidder?.email },
          bidders,
        ),
        bidderName: row.bidder?.name ?? null,
        title: row.candidateProfile?.name ?? row.company,
        startsAt: row.startsAt,
      }));
    }
  }

  private async loadApplicationCredits(from: Date, to: Date) {
    try {
      const rows = await this.jiraApplications.creditedApplications(from, to);
      return rows.sort(
        (left, right) => right.appliedAt.getTime() - left.appliedAt.getTime(),
      );
    } catch {
      const rows = await this.applications
        .createQueryBuilder('app')
        .leftJoinAndSelect('app.bidder', 'bidder')
        .where('app.appliedAt >= :from AND app.appliedAt < :to', { from, to })
        .andWhere('LOWER(app.status) IN (:...statuses)', {
          statuses: ['applied', 'draft'],
        })
        .orderBy('app.appliedAt', 'DESC')
        .getMany();
      return rows.map((row) => ({
        id: row.id,
        bidderId: row.bidderId,
        bidderName: row.bidder?.name ?? null,
        companyName: row.companyName,
        appliedAt: row.appliedAt,
      }));
    }
  }
}
