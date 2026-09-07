import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ActivityService } from '../activity/activity.service';
import { CalendarService } from '../calendar/calendar.service';
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
  previousWindow,
  rollupTeamBidderPerformance,
  startOfLocalDay,
  inTimeRange,
} from './dashboard-team';

@Injectable()
export class DashboardService {
  constructor(
    private readonly activity: ActivityService,
    private readonly jiraApplications: JiracodersApplicationsService,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(JobApplication)
    private readonly applications: Repository<JobApplication>,
    @InjectRepository(Interview)
    private readonly interviews: Repository<Interview>,
    private readonly calendar: CalendarService,
  ) {}

  async getSummary(actor: User, from?: string, to?: string) {
    const week = mondaySundayWeek();
    const end = to ? new Date(to) : week.to;
    const start = from ? new Date(from) : week.from;
    const byCandidate = await this.activity.summarize(actor, start, end);
    const base = {
      role: actor.role,
      from: start.toISOString(),
      to: end.toISOString(),
      byCandidate,
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
    const today = startOfLocalDay();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const windowFrom = new Date(
      Math.min(previous.from.getTime(), start.getTime(), week.from.getTime(), today.getTime()),
    );
    const windowTo = new Date(
      Math.max(end.getTime(), week.to.getTime(), tomorrow.getTime()),
    );

    const [bidders, applicationRows, interviewRows] = await Promise.all([
      this.users.find({
        where: { role: UserRole.BIDDER },
        order: { name: 'ASC' },
      }),
      this.loadApplicationCredits(windowFrom, windowTo),
      this.loadInterviewCredits(windowFrom, windowTo),
    ]);

    const selectedApps = applicationRows.filter((row) =>
      inTimeRange(row.appliedAt, start, end),
    );
    const selectedInts = interviewRows.filter((row) =>
      inTimeRange(row.startsAt, start, end),
    );
    const bidderInputs = bidders.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      isActive: row.isActive !== false,
    }));
    const periodTeam = rollupTeamBidderPerformance(
      bidderInputs,
      selectedApps,
      selectedInts,
    );
    const todayTeam = rollupTeamBidderPerformance(
      bidderInputs,
      applicationRows.filter((row) => inTimeRange(row.appliedAt, today, tomorrow)),
      interviewRows.filter((row) => inTimeRange(row.startsAt, today, tomorrow)),
    );
    const weekTeam = rollupTeamBidderPerformance(
      bidderInputs,
      applicationRows.filter((row) => inTimeRange(row.appliedAt, week.from, week.to)),
      interviewRows.filter((row) => inTimeRange(row.startsAt, week.from, week.to)),
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

    const weekdayEnd = new Date(week.from);
    weekdayEnd.setDate(weekdayEnd.getDate() + 5);
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
          .filter((row) => inTimeRange(row.startsAt, week.from, weekdayEnd))
          .map((row) => row.startsAt),
        week.from,
        weekdayEnd,
      ).map((row) => [row.date, row.applications]),
    );

    return {
      ...base,
      activeBidderCount: team.filter((row) => row.isActive).length,
      bidderCount: team.length,
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
      todayApplications: countInRange(
        applicationRows.map((row) => row.appliedAt),
        today,
        tomorrow,
      ),
      todayInterviews: countInRange(
        interviewRows.map((row) => row.startsAt),
        today,
        tomorrow,
      ),
      weekApplications: countInRange(
        applicationRows.map((row) => row.appliedAt),
        week.from,
        week.to,
      ),
      weekInterviews: countInRange(
        interviewRows.map((row) => row.startsAt),
        week.from,
        week.to,
      ),
      daily: dailyCounts(
        selectedApps.map((row) => row.appliedAt),
        start,
        end,
      ).map((row) => ({
        ...row,
        interviews:
          interviewByDay.get(row.date) ?? 0,
      })),
      weekDaily: dailyCounts(
        applicationRows
          .filter((row) => inTimeRange(row.appliedAt, week.from, weekdayEnd))
          .map((row) => row.appliedAt),
        week.from,
        weekdayEnd,
      ).map((row) => ({
        ...row,
        interviews: weekInterviewByDay.get(row.date) ?? 0,
      })),
      bidders: team,
      recent,
    };
  }

  private async loadInterviewCredits(from: Date, to: Date) {
    try {
      const events = await this.calendar.listEvents(from.toISOString(), to.toISOString());
      const people = await this.users.find();
      const names = new Map(people.map((row) => [row.id, row.name]));
      return events
        .map((event) => ({
          id: event.id,
          bidderId: event.bidderId,
          bidderName: (event.bidderId && names.get(event.bidderId)) || event.email,
          title: event.title,
          startsAt: new Date(event.start),
        }))
        .filter((row) => !Number.isNaN(row.startsAt.getTime()))
        .sort((left, right) => right.startsAt.getTime() - left.startsAt.getTime());
    } catch {
      const rows = await this.interviews
        .createQueryBuilder('interview')
        .leftJoinAndSelect('interview.bidder', 'bidder')
        .leftJoinAndSelect('interview.candidateProfile', 'profile')
        .where('interview.startsAt >= :from AND interview.startsAt < :to', { from, to })
        .orderBy('interview.startsAt', 'DESC')
        .getMany();
      return rows.map((row) => ({
        id: row.id,
        bidderId: row.bidderId,
        bidderName: row.bidder?.name ?? null,
        title: row.candidateProfile?.name ?? row.company,
        startsAt: row.startsAt,
      }));
    }
  }

  private async loadApplicationCredits(from: Date, to: Date) {
    try {
      const rows = await this.jiraApplications.creditedApplications(from, to);
      return rows.sort((left, right) => right.appliedAt.getTime() - left.appliedAt.getTime());
    } catch {
      const rows = await this.applications
        .createQueryBuilder('app')
        .leftJoinAndSelect('app.bidder', 'bidder')
        .where('app.appliedAt >= :from AND app.appliedAt < :to', { from, to })
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
