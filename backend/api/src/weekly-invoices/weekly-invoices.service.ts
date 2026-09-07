import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';

import { BidderProfile } from '../bidder-profiles/bidder-profile.entity';
import { BidderCompensationRate } from '../compensation/bidder-compensation-rate.entity';
import { BidderIndividualCompensationRate } from '../compensation/bidder-individual-compensation-rate.entity';
import { resolveBidderRates } from '../compensation/compensation.rules';
import { DailySubmissionBidder } from '../daily-submissions/daily-submission-bidder.entity';
import { DailySubmission } from '../daily-submissions/daily-submission.entity';
import { parseReportingDate } from '../daily-submissions/daily-submission.rules';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';
import { SaveWeeklyInvoiceDto } from './dto/weekly-invoice.dto';
import { WeeklyInvoiceBidder } from './weekly-invoice-bidder.entity';
import { WeeklyInvoiceDailyBidder } from './weekly-invoice-daily-bidder.entity';
import { WeeklyInvoiceDailySource } from './weekly-invoice-daily-source.entity';
import { WeeklyInvoice } from './weekly-invoice.entity';
import { avatarPublicUrl } from '../storage/image-kind';
import {
  WEEKLY_INVOICE_MESSAGES,
  WeeklyInvoiceStatus,
  accessBlockReason,
  adminCanSeeInvoice,
  applyLiveDefaultsIfDraft,
  assertMondaySundayPeriod,
  bidderInvoiceAmounts,
  canApproveInvoice,
  canEditInvoice,
  canReopenInvoice,
  canReviewInvoice,
  canSubmitInvoice,
  countDifference,
  coverageForDay,
  dayCountsTowardDefaults,
  invoiceBidderIds,
  missingCoverageDays,
  missingDaySubmitBlock,
  mondayOfWeek,
  parseInvoiceRate,
  rowCountReasonBlock,
  rowRateReasonBlock,
  sundayOfWeek,
  sumWeeklyDefaults,
  teamInvoiceTotal,
  toIsoDate,
  weekDayIsos,
} from './weekly-invoice.rules';

@Injectable()
export class WeeklyInvoicesService {
  constructor(
    @InjectRepository(WeeklyInvoice)
    private readonly invoices: Repository<WeeklyInvoice>,
    @InjectRepository(WeeklyInvoiceBidder)
    private readonly rows: Repository<WeeklyInvoiceBidder>,
    @InjectRepository(WeeklyInvoiceDailySource)
    private readonly sources: Repository<WeeklyInvoiceDailySource>,
    @InjectRepository(WeeklyInvoiceDailyBidder)
    private readonly dailyBidders: Repository<WeeklyInvoiceDailyBidder>,
    @InjectRepository(DailySubmission)
    private readonly submissions: Repository<DailySubmission>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(BidderProfile)
    private readonly profiles: Repository<BidderProfile>,
    @InjectRepository(BidderCompensationRate)
    private readonly globalRates: Repository<BidderCompensationRate>,
    @InjectRepository(BidderIndividualCompensationRate)
    private readonly individualRates: Repository<BidderIndividualCompensationRate>,
  ) {}

  async list(actor: User, weekStart?: string) {
    this.assertStaff(actor);
    const period = this.resolvePeriod(weekStart);
    const where =
      actor.role === UserRole.ADMIN
        ? {
            status: Not(WeeklyInvoiceStatus.DRAFT),
          }
        : {
            managerId: actor.id,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
          };
    const invoices = await this.invoices.find({
      where,
      relations: { manager: true, rows: true },
      order: { submittedAt: 'DESC', periodStart: 'DESC', id: 'DESC' },
    });
    return invoices.map((invoice) => this.toListDto(invoice));
  }

  async getOne(id: number, actor: User) {
    this.assertStaff(actor);
    const invoice = await this.loadOrFail(id);
    this.assertCanAccess(actor, invoice);
    if (
      actor.role === UserRole.ADMIN &&
      !adminCanSeeInvoice(invoice.status)
    ) {
      throw new ForbiddenException(WEEKLY_INVOICE_MESSAGES.notSubmitted);
    }
    if (canEditInvoice(invoice.status)) {
      await this.syncDraftDefaults(invoice);
    }
    return this.toDetailDto(await this.loadOrFail(id));
  }

