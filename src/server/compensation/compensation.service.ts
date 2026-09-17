import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { ActivityService } from '../activity/activity.service';
import { isBidder, isStaff } from '../auth/role-utils';
import { Interview } from '../interviews/interview.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';
import { UsersService } from '../users/users.service';
import { BidManagerCompensation } from './bid-manager-compensation.entity';
import { BidManagerWeeklyPayment } from './bid-manager-weekly-payment.entity';
import { BidderCompensationRate } from './bidder-compensation-rate.entity';
import { BidderIndividualCompensationRate } from './bidder-individual-compensation-rate.entity';
import { BidderWeeklyPayment } from './bidder-weekly-payment.entity';
import { bidderPay, managerPay, parseScaled, sumUsd } from './compensation-money';
import {
  canMarkPaid,
  canMarkReviewed,
  canModifyIndividualBidderRates,
  canRecalculate,
  canViewIndividualBidderRateConfig,
  countPayableInterviews,
  PaymentStatus,
  rateCoversPeriod,
  resolveBidderRates,
} from './compensation.rules';
import {
  CreateBidderRateDto,
  CreateManagerSalaryDto,
  EndIndividualBidderRateDto,
} from './dto/compensation.dto';

@Injectable()
export class CompensationService {
  constructor(
    @InjectRepository(BidderCompensationRate)
    private readonly rates: Repository<BidderCompensationRate>,
    @InjectRepository(BidderIndividualCompensationRate)
    private readonly individualRates: Repository<BidderIndividualCompensationRate>,
    @InjectRepository(BidManagerCompensation)
    private readonly salaries: Repository<BidManagerCompensation>,
    @InjectRepository(BidderWeeklyPayment)
    private readonly bidderPayments: Repository<BidderWeeklyPayment>,
    @InjectRepository(BidManagerWeeklyPayment)
    private readonly managerPayments: Repository<BidManagerWeeklyPayment>,
    @InjectRepository(Interview)
    private readonly interviews: Repository<Interview>,
    private readonly activity: ActivityService,
    private readonly users: UsersService,
  ) {}

  async listRates(actor: User) {
    this.assertCanViewRates(actor);
    const rows = await this.rates.find({ order: { effectiveFrom: 'DESC', id: 'DESC' } });
    return rows.map((row) => this.rateDto(row));
  }

  async currentRates(actor: User, at = new Date()) {
    this.assertCanViewRates(actor);
    const current = await this.rateFor(at);
    return current ? this.rateDto(current) : null;
  }

  async createRate(dto: CreateBidderRateDto, actor: User) {
    this.assertAdmin(actor);
    parseScaled(dto.applicationRate);
    parseScaled(dto.interviewRate);
    const effectiveFrom = new Date(dto.effectiveFrom);
    if (Number.isNaN(effectiveFrom.getTime())) {
      throw new BadRequestException('effectiveFrom is invalid');
    }
    const open = await this.rates.find({ where: { effectiveTo: IsNull() } });
    for (const row of open) {
      if (row.effectiveFrom.getTime() >= effectiveFrom.getTime()) {
        throw new BadRequestException('New rates must start after the current effective date');
      }
      row.effectiveTo = effectiveFrom;
      await this.rates.save(row);
    }
    const saved = await this.rates.save(
      this.rates.create({
        applicationRate: dto.applicationRate,
        interviewRate: dto.interviewRate,
        effectiveFrom,
        effectiveTo: null,
        createdByUserId: actor.id,
        notes: dto.notes?.trim() || null,
      }),
    );
    return this.rateDto(saved);
  }

