import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOperator, In, Not, Repository } from 'typeorm';

import { ActivityEvent } from '../activity/activity-event.entity';
import { BidderProfile } from '../bidder-profiles/bidder-profile.entity';
import { Interview } from '../interviews/interview.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';
import { avatarPublicUrl } from '../storage/image-kind';
import { DailySubmissionBidder } from './daily-submission-bidder.entity';
import { DailySubmissionRead } from './daily-submission-read.entity';
import { DailySubmission } from './daily-submission.entity';
import { SaveDailySubmissionDto } from './dto/daily-submission.dto';
import {
  DAILY_SUBMISSION_MESSAGES,
  DailySubmissionStatus,
  accessBlockReason,
  adminCanSeeDailySubmission,
  applyLiveSystemIfDraft,
  calendarDayRange,
  canEditSubmission,
  canReopenSubmission,
  canReviewSubmission,
  canSubmitSubmission,
  shouldRefreshLiveSystemCounts,
  countSystemApplications,
  countSystemInterviews,
  dailySubmissionRowUserIds,
  difference,
  freezeSystemSnapshot,
  isDailyReportUnread,
  parseReportingDate,
  shouldNotifyAdminOfDailyChange,
  submissionBlockReason,
  todayReportingDate,
} from './daily-submission.rules';

@Injectable()
export class DailySubmissionsService {
  constructor(
    @InjectRepository(DailySubmission)
    private readonly submissions: Repository<DailySubmission>,
    @InjectRepository(DailySubmissionBidder)
    private readonly rows: Repository<DailySubmissionBidder>,
    @InjectRepository(DailySubmissionRead)
    private readonly reads: Repository<DailySubmissionRead>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(BidderProfile)
    private readonly profiles: Repository<BidderProfile>,
    @InjectRepository(ActivityEvent)
    private readonly events: Repository<ActivityEvent>,
    @InjectRepository(Interview)
    private readonly interviews: Repository<Interview>,
  ) {}

  async list(actor: User, date?: string) {
    this.assertStaff(actor);
    const where: {
      managerId?: number;
      reportingDate?: string;
      status?: FindOperator<string>;
    } = {};
    if (actor.role === UserRole.BID_MANAGER) {
      where.managerId = actor.id;
      if (date) {
        where.reportingDate = parseReportingDate(date);
      }
    } else {
      where.status = Not(DailySubmissionStatus.DRAFT);
    }
    const items = await this.submissions.find({
      where,
      relations: { manager: true, rows: { bidder: true } },
      order: { reportingDate: 'DESC', id: 'DESC' },
    });
    if (actor.role === UserRole.ADMIN) {
      await this.markReadMany(
        actor.id,
        items.map((item) => item.id),
      );
    }
    const unreadById = await this.unreadBySubmission(actor, items);
    return items.map((item) =>
      this.toListDto(item, unreadById.get(item.id) ?? false),
    );
  }

  async unreadCount(actor: User) {
    this.assertStaff(actor);
    if (actor.role !== UserRole.ADMIN) {
      return { count: 0 };
    }
    const [items, reads] = await Promise.all([
      this.submissions.find({
        select: { id: true, status: true, contentChangedAt: true },
      }),
      this.reads.find({ where: { userId: actor.id } }),
    ]);
    const readAtById = new Map(
      reads.map((row) => [row.dailySubmissionId, row.readAt]),
    );
    const count = items.filter((item) =>
      isDailyReportUnread({
        status: item.status,
        contentChangedAt: item.contentChangedAt,
        readAt: readAtById.get(item.id) ?? null,
      }),
    ).length;
    return { count };
  }

  async markInboxSeen(actor: User) {
    this.assertStaff(actor);
    if (actor.role !== UserRole.ADMIN) {
      return this.unreadCount(actor);
    }
    const items = await this.submissions.find({ select: { id: true } });
    await this.markReadMany(
      actor.id,
      items.map((item) => item.id),
    );
    return this.unreadCount(actor);
  }