  async workspace(actor: User, weekStart?: string) {
    this.assertStaff(actor);
    const period = this.resolvePeriod(weekStart);
    if (actor.role === UserRole.ADMIN) {
      return this.list(actor, period.periodStart);
    }
    let invoice = await this.invoices.findOne({
      where: {
        managerId: actor.id,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
      },
      relations: {
        manager: true,
        rows: { bidder: true },
        dailySources: true,
        dailyBidders: true,
        reviewedByUser: true,
        approvedByUser: true,
      },
    });
    if (!invoice) {
      invoice = await this.createDraft(actor, period);
    } else if (canEditInvoice(invoice.status)) {
      await this.syncDraftDefaults(invoice);
      invoice = await this.loadOrFail(invoice.id);
    }
    return this.toDetailDto(invoice);
  }

  async saveDraft(id: number, dto: SaveWeeklyInvoiceDto, actor: User) {
    const invoice = await this.loadEditable(id, actor);
    if (dto.managerNotes !== undefined) {
      invoice.managerNotes = dto.managerNotes?.trim() ? dto.managerNotes.trim() : null;
    }
    if (dto.noActivityDates) {
      invoice.noActivityDates = dto.noActivityDates.map((value) =>
        parseReportingDate(value),
      );
    }
    if (dto.missingDayAcknowledgement !== undefined) {
      invoice.missingDayAcknowledgement = dto.missingDayAcknowledgement?.trim()
        ? dto.missingDayAcknowledgement.trim()
        : null;
    }
    await this.invoices.save(invoice);
    const byBidder = new Map(dto.rows.map((row) => [row.bidderId, row]));
    for (const row of invoice.rows) {
      const patch = byBidder.get(row.bidderId);
      if (!patch) {
        continue;
      }
      if (patch.invoiceApplicationCount !== undefined) {
        row.invoiceApplicationCount = patch.invoiceApplicationCount;
      }
      if (patch.invoiceInterviewCount !== undefined) {
        row.invoiceInterviewCount = patch.invoiceInterviewCount;
      }
      if (patch.invoiceApplicationRate !== undefined) {
        try {
          row.invoiceApplicationRate = parseInvoiceRate(patch.invoiceApplicationRate);
        } catch (error) {
          throw new BadRequestException(
            error instanceof Error ? error.message : WEEKLY_INVOICE_MESSAGES.invalidRate,
          );
        }
      }
      if (patch.invoiceInterviewRate !== undefined) {
        try {
          row.invoiceInterviewRate = parseInvoiceRate(patch.invoiceInterviewRate);
        } catch (error) {
          throw new BadRequestException(
            error instanceof Error ? error.message : WEEKLY_INVOICE_MESSAGES.invalidRate,
          );
        }
      }
      if (patch.countAdjustmentReason !== undefined) {
        row.countAdjustmentReason = patch.countAdjustmentReason?.trim()
          ? patch.countAdjustmentReason.trim()
          : null;
      }
      if (patch.rateAdjustmentReason !== undefined) {
        row.rateAdjustmentReason = patch.rateAdjustmentReason?.trim()
          ? patch.rateAdjustmentReason.trim()
          : null;
      }
      this.applyAmounts(row);
    }
    await this.rows.save(invoice.rows);
    await this.syncDraftDefaults(await this.loadOrFail(id));
    return this.toDetailDto(await this.loadOrFail(id));
  }

  async refreshDefaults(id: number, actor: User) {
    const invoice = await this.loadOwnedDraft(id, actor);
    await this.syncDraftDefaults(invoice);
    return this.toDetailDto(await this.loadOrFail(id));
  }