  async getIndividualBidderRates(bidderId: number, actor: User) {
    if (!canViewIndividualBidderRateConfig(actor, bidderId)) {
      throw new ForbiddenException(
        'You cannot view this bidder compensation configuration',
      );
    }
    const bidder = await this.users.findByIdOrFail(bidderId);
    if (bidder.role !== UserRole.BIDDER) {
      throw new BadRequestException('Individual rates apply only to BIDDER users');
    }
    const history = await this.individualRates.find({
      where: { bidderId },
      order: { effectiveFrom: 'DESC', id: 'DESC' },
    });
    const globalRows = await this.rates.find({
      order: { effectiveFrom: 'DESC', id: 'DESC' },
    });
    const now = new Date();
    const resolved = resolveBidderRates({
      bidderId,
      periodStart: now,
      individualRates: history,
      globalRates: globalRows,
    });
    const current =
      history.find((row) => rateCoversPeriod(row, now) && !row.effectiveTo) ??
      history.find((row) => rateCoversPeriod(row, now)) ??
      null;
    return {
      bidder: this.users.toPublicUser(bidder),
      source: resolved?.source ?? 'default',
      resolved: resolved
        ? {
            applicationRate: resolved.applicationRate,
            interviewRate: resolved.interviewRate,
            source: resolved.source,
          }
        : null,
      current: current && resolved?.source === 'individual'
        ? this.individualRateDto(current)
        : null,
      history: history.map((row) => this.individualRateDto(row)),
    };
  }

  async createIndividualBidderRate(
    bidderId: number,
    dto: CreateBidderRateDto,
    actor: User,
  ) {
    if (!canModifyIndividualBidderRates(actor)) {
      throw new ForbiddenException('Only ADMIN can change individual bidder rates');
    }
    parseScaled(dto.applicationRate);
    parseScaled(dto.interviewRate);
    const bidder = await this.users.findByIdOrFail(bidderId);
    if (bidder.role !== UserRole.BIDDER) {
      throw new BadRequestException('Individual rates apply only to BIDDER users');
    }
    const effectiveFrom = new Date(dto.effectiveFrom);
    if (Number.isNaN(effectiveFrom.getTime())) {
      throw new BadRequestException('effectiveFrom is invalid');
    }
    const open = await this.individualRates.find({
      where: { bidderId, effectiveTo: IsNull() },
    });
    for (const row of open) {
      if (row.effectiveFrom.getTime() >= effectiveFrom.getTime()) {
        throw new BadRequestException(
          'New individual rates must start after the current effective date',
        );
      }
      row.effectiveTo = effectiveFrom;
      await this.individualRates.save(row);
    }
    const saved = await this.individualRates.save(
      this.individualRates.create({
        bidderId,
        applicationRate: dto.applicationRate,
        interviewRate: dto.interviewRate,
        effectiveFrom,
        effectiveTo: null,
        createdByUserId: actor.id,
        notes: dto.notes?.trim() || null,
      }),
    );
    saved.bidder = bidder;
    return this.individualRateDto(saved);
  }

  async endIndividualBidderRate(
    bidderId: number,
    dto: EndIndividualBidderRateDto,
    actor: User,
  ) {
    if (!canModifyIndividualBidderRates(actor)) {
      throw new ForbiddenException('Only ADMIN can change individual bidder rates');
    }
    const bidder = await this.users.findByIdOrFail(bidderId);
    if (bidder.role !== UserRole.BIDDER) {
      throw new BadRequestException('Individual rates apply only to BIDDER users');
    }
    const effectiveTo = new Date(dto.effectiveTo);
    if (Number.isNaN(effectiveTo.getTime())) {
      throw new BadRequestException('effectiveTo is invalid');
    }
    const open = await this.individualRates.find({
      where: { bidderId, effectiveTo: IsNull() },
      order: { effectiveFrom: 'DESC', id: 'DESC' },
    });
    if (open.length === 0) {
      throw new BadRequestException('This bidder has no active individual rate');
    }
    for (const row of open) {
      if (row.effectiveFrom.getTime() >= effectiveTo.getTime()) {
        throw new BadRequestException(
          'Return-to-default date must be after the current individual rate start',
        );
      }
      row.effectiveTo = effectiveTo;
      await this.individualRates.save(row);
    }
    return this.getIndividualBidderRates(bidderId, actor);
  }

  async listManagerSalaries(actor: User) {
    this.assertAdmin(actor);
    const managers = await this.users.findManagers();
    const rows = await this.salaries.find({
      order: { effectiveFrom: 'DESC', id: 'DESC' },
      relations: { manager: true },
    });
    return managers.map((manager) => {
      const history = rows.filter((row) => row.managerId === manager.id);
      const current = history.find((row) => rateCoversPeriod(row, new Date())) ?? null;
      return {
        manager: this.users.toPublicUser(manager),
        current: current ? this.salaryDto(current) : null,
        history: history.map((row) => this.salaryDto(row)),
      };
    });
  }