  async getOne(id: number, actor: User) {
    this.assertStaff(actor);
    const submission = await this.loadOrFail(id);
    this.assertCanAccess(actor, submission);
    if (
      actor.role === UserRole.ADMIN &&
      !adminCanSeeDailySubmission(submission.status)
    ) {
      throw new ForbiddenException(DAILY_SUBMISSION_MESSAGES.notSubmitted);
    }
    if (shouldRefreshLiveSystemCounts(submission.status)) {
      await this.syncDraft(submission);
    }
    if (actor.role === UserRole.ADMIN) {
      await this.markRead(actor.id, id);
    }
    return this.toDetailDto(await this.loadOrFail(id), false);
  }

  async workspace(actor: User, date?: string) {
    this.assertStaff(actor);
    const reportingDate = date ? parseReportingDate(date) : todayReportingDate();
    if (actor.role === UserRole.ADMIN) {
      return this.list(actor, reportingDate);
    }
    let submission = await this.submissions.findOne({
      where: { managerId: actor.id, reportingDate },
      relations: { manager: true, rows: { bidder: true } },
    });
    if (!submission) {
      submission = await this.createDraft(actor, reportingDate);
    } else if (shouldRefreshLiveSystemCounts(submission.status)) {
      await this.syncDraft(submission);
      submission = await this.loadOrFail(submission.id);
    }
    return this.toDetailDto(submission);
  }

  async saveDraft(id: number, dto: SaveDailySubmissionDto, actor: User) {
    this.assertStaff(actor);
    const submission = await this.loadOrFail(id);
    this.assertCanAccess(actor, submission);
    if (!canEditSubmission(submission.status, actor.role)) {
      throw new BadRequestException(DAILY_SUBMISSION_MESSAGES.locked);
    }
    if (
      actor.role === UserRole.BID_MANAGER &&
      actor.id !== submission.managerId
    ) {
      throw new ForbiddenException(DAILY_SUBMISSION_MESSAGES.notOwner);
    }
    const byBidder = new Map(dto.rows.map((row) => [row.bidderId, row]));
    for (const row of submission.rows) {
      const patch = byBidder.get(row.bidderId);
      if (!patch) {
        continue;
      }
      row.gmailConfirmedApplicationCount =
        patch.gmailConfirmedApplicationCount === undefined
          ? row.gmailConfirmedApplicationCount
          : patch.gmailConfirmedApplicationCount;
      row.verifiedInterviewCount =
        patch.verifiedInterviewCount === undefined
          ? row.verifiedInterviewCount
          : patch.verifiedInterviewCount;
      if (patch.notes !== undefined) {
        row.notes = patch.notes?.trim() ? patch.notes.trim() : null;
      }
      row.applicationDifference = difference(
        row.gmailConfirmedApplicationCount,
        row.systemApplicationCount,
      );
      row.interviewDifference = difference(
        row.verifiedInterviewCount,
        row.systemInterviewCount,
      );
    }
    await this.rows.save(submission.rows);
    if (shouldNotifyAdminOfDailyChange(submission.status)) {
      await this.markContentChanged(id);
    }
    if (shouldRefreshLiveSystemCounts(submission.status)) {
      await this.syncDraft(submission);
    }
    return this.toDetailDto(await this.loadOrFail(id));
  }

  async submit(id: number, actor: User) {
    this.assertStaff(actor);
    const submission = await this.loadOrFail(id);
    this.assertCanAccess(actor, submission);
    if (actor.role !== UserRole.BID_MANAGER || actor.id !== submission.managerId) {
      throw new ForbiddenException(DAILY_SUBMISSION_MESSAGES.notOwner);
    }
    if (!canSubmitSubmission(submission.status)) {
      throw new BadRequestException(DAILY_SUBMISSION_MESSAGES.notDraft);
    }
    await this.syncDraft(submission);
    const current = await this.loadOrFail(id);
    const incomplete = submissionBlockReason(current.rows);
    if (incomplete) {
      throw new BadRequestException(incomplete);
    }
    const live = await this.liveCounts(current.reportingDate);
    for (const row of current.rows) {
      const snapshot = freezeSystemSnapshot(row, {
        systemApplicationCount: live.apps.get(row.bidderId) ?? 0,
        systemInterviewCount: live.interviews.get(row.bidderId) ?? 0,
      });
      row.systemApplicationCount = snapshot.systemApplicationCount;
      row.systemInterviewCount = snapshot.systemInterviewCount;
      row.applicationDifference = snapshot.applicationDifference;
      row.interviewDifference = snapshot.interviewDifference;
    }
    await this.rows.save(current.rows);
    current.status = DailySubmissionStatus.SUBMITTED;
    current.submittedAt = new Date();
    current.reviewedAt = null;
    current.reviewedByUserId = null;
    current.contentChangedAt = new Date();
    await this.submissions.save(current);
    return this.toDetailDto(await this.loadOrFail(id));
  }