  async resetCounts(id: number, actor: User) {
    const invoice = await this.loadOwnedDraft(id, actor);
    for (const row of invoice.rows) {
      row.invoiceApplicationCount = row.defaultApplicationCount;
      row.invoiceInterviewCount = row.defaultInterviewCount;
      row.countAdjustmentReason = null;
      this.applyAmounts(row);
    }
    await this.rows.save(invoice.rows);
    return this.toDetailDto(await this.loadOrFail(id));
  }

  async submit(id: number, actor: User) {
    const invoice = await this.loadOwnedDraft(id, actor);
    await this.syncDraftDefaults(invoice);
    const current = await this.loadOrFail(id);
    if (!canSubmitInvoice(current.status)) {
      throw new BadRequestException(WEEKLY_INVOICE_MESSAGES.notDraft);
    }
    const missing = missingCoverageDays(
      current.dailySources.map((source) => ({
        reportingDate: this.dateString(source.reportingDate),
        coverage: source.status,
      })),
    );
    const missingBlock = missingDaySubmitBlock({
      missingDates: missing,
      acknowledgement: current.missingDayAcknowledgement,
    });
    if (missingBlock) {
      throw new BadRequestException(missingBlock);
    }
    for (const row of current.rows) {
      const countBlock = rowCountReasonBlock({
        invoiceApplicationCount: row.invoiceApplicationCount,
        invoiceInterviewCount: row.invoiceInterviewCount,
        defaultApplicationCount: row.defaultApplicationCount,
        defaultInterviewCount: row.defaultInterviewCount,
        countAdjustmentReason: row.countAdjustmentReason,
      });
      if (countBlock) {
        throw new BadRequestException(countBlock);
      }
      const rateBlock = rowRateReasonBlock({
        invoiceApplicationRate: String(row.invoiceApplicationRate),
        invoiceInterviewRate: String(row.invoiceInterviewRate),
        configuredApplicationRate: String(row.configuredApplicationRate),
        configuredInterviewRate: String(row.configuredInterviewRate),
        rateAdjustmentReason: row.rateAdjustmentReason,
      });
      if (rateBlock) {
        throw new BadRequestException(rateBlock);
      }
      this.applyAmounts(row);
    }
    await this.rows.save(current.rows);
    current.status = WeeklyInvoiceStatus.SUBMITTED;
    current.submittedAt = new Date();
    current.reviewedAt = null;
    current.reviewedByUserId = null;
    current.approvedAt = null;
    current.approvedByUserId = null;
    await this.invoices.save(current);
    return this.toDetailDto(await this.loadOrFail(id));
  }

  async review(id: number, actor: User) {
    this.assertStaff(actor);
    const invoice = await this.loadOrFail(id);
    this.assertCanAccess(actor, invoice);
    if (!canReviewInvoice(invoice.status, actor.role)) {
      throw new BadRequestException(WEEKLY_INVOICE_MESSAGES.notReviewable);
    }
    invoice.status = WeeklyInvoiceStatus.REVIEWED;
    invoice.reviewedAt = new Date();
    invoice.reviewedByUserId = actor.id;
    await this.invoices.save(invoice);
    return this.toDetailDto(await this.loadOrFail(id));
  }

  async approve(id: number, actor: User) {
    this.assertStaff(actor);
    const invoice = await this.loadOrFail(id);
    this.assertCanAccess(actor, invoice);
    if (!canApproveInvoice(invoice.status, actor.role)) {
      throw new BadRequestException(WEEKLY_INVOICE_MESSAGES.notApprovable);
    }
    invoice.status = WeeklyInvoiceStatus.APPROVED;
    invoice.approvedAt = new Date();
    invoice.approvedByUserId = actor.id;
    if (!invoice.reviewedAt) {
      invoice.reviewedAt = invoice.approvedAt;
      invoice.reviewedByUserId = actor.id;
    }
    await this.invoices.save(invoice);
    return this.toDetailDto(await this.loadOrFail(id));
  }