  async createManagerSalary(dto: CreateManagerSalaryDto, actor: User) {
    this.assertAdmin(actor);
    parseScaled(dto.weeklySalary, 4);
    const manager = await this.users.findByIdOrFail(dto.managerId);
    if (manager.role !== UserRole.BID_MANAGER) {
      throw new BadRequestException('Salary can only be set for BID_MANAGER users');
    }
    const effectiveFrom = new Date(dto.effectiveFrom);
    if (Number.isNaN(effectiveFrom.getTime())) {
      throw new BadRequestException('effectiveFrom is invalid');
    }
    const open = await this.salaries.find({
      where: { managerId: manager.id, effectiveTo: IsNull() },
    });
    for (const row of open) {
      if (row.effectiveFrom.getTime() >= effectiveFrom.getTime()) {
        throw new BadRequestException('New salary must start after the current effective date');
      }
      row.effectiveTo = effectiveFrom;
      await this.salaries.save(row);
    }
    const saved = await this.salaries.save(
      this.salaries.create({
        managerId: manager.id,
        weeklySalary: dto.weeklySalary,
        effectiveFrom,
        effectiveTo: null,
        createdByUserId: actor.id,
        notes: dto.notes?.trim() || null,
      }),
    );
    saved.manager = manager;
    return this.salaryDto(saved);
  }

  async week(actor: User, from: Date, to: Date) {
    if (isBidder(actor)) {
      await this.recalculateWeek(actor, from, to, { bidderId: actor.id });
      const mine = await this.bidderPayments.findOne({
        where: { bidderId: actor.id, periodStart: from, periodEnd: to },
        relations: { bidder: true },
      });
      return {
        from,
        to,
        bidders: mine ? [this.bidderPaymentDto(mine)] : [],
        managers: [],
        summary: this.summary(mine ? [mine] : [], []),
      };
    }
    if (!isStaff(actor)) {
      throw new ForbiddenException('You cannot view payments');
    }
    await this.recalculateWeek(actor, from, to, {});
    const bidders = await this.bidderPayments.find({
      where: { periodStart: from, periodEnd: to },
      relations: { bidder: true },
      order: { id: 'ASC' },
    });
    const managers =
      actor.role === UserRole.ADMIN
        ? await this.managerPayments.find({
            where: { periodStart: from, periodEnd: to },
            relations: { manager: true },
            order: { id: 'ASC' },
          })
        : actor.role === UserRole.BID_MANAGER
          ? await this.managerPayments.find({
              where: { managerId: actor.id, periodStart: from, periodEnd: to },
              relations: { manager: true },
            })
          : [];
    return {
      from,
      to,
      bidders: bidders.map((row) => this.bidderPaymentDto(row)),
      managers: managers.map((row) => this.managerPaymentDto(row)),
      summary: this.summary(bidders, managers),
    };
  }