  async reopen(id: number, actor: User) {
    this.assertAdmin(actor);
    const submission = await this.loadOrFail(id);
    if (!canReopenSubmission(submission.status)) {
      throw new BadRequestException(DAILY_SUBMISSION_MESSAGES.notReopenable);
    }
    submission.status = DailySubmissionStatus.DRAFT;
    submission.submittedAt = null;
    submission.reviewedAt = null;
    submission.reviewedByUserId = null;
    await this.submissions.save(submission);
    await this.syncDraft(submission);
    return this.toDetailDto(await this.loadOrFail(id));
  }

  async review(id: number, actor: User) {
    this.assertAdmin(actor);
    const submission = await this.loadOrFail(id);
    if (!canReviewSubmission(submission.status)) {
      throw new BadRequestException(DAILY_SUBMISSION_MESSAGES.notReviewable);
    }
    submission.status = DailySubmissionStatus.REVIEWED;
    submission.reviewedAt = new Date();
    submission.reviewedByUserId = actor.id;
    await this.submissions.save(submission);
    await this.markRead(actor.id, id);
    return this.toDetailDto(await this.loadOrFail(id));
  }

  private async createDraft(manager: User, reportingDate: string) {
    const submission = await this.submissions.save(
      this.submissions.create({
        reportingDate,
        managerId: manager.id,
        status: DailySubmissionStatus.DRAFT,
      }),
    );
    const bidders = await this.reportParticipants(manager);
    const live = await this.liveCounts(reportingDate);
    await this.rows.save(
      bidders.map((bidder) =>
        this.rows.create({
          dailySubmissionId: submission.id,
          bidderId: bidder.id,
          systemApplicationCount: live.apps.get(bidder.id) ?? 0,
          systemInterviewCount: live.interviews.get(bidder.id) ?? 0,
          gmailConfirmedApplicationCount: null,
          verifiedInterviewCount: null,
          applicationDifference: null,
          interviewDifference: null,
          notes: null,
        }),
      ),
    );
    return this.loadOrFail(submission.id);
  }

  private async syncDraft(submission: DailySubmission) {
    if (!shouldRefreshLiveSystemCounts(submission.status)) {
      return;
    }
    const manager =
      submission.manager ??
      (await this.users.findOne({ where: { id: submission.managerId } }));
    if (!manager) {
      return;
    }
    const bidders = await this.reportParticipants(manager);
    const live = await this.liveCounts(submission.reportingDate);
    const existing = new Set(submission.rows.map((row) => row.bidderId));
    const additions = bidders.filter((bidder) => !existing.has(bidder.id));
    if (additions.length > 0) {
      await this.rows.save(
        additions.map((bidder) =>
          this.rows.create({
            dailySubmissionId: submission.id,
            bidderId: bidder.id,
            systemApplicationCount: live.apps.get(bidder.id) ?? 0,
            systemInterviewCount: live.interviews.get(bidder.id) ?? 0,
            gmailConfirmedApplicationCount: null,
            verifiedInterviewCount: null,
          }),
        ),
      );
    }
    const current = await this.loadOrFail(submission.id);
    for (const row of current.rows) {
      const next = applyLiveSystemIfDraft(current.status, row, {
        systemApplicationCount: live.apps.get(row.bidderId) ?? 0,
        systemInterviewCount: live.interviews.get(row.bidderId) ?? 0,
      });
      row.systemApplicationCount = next.systemApplicationCount;
      row.systemInterviewCount = next.systemInterviewCount;
      row.applicationDifference = difference(
        row.gmailConfirmedApplicationCount,
        row.systemApplicationCount,
      );
      row.interviewDifference = difference(
        row.verifiedInterviewCount,
        row.systemInterviewCount,
      );
    }
    await this.rows.save(current.rows);
  }