  async reopen(id: number, actor: User) {
    this.assertStaff(actor);
    const invoice = await this.loadOrFail(id);
    this.assertCanAccess(actor, invoice);
    if (!canReopenInvoice(invoice.status, actor.role)) {
      throw new BadRequestException(WEEKLY_INVOICE_MESSAGES.notReopenable);
    }
    invoice.status = WeeklyInvoiceStatus.DRAFT;
    invoice.submittedAt = null;
    invoice.reviewedAt = null;
    invoice.reviewedByUserId = null;
    invoice.approvedAt = null;
    invoice.approvedByUserId = null;
    await this.invoices.save(invoice);
    await this.syncDraftDefaults(await this.loadOrFail(id));
    return this.toDetailDto(await this.loadOrFail(id));
  }

  private async createDraft(
    actor: User,
    period: { periodStart: string; periodEnd: string },
  ) {
    const saved = await this.invoices.save(
      this.invoices.create({
        managerId: actor.id,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        status: WeeklyInvoiceStatus.DRAFT,
        noActivityDates: [],
      }),
    );
    await this.syncDraftDefaults(await this.loadOrFail(saved.id));
    return this.loadOrFail(saved.id);
  }

  private async syncDraftDefaults(invoice: WeeklyInvoice) {
    if (invoice.status === WeeklyInvoiceStatus.APPROVED) {
      return;
    }
    if (
      invoice.status !== WeeklyInvoiceStatus.DRAFT &&
      invoice.status !== WeeklyInvoiceStatus.SUBMITTED &&
      invoice.status !== WeeklyInvoiceStatus.REVIEWED
    ) {
      return;
    }
    const periodStart = this.dateString(invoice.periodStart);
    const periodEnd = this.dateString(invoice.periodEnd);
    const days = weekDayIsos(periodStart);
    const submissions = await this.submissions.find({
      where: { managerId: invoice.managerId },
      relations: { rows: true },
    });
    const byDate = new Map<string, DailySubmission>();
    for (const submission of submissions) {
      const date = this.dateString(submission.reportingDate);
      if (date >= periodStart && date <= periodEnd) {
        byDate.set(date, submission);
      }
    }
    const noActivity = new Set(invoice.noActivityDates ?? []);
    const coverage = days.map((date) => {
      const submission = byDate.get(date) ?? null;
      return {
        date,
        submission,
        status: coverageForDay({
          reportingDate: date,
          submissionStatus: submission?.status ?? null,
          markedNoActivity: noActivity.has(date),
        }),
      };
    });
    const bidders = await this.invoiceBidders(coverage.flatMap((day) => day.submission?.rows ?? []));
    const [globalRates, individualRates] = await Promise.all([
      this.globalRates.find(),
      this.individualRates.find(),
    ]);
    const periodAt = this.localDate(periodStart);
    const existing = new Map((invoice.rows ?? []).map((row) => [row.bidderId, row]));
    const nextRows: WeeklyInvoiceBidder[] = [];
    for (const bidder of bidders) {
      const defaults = sumWeeklyDefaults(
        coverage.map((day) => {
          const row = day.submission?.rows.find((item) => item.bidderId === bidder.id);
          return {
            coverage: day.status,
            gmailConfirmedApplicationCount: row?.gmailConfirmedApplicationCount ?? null,
            verifiedInterviewCount: row?.verifiedInterviewCount ?? null,
          };
        }),
      );
      const resolved = resolveBidderRates({
        bidderId: bidder.id,
        periodStart: periodAt,
        individualRates,
        globalRates,
      });
      const configuredApplicationRate = resolved?.applicationRate ?? '0.0000';
      const configuredInterviewRate = resolved?.interviewRate ?? '0.0000';
      const current = existing.get(bidder.id);
      if (current) {
        const next = applyLiveDefaultsIfDraft(invoice.status, current, defaults);
        current.defaultApplicationCount = next.defaultApplicationCount;
        current.defaultInterviewCount = next.defaultInterviewCount;
        this.applyAmounts(current);
        nextRows.push(current);
      } else {
        const created = this.rows.create({
          weeklyInvoiceId: invoice.id,
          bidderId: bidder.id,
          defaultApplicationCount: defaults.applications,
          invoiceApplicationCount: defaults.applications,
          defaultInterviewCount: defaults.interviews,
          invoiceInterviewCount: defaults.interviews,
          configuredApplicationRate,
          invoiceApplicationRate: configuredApplicationRate,
          configuredInterviewRate,
          invoiceInterviewRate: configuredInterviewRate,
          rateSource: resolved?.source ?? 'none',
        });
        this.applyAmounts(created);
        nextRows.push(created);
      }
    }
    await this.rows.save(nextRows);

    await this.sources.delete({ weeklyInvoiceId: invoice.id });
    await this.dailyBidders.delete({ weeklyInvoiceId: invoice.id });
    await this.sources.save(
      coverage.map((day) =>
        this.sources.create({
          weeklyInvoiceId: invoice.id,
          reportingDate: day.date,
          dailySubmissionId: day.submission?.id ?? null,
          status: day.status,
        }),
      ),
    );
    const dailyRows: WeeklyInvoiceDailyBidder[] = [];
    for (const bidder of bidders) {
      for (const day of coverage) {
        const row = day.submission?.rows.find((item) => item.bidderId === bidder.id);
        const included = dayCountsTowardDefaults(day.status);
        dailyRows.push(
          this.dailyBidders.create({
            weeklyInvoiceId: invoice.id,
            bidderId: bidder.id,
            reportingDate: day.date,
            included,
            applicationCount: included
              ? (row?.gmailConfirmedApplicationCount ?? 0)
              : null,
            interviewCount: included
              ? (row?.verifiedInterviewCount ?? 0)
              : null,
          }),
        );
      }
    }
    if (dailyRows.length > 0) {
      await this.dailyBidders.save(dailyRows);
    }
  }

