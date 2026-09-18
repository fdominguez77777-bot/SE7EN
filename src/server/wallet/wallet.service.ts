import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { formatUsdFromCents } from '../compensation/compensation-money';
import { User } from '../users/user.entity';
import {
  CreateWalletTransactionDto,
  UpdateWalletTransactionDto,
  VoidWalletTransactionDto,
} from './dto/wallet.dto';
import { WalletTransaction } from './wallet-transaction.entity';
import {
  dailyNetSeries,
  directionForType,
  isoDaysBack,
  isoMonthWindow,
  monthlyNetSeries,
  isWalletMember,
  parseOccurredOn,
  parseWalletAmountCents,
  previousWindow,
  signedCents,
  summarizeWallet,
  WALLET_MESSAGES,
  WalletStatus,
  walletCreateBlockReason,
  withRunningBalances,
} from './wallet.rules';

function todayIso() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(WalletTransaction)
    private readonly transactions: Repository<WalletTransaction>,
  ) {}

  async getLedger(
    actor: User,
    query: { from?: string; to?: string; type?: string; search?: string },
  ) {
    this.assertMember(actor);
    const rows = await this.transactions.find({
      where: { ownerUserId: actor.id },
      relations: { createdByUser: true, voidedByUser: true },
      order: { occurredOn: 'ASC', id: 'ASC' },
    });
    const withSign = rows.map((row) => ({
      row,
      signed: signedCents(row.direction, row.amount),
    }));
    const postedChrono = withRunningBalances(
      withSign
        .filter((item) => item.row.status === WalletStatus.POSTED)
        .map((item) => ({
          id: item.row.id,
          signedCents: item.signed,
        })),
    );
    const balanceById = new Map(
      postedChrono.map((item) => [item.id, item.balanceAfter]),
    );
    const from = query.from ? parseOccurredOn(query.from) : null;
    const to = query.to ? parseOccurredOn(query.to) : null;
    const type = query.type?.trim().toUpperCase();
    const search = query.search?.trim().toLowerCase();
    const filtered = withSign.filter(({ row }) => {
      if (from && row.occurredOn < from) {
        return false;
      }
      if (to && row.occurredOn > to) {
        return false;
      }
      if (type && type !== 'ALL' && type !== 'VOID' && row.type !== type) {
        return false;
      }
      if (type === 'VOID' && row.status !== WalletStatus.VOID) {
        return false;
      }
      if (search) {
        const haystack =
          `${row.counterparty} ${row.reference ?? ''} ${row.notes ?? ''}`.toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }
      return true;
    });
    const mapped = withSign.map((item) => ({
      status: item.row.status,
      type: item.row.type,
      signedCents: item.signed,
      occurredOn: item.row.occurredOn,
    }));
    const period = from && to ? { from, to } : undefined;
    const summary = summarizeWallet(mapped, period);
    const prior = from && to ? previousWindow(from, to) : null;
    const previous = prior ? summarizeWallet(mapped, prior) : null;
    const endDay = to || todayIso();
    const spark = dailyNetSeries(mapped, isoDaysBack(endDay, 14));
    const months = monthlyNetSeries(mapped, isoMonthWindow(todayIso().slice(0, 7), 12));
    return {
      summary: {
        ...summary,
        previousPeriodIn: previous?.periodIn ?? null,
        previousPeriodOut: previous?.periodOut ?? null,
        previousPeriodNet: previous?.periodNet ?? null,
      },
      spark,
      months,
      items: filtered
        .slice()
        .reverse()
        .map(({ row, signed }) =>
          this.toDto(row, signed, balanceById.get(row.id) ?? null),
        ),
    };
  }

  async create(dto: CreateWalletTransactionDto, actor: User) {
    this.assertMember(actor);
    const blocked = walletCreateBlockReason({
      type: dto.type,
      amount: dto.amount,
      occurredOn: dto.occurredOn,
      counterparty: dto.counterparty,
      method: dto.method,
      direction: dto.direction,
    });
    if (blocked) {
      throw new BadRequestException(blocked);
    }
    const occurredOn = parseOccurredOn(dto.occurredOn)!;
    const direction = directionForType(dto.type, dto.direction);
    const cents = parseWalletAmountCents(dto.amount);
    const saved = await this.transactions.save(
      this.transactions.create({
        occurredOn,
        type: dto.type,
        direction,
        amount: formatUsdFromCents(cents),
        counterparty: dto.counterparty.trim(),
        method: dto.method,
        reference: dto.reference?.trim() || null,
        notes: dto.notes?.trim() || null,
        status: WalletStatus.POSTED,
        ownerUserId: actor.id,
        createdByUserId: actor.id,
      }),
    );
    return this.toDto(saved, signedCents(direction, formatUsdFromCents(cents)), null);
  }

  async update(id: number, dto: UpdateWalletTransactionDto, actor: User) {
    this.assertMember(actor);
    const row = await this.requireOwnedRow(id, actor);
    if (row.status !== WalletStatus.POSTED) {
      throw new BadRequestException(WALLET_MESSAGES.alreadyVoid);
    }
    if (dto.occurredOn !== undefined) {
      const occurredOn = parseOccurredOn(dto.occurredOn);
      if (!occurredOn) {
        throw new BadRequestException(WALLET_MESSAGES.invalidDate);
      }
      row.occurredOn = occurredOn;
    }
    if (dto.counterparty !== undefined) {
      const counterparty = dto.counterparty.trim();
      if (!counterparty) {
        throw new BadRequestException(WALLET_MESSAGES.counterpartyRequired);
      }
      row.counterparty = counterparty;
    }
    if (dto.method !== undefined) {
      row.method = dto.method;
    }
    if (dto.reference !== undefined) {
      row.reference = dto.reference.trim() || null;
    }
    if (dto.notes !== undefined) {
      row.notes = dto.notes.trim() || null;
    }
    const saved = await this.transactions.save(row);
    return this.toDto(saved, signedCents(saved.direction, saved.amount), null);
  }

  async void(id: number, dto: VoidWalletTransactionDto, actor: User) {
    this.assertMember(actor);
    const row = await this.requireOwnedRow(id, actor);
    if (row.status !== WalletStatus.POSTED) {
      throw new BadRequestException(WALLET_MESSAGES.alreadyVoid);
    }
    row.status = WalletStatus.VOID;
    row.voidedAt = new Date();
    row.voidedByUserId = actor.id;
    row.voidReason = dto.reason?.trim() || null;
    const saved = await this.transactions.save(row);
    return this.toDto(saved, signedCents(saved.direction, saved.amount), null);
  }

  async remove(id: number, actor: User) {
    this.assertMember(actor);
    const row = await this.requireOwnedRow(id, actor);
    await this.transactions.remove(row);
    return { id, deleted: true };
  }

  private async requireOwnedRow(id: number, actor: User) {
    const row = await this.transactions.findOne({
      where: { id, ownerUserId: actor.id },
      relations: { createdByUser: true, voidedByUser: true },
    });
    if (!row) {
      throw new NotFoundException(WALLET_MESSAGES.notFound);
    }
    return row;
  }

  private toDto(
    row: WalletTransaction,
    signed: bigint,
    balanceAfter: string | null,
  ) {
    return {
      id: row.id,
      occurredOn: row.occurredOn,
      type: row.type,
      direction: row.direction,
      amount: row.amount,
      signedAmount: formatUsdFromCents(signed),
      counterparty: row.counterparty,
      method: row.method,
      reference: row.reference,
      notes: row.notes,
      status: row.status,
      balanceAfter,
      createdByName: row.createdByUser?.name ?? null,
      voidedByName: row.voidedByUser?.name ?? null,
      voidedAt: row.voidedAt ? row.voidedAt.toISOString() : null,
      voidReason: row.voidReason,
      createdAt: row.created_at?.toISOString?.() ?? new Date().toISOString(),
    };
  }

  private assertMember(actor: User) {
    if (!isWalletMember(actor.role)) {
      throw new ForbiddenException(WALLET_MESSAGES.adminOnly);
    }
  }
}
