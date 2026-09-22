import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';

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
  }): Promise<{
    items: LoginHistoryRow[];
    summary: {
      total: number;
      today: number;
      uniqueUsersToday: number;
      uniqueCountries: number;
    };
  }> {
    const limit = Math.min(Math.max(query?.limit ?? 100, 1), 300);
    const qb = this.history
      .createQueryBuilder('h')
      .orderBy('h.lastSeenAt', 'DESC')
      .take(limit);
    if (query?.userId && query.userId > 0) {
      qb.andWhere('h.userId = :userId', { userId: query.userId });
    }
    const rows = await qb.getMany();

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
      items: rows.map((row) => this.toRow(row)),
      summary: {
        total: rows.length,
        today: todayRows.length,
        uniqueUsersToday,
        uniqueCountries,
      },
    };
  }

  private toRow(row: LoginHistory): LoginHistoryRow {
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
      createdAt: row.createdAt.toISOString(),
      lastSeenAt: lastSeenAt.toISOString(),
      durationMs,
      active: Date.now() - lastSeenAt.getTime() < 3 * 60 * 1000,
    };
  }
}
