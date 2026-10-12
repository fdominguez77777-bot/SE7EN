import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';

import { CalendarAccount } from '../calendar/calendar-account.entity';
import { CalendarProvider } from '../calendar/calendar.rules';
import { User } from '../users/user.entity';
import { LoginHistory } from './login-history.entity';
import {
  formatLocation,
  type LoginRequestMeta,
} from './login-request-meta';

/** Reuse the same visit row while the member keeps the platform open. */
const SESSION_IDLE_MS = 45 * 60 * 1000;

export type LoginHistoryRow = {
  id: number;
  userId: number;
  username: string;
  displayName: string;
  role: string;
  ipAddress: string;
  country: string | null;
  region: string | null;
  city: string | null;
  location: string;
  userAgent: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  deviceSummary: string;
  gmailAddresses: string[];
  createdAt: string;
  lastSeenAt: string;
  durationMs: number;
  active: boolean;
};

@Injectable()
export class LoginHistoryService {
  constructor(
    @InjectRepository(LoginHistory)
    private readonly history: Repository<LoginHistory>,
    @InjectRepository(CalendarAccount)
    private readonly calendars: Repository<CalendarAccount>,
  ) {}

  /** Alias used by auth login — opens or extends a platform visit. */
  async record(user: User, meta: LoginRequestMeta): Promise<void> {
    await this.touchSession(user, meta);
  }

  /**
   * Called when someone opens the platform (or stays active).
   * Extends an existing visit or starts a new one after idle gap.
   */
  async touchSession(user: User, meta: LoginRequestMeta): Promise<void> {
    try {
      const now = new Date();
      const idleSince = new Date(now.getTime() - SESSION_IDLE_MS);
      const existing = await this.history.findOne({
        where: {
          userId: user.id,
          lastSeenAt: MoreThanOrEqual(idleSince),
          ...(meta.userAgent
            ? { userAgent: meta.userAgent.slice(0, 512) }
            : {}),
        },
        order: { lastSeenAt: 'DESC' },
      });

      if (existing) {
        existing.lastSeenAt = now;
        existing.ipAddress = meta.ipAddress.slice(0, 64);
        existing.country = meta.country;
        existing.region = meta.region;
        existing.city = meta.city;
        existing.device = meta.device;
        existing.browser = meta.browser;
        existing.os = meta.os;
        await this.history.save(existing);
        return;
      }

      await this.history.save(
        this.history.create({
          userId: user.id,
          username: user.email,
          displayName: user.name,
          role: user.role,
          ipAddress: meta.ipAddress.slice(0, 64),
          country: meta.country,
          region: meta.region,
          city: meta.city,
          userAgent: meta.userAgent,
          device: meta.device,
          browser: meta.browser,
          os: meta.os,
          lastSeenAt: now,
        }),
      );
    } catch {
      // Never block the app if visit tracking fails.
    }
  }

  async list(query?: {
    userId?: number;
    limit?: number;
    from?: Date;
    to?: Date;
  }): Promise<{
    items: LoginHistoryRow[];
    summary: {
      total: number;
      today: number;
      uniqueUsersToday: number;
      uniqueCountries: number;
      uniqueUsers: number;
      totalDurationMs: number;
    };
  }> {
    const ranged = Boolean(query?.from || query?.to);
    const limit = Math.min(
      Math.max(query?.limit ?? (ranged ? 1000 : 100), 1),
      ranged ? 2000 : 300,
    );
    const qb = this.history
      .createQueryBuilder('h')
      .orderBy(ranged ? 'h.createdAt' : 'h.lastSeenAt', 'DESC')
      .take(limit);
    if (query?.userId && query.userId > 0) {
      qb.andWhere('h.userId = :userId', { userId: query.userId });
    }
    if (query?.from) {
      qb.andWhere('h.createdAt >= :from', { from: query.from });
    }
    if (query?.to) {
      qb.andWhere('h.createdAt < :to', { to: query.to });
    }
    const rows = await qb.getMany();
    const gmails = await this.gmailsByUser(rows.map((row) => row.userId));
    const items = rows.map((row) => this.toRow(row, gmails.get(row.userId) ?? []));

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayRows = rows.filter(
      (row) => row.createdAt.getTime() >= startOfDay.getTime(),
    );
    const uniqueUsersToday = new Set(todayRows.map((row) => row.userId)).size;
    const uniqueCountries = new Set(
      rows.map((row) => row.country).filter(Boolean),
    ).size;

    return {
      items,
      summary: {
        total: rows.length,
        today: todayRows.length,
        uniqueUsersToday,
        uniqueCountries,
        uniqueUsers: new Set(rows.map((row) => row.userId)).size,
        totalDurationMs: items.reduce((sum, row) => sum + row.durationMs, 0),
      },
    };
  }

  /** Google accounts connected to this member. That is the Gmail they signed in with. */
  private async gmailsByUser(userIds: number[]): Promise<Map<number, string[]>> {
    const ids = [...new Set(userIds.filter((id) => id > 0))];
    const map = new Map<number, string[]>();
    if (ids.length === 0) {
      return map;
    }
    const accounts = await this.calendars.find({
      where: { assignedBidderId: In(ids), provider: CalendarProvider.GOOGLE },
      select: { assignedBidderId: true, email: true },
    });
    for (const account of accounts) {
      const ownerId = account.assignedBidderId;
      const email = account.email.trim().toLowerCase();
      if (!ownerId || !email) {
        continue;
      }
      const list = map.get(ownerId) ?? [];
      if (!list.includes(email)) {
        list.push(email);
      }
      map.set(ownerId, list);
    }
    for (const list of map.values()) {
      list.sort((left, right) => left.localeCompare(right));
    }
    return map;
  }

  private toRow(row: LoginHistory, gmailAddresses: string[]): LoginHistoryRow {
    const lastSeenAt = row.lastSeenAt ?? row.createdAt;
    const durationMs = Math.max(
      0,
      lastSeenAt.getTime() - row.createdAt.getTime(),
    );
    const deviceSummary = [row.browser, row.os, row.device]
      .filter(Boolean)
      .join(' · ');
    return {
      id: row.id,
      userId: row.userId,
      username: row.username,
      displayName: row.displayName,
      role: row.role,
      ipAddress: row.ipAddress,
      country: row.country,
      region: row.region,
      city: row.city,
      location: formatLocation(row),
      userAgent: row.userAgent,
      device: row.device,
      browser: row.browser,
      os: row.os,
      deviceSummary: deviceSummary || 'Unknown device',
      gmailAddresses,
      createdAt: row.createdAt.toISOString(),
      lastSeenAt: lastSeenAt.toISOString(),
      durationMs,
      active: Date.now() - lastSeenAt.getTime() < 3 * 60 * 1000,
    };
  }
}