  private async liveCounts(reportingDate: string | Date) {
    const iso = this.reportingDateString(reportingDate);
    const { from, to } = calendarDayRange(iso);
    const [events, interviews] = await Promise.all([
      this.events
        .createQueryBuilder('event')
        .where('event.occurredAt >= :from AND event.occurredAt < :to', { from, to })
        .getMany(),
      this.interviews
        .createQueryBuilder('interview')
        .where('interview.startsAt >= :from AND interview.startsAt < :to', {
          from,
          to,
        })
        .getMany(),
    ]);
    const apps = new Map<number, number>();
    const interviewCounts = new Map<number, number>();
    const bidderIds = new Set<number>();
    for (const event of events) {
      if (event.bidderId != null) {
        bidderIds.add(event.bidderId);
      }
    }
    for (const interview of interviews) {
      if (interview.bidderId != null) {
        bidderIds.add(interview.bidderId);
      }
    }
    for (const bidderId of bidderIds) {
      apps.set(bidderId, countSystemApplications(events, bidderId, from, to));
      interviewCounts.set(
        bidderId,
        countSystemInterviews(interviews, bidderId, from, to),
      );
    }
    return { apps, interviews: interviewCounts };
  }

  private async assignedCounts() {
    const profiles = await this.profiles.find();
    const counts = new Map<number, number>();
    for (const profile of profiles) {
      if (profile.assignedBidderId == null) {
        continue;
      }
      counts.set(
        profile.assignedBidderId,
        (counts.get(profile.assignedBidderId) ?? 0) + 1,
      );
    }
    return counts;
  }

  private async reportParticipants(manager: User) {
    const bidders = (
      await this.users.find({
        where: { role: UserRole.BIDDER },
        order: { name: 'ASC' },
      })
    ).filter((row) => row.isActive !== false && row.role !== UserRole.ADMIN);
    const ids = dailySubmissionRowUserIds({
      activeBidderIds: bidders.map((row) => row.id),
      managerId: manager.id,
      managerRole: manager.role,
    });
    const have = new Set(bidders.map((row) => row.id));
    const missing = ids.filter((id) => !have.has(id));
    if (missing.length > 0) {
      const extras = await this.users.find({ where: { id: In(missing) } });
      for (const extra of extras) {
        if (extra.isActive === false || extra.role === UserRole.ADMIN) {
          continue;
        }
        bidders.push(extra);
      }
    }
    return bidders.sort((a, b) => a.name.localeCompare(b.name));
  }

  private async loadOrFail(id: number) {
    const submission = await this.submissions.findOne({
      where: { id },
      relations: {
        manager: true,
        rows: { bidder: true },
        reviewedByUser: true,
      },
    });
    if (!submission) {
      throw new NotFoundException('Daily submission not found');
    }
    return submission;
  }