  async recalculateWeek(
    actor: User,
    from: Date,
    to: Date,
    scope: { bidderId?: number } = {},
  ) {
    const globalRates = await this.rates.find({
      order: { effectiveFrom: 'DESC', id: 'DESC' },
    });
    if (!globalRates.some((row) => rateCoversPeriod(row, from))) {
      throw new BadRequestException('No bidder compensation rates are configured');
    }
    const individualRows = await this.individualRates.find();
    const activity = await this.activity.summarizeByBidder(actor, from, to);
    const activityByBidder = new Map(
      activity.map((row) => [row.bidderId, row.applications]),
    );
    const interviews = await this.interviews
      .createQueryBuilder('interview')
      .where('interview.startsAt >= :from AND interview.startsAt < :to', { from, to })
      .getMany();

    const bidders = scope.bidderId
      ? [await this.users.findByIdOrFail(scope.bidderId)]
      : await this.users.findBidders();

    for (const bidder of bidders) {
      if (bidder.role !== UserRole.BIDDER) {
        continue;
      }
      const existing = await this.bidderPayments.findOne({
        where: { bidderId: bidder.id, periodStart: from, periodEnd: to },
      });
      if (existing && !canRecalculate(existing.status)) {
        continue;
      }
      const resolved = resolveBidderRates({
        bidderId: bidder.id,
        periodStart: from,
        individualRates: individualRows,
        globalRates,
      });
      if (!resolved) {
        throw new BadRequestException('No bidder compensation rates are configured');
      }
      const applicationCount = activityByBidder.get(bidder.id) ?? 0;
      const interviewCount = countPayableInterviews(
        interviews,
        bidder.id,
        from,
        to,
      );
      const pay = bidderPay({
        applicationCount,
        interviewCount,
        applicationRate: resolved.applicationRate,
        interviewRate: resolved.interviewRate,
      });
      if (existing) {
        existing.applicationCount = applicationCount;
        existing.interviewCount = interviewCount;
        existing.applicationRate = resolved.applicationRate;
        existing.interviewRate = resolved.interviewRate;
        existing.applicationPayAmount = pay.applicationPayAmount;
        existing.interviewPayAmount = pay.interviewPayAmount;
        existing.totalAmount = pay.totalAmount;
        await this.bidderPayments.save(existing);
      } else {
        await this.bidderPayments.save(
          this.bidderPayments.create({
            bidderId: bidder.id,
            periodStart: from,
            periodEnd: to,
            applicationCount,
            interviewCount,
            applicationRate: resolved.applicationRate,
            interviewRate: resolved.interviewRate,
            applicationPayAmount: pay.applicationPayAmount,
            interviewPayAmount: pay.interviewPayAmount,
            totalAmount: pay.totalAmount,
            status: PaymentStatus.DRAFT,
          }),
        );
      }
    }

    if (!scope.bidderId && isStaff(actor)) {
      const managers = await this.users.findManagers();
      const salaries = await this.salaries.find();
      for (const manager of managers) {
        const covering = salaries
          .filter((row) => row.managerId === manager.id && rateCoversPeriod(row, from))
          .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0];
        if (!covering) {
          continue;
        }
        const existing = await this.managerPayments.findOne({
          where: { managerId: manager.id, periodStart: from, periodEnd: to },
        });
        if (existing && !canRecalculate(existing.status)) {
          continue;
        }
        const pay = managerPay(String(covering.weeklySalary));
        if (existing) {
          existing.weeklySalaryRate = pay.weeklySalaryRate;
          existing.totalAmount = pay.totalAmount;
          await this.managerPayments.save(existing);
        } else {
          await this.managerPayments.save(
            this.managerPayments.create({
              managerId: manager.id,
              periodStart: from,
              periodEnd: to,
              weeklySalaryRate: pay.weeklySalaryRate,
              totalAmount: pay.totalAmount,
              status: PaymentStatus.DRAFT,
            }),
          );
        }
      }
    }
  }

  async reviewBidderPayment(id: number, actor: User) {
    if (!isStaff(actor)) {
      throw new ForbiddenException('Only staff can review bidder payments');
    }
    const row = await this.bidderPayments.findOne({
      where: { id },
      relations: { bidder: true },
    });
    if (!row) {
      throw new NotFoundException('Payment not found');
    }
    if (!canMarkReviewed(row.status)) {
      throw new BadRequestException('Only draft payments can be marked reviewed');
    }
    row.status = PaymentStatus.REVIEWED;
    row.reviewedByUserId = actor.id;
    row.reviewedAt = new Date();
    await this.bidderPayments.save(row);
    return this.bidderPaymentDto(row);
  }

  async payBidderPayment(id: number, actor: User) {
    this.assertAdmin(actor);
    const row = await this.bidderPayments.findOne({
      where: { id },
      relations: { bidder: true },
    });
    if (!row) {
      throw new NotFoundException('Payment not found');
    }
    if (!canMarkPaid(row.status)) {
      throw new BadRequestException('Only reviewed payments can be marked paid');
    }
    row.status = PaymentStatus.PAID;
    row.paidByUserId = actor.id;
    row.paidAt = new Date();
    await this.bidderPayments.save(row);
    return this.bidderPaymentDto(row);
  }

  async reviewManagerPayment(id: number, actor: User) {
    this.assertAdmin(actor);
    const row = await this.managerPayments.findOne({
      where: { id },
      relations: { manager: true },
    });
    if (!row) {
      throw new NotFoundException('Payment not found');
    }
    if (row.managerId === actor.id) {
      throw new ForbiddenException('You cannot review your own salary');
    }
    if (!canMarkReviewed(row.status)) {
      throw new BadRequestException('Only draft payments can be marked reviewed');
    }
    row.status = PaymentStatus.REVIEWED;
    row.reviewedByUserId = actor.id;
    row.reviewedAt = new Date();
    await this.managerPayments.save(row);
    return this.managerPaymentDto(row);
  }

  async payManagerPayment(id: number, actor: User) {
    this.assertAdmin(actor);
    const row = await this.managerPayments.findOne({
      where: { id },
      relations: { manager: true },
    });
    if (!row) {
      throw new NotFoundException('Payment not found');
    }
    if (row.managerId === actor.id) {
      throw new ForbiddenException('You cannot mark your own salary paid');
    }
    if (!canMarkPaid(row.status)) {
      throw new BadRequestException('Only reviewed payments can be marked paid');
    }
    row.status = PaymentStatus.PAID;
    row.paidByUserId = actor.id;
    row.paidAt = new Date();
    await this.managerPayments.save(row);
    return this.managerPaymentDto(row);
  }

  private async rateFor(at: Date) {
    const rows = await this.rates.find({ order: { effectiveFrom: 'DESC', id: 'DESC' } });
    return rows.find((row) => rateCoversPeriod(row, at)) ?? null;
  }

  private summary(
    bidders: BidderWeeklyPayment[],
    managers: BidManagerWeeklyPayment[],
  ) {
    const bidderPayTotal = sumUsd(bidders.map((row) => row.totalAmount));
    const managerSalaryTotal = sumUsd(managers.map((row) => row.totalAmount));
    return {
      bidderPayTotal,
      managerSalaryTotal,
      payrollTotal: sumUsd([bidderPayTotal, managerSalaryTotal]),
    };
  }

  private individualRateDto(row: BidderIndividualCompensationRate) {
    return {
      id: row.id,
      bidderId: row.bidderId,
      applicationRate: String(row.applicationRate),
      interviewRate: String(row.interviewRate),
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      createdByUserId: row.createdByUserId,
      notes: row.notes,
      created_at: row.created_at,
    };
  }

  private rateDto(row: BidderCompensationRate) {
    return {
      id: row.id,
      applicationRate: String(row.applicationRate),
      interviewRate: String(row.interviewRate),
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      createdByUserId: row.createdByUserId,
      notes: row.notes,
      created_at: row.created_at,
    };
  }

  private salaryDto(row: BidManagerCompensation) {
    return {
      id: row.id,
      managerId: row.managerId,
      managerName: row.manager?.name ?? null,
      weeklySalary: String(row.weeklySalary),
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      createdByUserId: row.createdByUserId,
      notes: row.notes,
      created_at: row.created_at,
    };
  }

  private bidderPaymentDto(row: BidderWeeklyPayment) {
    return {
      id: row.id,
      bidderId: row.bidderId,
      bidderName: row.bidder?.name ?? null,
      bidderEmail: row.bidder?.email ?? null,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      applicationCount: row.applicationCount,
      interviewCount: row.interviewCount,
      applicationRate: String(row.applicationRate),
      interviewRate: String(row.interviewRate),
      applicationPayAmount: String(row.applicationPayAmount),
      interviewPayAmount: String(row.interviewPayAmount),
      totalAmount: String(row.totalAmount),
      status: row.status,
      reviewedAt: row.reviewedAt,
      paidAt: row.paidAt,
    };
  }

  private managerPaymentDto(row: BidManagerWeeklyPayment) {
    return {
      id: row.id,
      managerId: row.managerId,
      managerName: row.manager?.name ?? null,
      managerEmail: row.manager?.email ?? null,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      weeklySalaryRate: String(row.weeklySalaryRate),
      totalAmount: String(row.totalAmount),
      status: row.status,
      reviewedAt: row.reviewedAt,
      paidAt: row.paidAt,
    };
  }

  private assertAdmin(actor: User) {
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only ADMIN can change compensation settings');
    }
  }

  private assertCanViewRates(actor: User) {
    if (isStaff(actor)) {
      return;
    }
    throw new ForbiddenException('You cannot view compensation rate configuration');
  }
}