  private applyAmounts(row: WeeklyInvoiceBidder) {
    const money = bidderInvoiceAmounts({
      invoiceApplicationCount: row.invoiceApplicationCount,
      invoiceInterviewCount: row.invoiceInterviewCount,
      invoiceApplicationRate: String(row.invoiceApplicationRate),
      invoiceInterviewRate: String(row.invoiceInterviewRate),
    });
    row.applicationDifference = countDifference(
      row.invoiceApplicationCount,
      row.defaultApplicationCount,
    );
    row.interviewDifference = countDifference(
      row.invoiceInterviewCount,
      row.defaultInterviewCount,
    );
    row.applicationAmount = money.applicationPayAmount;
    row.interviewAmount = money.interviewPayAmount;
    row.totalAmount = money.totalAmount;
  }

  private async invoiceBidders(dailyRows: DailySubmissionBidder[]) {
    const allBidders = await this.users.find({
      where: { role: UserRole.BIDDER },
      order: { name: 'ASC' },
    });
    const activeIds = allBidders
      .filter((row) => row.isActive !== false)
      .map((row) => row.id);
    const dailyIds = dailyRows.map((row) => row.bidderId);
    const ids = invoiceBidderIds(activeIds, dailyIds);
    if (ids.length === 0) {
      return [];
    }
    const byId = new Map(allBidders.map((row) => [row.id, row]));
    const extra = await this.users.find({ where: { id: In(ids) } });
    for (const row of extra) {
      byId.set(row.id, row);
    }
    return ids
      .map((id) => byId.get(id))
      .filter((row): row is User => Boolean(row))
      .sort((a, b) => a.name.localeCompare(b.name));
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

  private async loadEditable(id: number, actor: User) {
    this.assertStaff(actor);
    const invoice = await this.loadOrFail(id);
    this.assertCanAccess(actor, invoice);
    if (!canEditInvoice(invoice.status, actor.role)) {
      throw new BadRequestException(WEEKLY_INVOICE_MESSAGES.locked);
    }
    if (
      actor.role === UserRole.BID_MANAGER &&
      actor.id !== invoice.managerId
    ) {
      throw new ForbiddenException(WEEKLY_INVOICE_MESSAGES.notOwner);
    }
    return invoice;
  }

  private async loadOwnedDraft(id: number, actor: User) {
    this.assertStaff(actor);
    const invoice = await this.loadOrFail(id);
    this.assertCanAccess(actor, invoice);
    if (actor.role !== UserRole.BID_MANAGER || actor.id !== invoice.managerId) {
      throw new ForbiddenException(WEEKLY_INVOICE_MESSAGES.notOwner);
    }
    if (!canEditInvoice(invoice.status)) {
      throw new BadRequestException(WEEKLY_INVOICE_MESSAGES.locked);
    }
    return invoice;
  }

  private async loadOrFail(id: number) {
    const invoice = await this.invoices.findOne({
      where: { id },
      relations: {
        manager: true,
        rows: { bidder: true },
        dailySources: true,
        dailyBidders: true,
        reviewedByUser: true,
        approvedByUser: true,
      },
    });
    if (!invoice) {
      throw new NotFoundException('Weekly invoice not found');
    }
    invoice.noActivityDates = invoice.noActivityDates ?? [];
    return invoice;
  }

  private assertStaff(actor: User) {
    if (actor.role === UserRole.BIDDER) {
      throw new ForbiddenException(WEEKLY_INVOICE_MESSAGES.bidderForbidden);
    }
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.BID_MANAGER) {
      throw new ForbiddenException(WEEKLY_INVOICE_MESSAGES.bidderForbidden);
    }
  }