  private assertStaff(actor: User) {
    if (actor.role === UserRole.BIDDER) {
      throw new ForbiddenException(DAILY_SUBMISSION_MESSAGES.bidderForbidden);
    }
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.BID_MANAGER) {
      throw new ForbiddenException(DAILY_SUBMISSION_MESSAGES.bidderForbidden);
    }
  }

  private assertAdmin(actor: User) {
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only ADMIN can perform this action');
    }
  }

  private assertCanAccess(actor: User, submission: DailySubmission) {
    const reason = accessBlockReason({
      actorRole: actor.role,
      actorId: actor.id,
      managerId: submission.managerId,
    });
    if (reason) {
      throw new ForbiddenException(reason);
    }
  }

  private async markContentChanged(id: number) {
    await this.submissions.update(id, { contentChangedAt: new Date() });
  }

  private async markRead(userId: number, dailySubmissionId: number) {
    await this.markReadMany(userId, [dailySubmissionId]);
  }

  private async markReadMany(userId: number, dailySubmissionIds: number[]) {
    const ids = [...new Set(dailySubmissionIds.filter((id) => id > 0))];
    if (ids.length === 0) {
      return;
    }
    const existing = await this.reads.find({
      where: { userId },
    });
    const bySubmission = new Map(
      existing.map((row) => [row.dailySubmissionId, row]),
    );
    const now = new Date();
    const rows = ids.map((dailySubmissionId) => {
      const current = bySubmission.get(dailySubmissionId);
      if (current) {
        current.readAt = now;
        return current;
      }
      return this.reads.create({
        userId,
        dailySubmissionId,
        readAt: now,
      });
    });
    await this.reads.save(rows);
  }

  private async unreadBySubmission(actor: User, items: DailySubmission[]) {
    const unread = new Map<number, boolean>();
    if (actor.role !== UserRole.ADMIN || items.length === 0) {
      for (const item of items) {
        unread.set(item.id, false);
      }
      return unread;
    }
    const reads = await this.reads.find({
      where: { userId: actor.id },
    });
    const readAtById = new Map(
      reads.map((row) => [row.dailySubmissionId, row.readAt]),
    );
    for (const item of items) {
      unread.set(
        item.id,
        isDailyReportUnread({
          status: item.status,
          contentChangedAt: item.contentChangedAt,
          readAt: readAtById.get(item.id) ?? null,
        }),
      );
    }
    return unread;
  }

  private reportingDateString(value: string | Date) {
    if (typeof value === 'string') {
      return value.slice(0, 10);
    }
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${value.getUTCFullYear()}-${month}-${day}`;
  }

  private async toDetailDto(submission: DailySubmission, unread = false) {
    const assigned = await this.assignedCounts();
    const rows = [...submission.rows].sort((a, b) =>
      (a.bidder?.name ?? '').localeCompare(b.bidder?.name ?? ''),
    );
    return {
      id: submission.id,
      reportingDate: this.reportingDateString(submission.reportingDate),
      status: submission.status,
      manager: submission.manager
        ? {
            id: submission.manager.id,
            name: submission.manager.name,
            email: submission.manager.email,
            avatarUrl: avatarPublicUrl(submission.manager.avatarPath),
          }
        : null,
      submittedAt: submission.submittedAt,
      reviewedAt: submission.reviewedAt,
      reviewedByUser: submission.reviewedByUser
        ? {
            id: submission.reviewedByUser.id,
            name: submission.reviewedByUser.name,
          }
        : null,
      updated_at: submission.updated_at,
      created_at: submission.created_at,
      unread,
      rows: rows.map((row) => ({
        id: row.id,
        bidderId: row.bidderId,
        bidderName: row.bidder?.name ?? 'Unknown bidder',
        bidderEmail: row.bidder?.email ?? '',
        bidderRole: (row.bidder?.role as UserRole) ?? UserRole.BIDDER,
        bidderAvatarUrl: avatarPublicUrl(row.bidder?.avatarPath),
        assignedProfileCount: assigned.get(row.bidderId) ?? 0,
        systemApplicationCount: row.systemApplicationCount,
        gmailConfirmedApplicationCount: row.gmailConfirmedApplicationCount,
        applicationDifference: difference(
          row.gmailConfirmedApplicationCount,
          row.systemApplicationCount,
        ),
        systemInterviewCount: row.systemInterviewCount,
        verifiedInterviewCount: row.verifiedInterviewCount,
        interviewDifference: difference(
          row.verifiedInterviewCount,
          row.systemInterviewCount,
        ),
        notes: row.notes,
      })),
    };
  }

  private toListDto(submission: DailySubmission, unread = false) {
    const rows = submission.rows ?? [];
    const systemApplications = rows.reduce(
      (sum, row) => sum + row.systemApplicationCount,
      0,
    );
    const gmailConfirmed = rows.reduce(
      (sum, row) => sum + (row.gmailConfirmedApplicationCount ?? 0),
      0,
    );
    const systemInterviews = rows.reduce(
      (sum, row) => sum + row.systemInterviewCount,
      0,
    );
    const verifiedInterviews = rows.reduce(
      (sum, row) => sum + (row.verifiedInterviewCount ?? 0),
      0,
    );
    return {
      id: submission.id,
      reportingDate: this.reportingDateString(submission.reportingDate),
      status: submission.status,
      manager: submission.manager
        ? {
            id: submission.manager.id,
            name: submission.manager.name,
            email: submission.manager.email,
            avatarUrl: avatarPublicUrl(submission.manager.avatarPath),
          }
        : null,
      submittedAt: submission.submittedAt,
      reviewedAt: submission.reviewedAt,
      updated_at: submission.updated_at,
      systemApplications,
      gmailConfirmed,
      applicationDifference: gmailConfirmed - systemApplications,
      systemInterviews,
      verifiedInterviews,
      interviewDifference: verifiedInterviews - systemInterviews,
      bidderCount: rows.length,
      unread,
    };
  }
}