  private assertCanAccess(actor: User, invoice: WeeklyInvoice) {
    const reason = accessBlockReason({
      actorRole: actor.role,
      actorId: actor.id,
      managerId: invoice.managerId,
    });
    if (reason) {
      throw new ForbiddenException(reason);
    }
  }

  private resolvePeriod(weekStart?: string) {
    const monday = mondayOfWeek(
      weekStart ? parseReportingDate(weekStart) : toIsoDate(new Date()),
    );
    return assertMondaySundayPeriod(monday, sundayOfWeek(monday));
  }

  private dateString(value: string | Date) {
    if (typeof value === 'string') {
      return value.slice(0, 10);
    }
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${value.getUTCFullYear()}-${month}-${day}`;
  }

  private localDate(iso: string) {
    const [year, month, day] = parseReportingDate(iso).split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private toListDto(invoice: WeeklyInvoice) {
    const totals = teamInvoiceTotal(
      (invoice.rows ?? []).map((row) => ({
        applicationAmount: String(row.applicationAmount),
        interviewAmount: String(row.interviewAmount),
      })),
    );
    const applications = (invoice.rows ?? []).reduce(
      (sum, row) => sum + row.invoiceApplicationCount,
      0,
    );
    const interviews = (invoice.rows ?? []).reduce(
      (sum, row) => sum + row.invoiceInterviewCount,
      0,
    );
    return {
      id: invoice.id,
      periodStart: this.dateString(invoice.periodStart),
      periodEnd: this.dateString(invoice.periodEnd),
      status: invoice.status,
      manager: invoice.manager
        ? {
            id: invoice.manager.id,
            name: invoice.manager.name,
            email: invoice.manager.email,
            avatarUrl: avatarPublicUrl(invoice.manager.avatarPath),
          }
        : null,
      submittedAt: invoice.submittedAt,
      reviewedAt: invoice.reviewedAt,
      approvedAt: invoice.approvedAt,
      applications,
      interviews,
      totalAmount: totals.totalAmount,
      bidderCount: invoice.rows?.length ?? 0,
    };
  }

  private async toDetailDto(invoice: WeeklyInvoice) {
    const assigned = await this.assignedCounts();
    const rows = [...(invoice.rows ?? [])].sort((a, b) =>
      (a.bidder?.name ?? '').localeCompare(b.bidder?.name ?? ''),
    );
    const coverage = [...(invoice.dailySources ?? [])].sort((a, b) =>
      this.dateString(a.reportingDate).localeCompare(this.dateString(b.reportingDate)),
    );
    const totals = teamInvoiceTotal(
      rows.map((row) => ({
        applicationAmount: String(row.applicationAmount),
        interviewAmount: String(row.interviewAmount),
      })),
    );
    const defaultApplications = rows.reduce(
      (sum, row) => sum + row.defaultApplicationCount,
      0,
    );
    const defaultInterviews = rows.reduce(
      (sum, row) => sum + row.defaultInterviewCount,
      0,
    );
    const invoiceApplications = rows.reduce(
      (sum, row) => sum + row.invoiceApplicationCount,
      0,
    );
    const invoiceInterviews = rows.reduce(
      (sum, row) => sum + row.invoiceInterviewCount,
      0,
    );
    return {
      id: invoice.id,
      periodStart: this.dateString(invoice.periodStart),
      periodEnd: this.dateString(invoice.periodEnd),
      status: invoice.status,
      managerNotes: invoice.managerNotes,
      noActivityDates: invoice.noActivityDates ?? [],
      missingDayAcknowledgement: invoice.missingDayAcknowledgement,
      manager: invoice.manager
        ? {
            id: invoice.manager.id,
            name: invoice.manager.name,
            email: invoice.manager.email,
            avatarUrl: avatarPublicUrl(invoice.manager.avatarPath),
          }
        : null,
      submittedAt: invoice.submittedAt,
      reviewedAt: invoice.reviewedAt,
      reviewedByUser: invoice.reviewedByUser
        ? { id: invoice.reviewedByUser.id, name: invoice.reviewedByUser.name }
        : null,
      approvedAt: invoice.approvedAt,
      approvedByUser: invoice.approvedByUser
        ? { id: invoice.approvedByUser.id, name: invoice.approvedByUser.name }
        : null,
      updated_at: invoice.updated_at,
      created_at: invoice.created_at,
      summary: {
        defaultApplications,
        defaultInterviews,
        invoiceApplications,
        invoiceInterviews,
        activeBidders: rows.length,
        applicationAmount: totals.applicationAmount,
        interviewAmount: totals.interviewAmount,
        totalAmount: totals.totalAmount,
      },
      coverage: coverage.map((day) => ({
        reportingDate: this.dateString(day.reportingDate),
        dailySubmissionId: day.dailySubmissionId,
        status: day.status,
      })),
      rows: rows.map((row) => ({
        id: row.id,
        bidderId: row.bidderId,
        bidderName: row.bidder?.name ?? 'Unknown bidder',
        bidderEmail: row.bidder?.email ?? '',
        bidderAvatarUrl: avatarPublicUrl(row.bidder?.avatarPath),
        assignedProfileCount: assigned.get(row.bidderId) ?? 0,
        isActive: row.bidder?.isActive !== false,
        defaultApplicationCount: row.defaultApplicationCount,
        invoiceApplicationCount: row.invoiceApplicationCount,
        applicationDifference: row.applicationDifference,
        configuredApplicationRate: String(row.configuredApplicationRate),
        invoiceApplicationRate: String(row.invoiceApplicationRate),
        defaultInterviewCount: row.defaultInterviewCount,
        invoiceInterviewCount: row.invoiceInterviewCount,
        interviewDifference: row.interviewDifference,
        configuredInterviewRate: String(row.configuredInterviewRate),
        invoiceInterviewRate: String(row.invoiceInterviewRate),
        applicationAmount: String(row.applicationAmount),
        interviewAmount: String(row.interviewAmount),
        totalAmount: String(row.totalAmount),
        rateSource: row.rateSource,
        countAdjustmentReason: row.countAdjustmentReason,
        rateAdjustmentReason: row.rateAdjustmentReason,
        dailyBreakdown: (invoice.dailyBidders ?? [])
          .filter((item) => item.bidderId === row.bidderId)
          .sort((a, b) =>
            this.dateString(a.reportingDate).localeCompare(
              this.dateString(b.reportingDate),
            ),
          )
          .map((item) => ({
            reportingDate: this.dateString(item.reportingDate),
            applicationCount: item.applicationCount,
            interviewCount: item.interviewCount,
            included: item.included,
          })),
      })),
    };
  }
}
