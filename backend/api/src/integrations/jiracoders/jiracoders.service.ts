import { Injectable, NotFoundException } from '@nestjs/common';

import { UsersService } from '../../users/users.service';
import {
  ApplicationColumnFilters,
  hasApplicationColumnFilters,
  matchesApplicationColumnFilters,
} from './application-column-filter';
import { countsTowardApplicationTotal, countApplicationsByBidderName, matchBidderIdByName } from './bidder-name';
import { JiracodersClient } from './jiracoders.client';
import {
  ApplicationBidderOption,
  ApplicationTableDetail,
  ApplicationTableRow,
  mapApplicationDetails,
  mapApplicationListItem,
} from './jiracoders.mapper';

const PAGE_SIZE = 100;
const MAX_PAGES = 20;
const FETCH_BATCH = 5;
const CACHE_MS = 60_000;

export type CreditedApplication = {
  id: number;
  bidderId: number | null;
  bidderName: string | null;
  companyName: string;
  appliedAt: Date;
};

@Injectable()
export class JiracodersApplicationsService {
  private readonly listCache = new Map<
    string,
    { at: number; items: ApplicationTableRow[] }
  >();

  constructor(
    private readonly client: JiracodersClient,
    private readonly users: UsersService,
  ) {}

  async list(query: {
    page?: number;
    limit?: number;
    keyword?: string;
    status?: string;
    cursor?: string;
    bidderId?: number;
    fromDate?: string;
    toDate?: string;
    company?: string;
    position?: string;
    source?: string;
    statusContains?: string;
    applied?: string;
    bidderName?: string;
  }): Promise<{
    items: ApplicationTableRow[];
    count: number | null;
    page: number;
    limit: number;
  }> {
    const columnFilters = columnFiltersFromQuery(query);
    const bidderFilter =
      query.bidderId && query.bidderId > 0 ? query.bidderId : undefined;
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const bidders = await this.loadLocalBidders();
    const needsScan = Boolean(
      bidderFilter ||
        query.fromDate ||
        query.toDate ||
        hasApplicationColumnFilters(columnFilters),
    );

    if (needsScan) {
      let credited = await this.collectMapped(query, bidders);
      if (bidderFilter) {
        credited = credited.filter((row) => row.bidderId === bidderFilter);
      }
      if (query.fromDate || query.toDate) {
        credited = credited.filter((row) =>
          inInclusiveDateRange(row.appliedAt, query.fromDate, query.toDate),
        );
      }
      credited = credited.filter((row) =>
        matchesApplicationColumnFilters(row, columnFilters),
      );
      const start = (page - 1) * limit;
      return {
        items: credited.slice(start, start + limit),
        count: credited.length,
        page,
        limit,
      };
    }

    const list = await this.client.listApplications({
      page,
      limit,
      keyword: query.keyword,
      status: query.status,
      cursor: query.cursor,
      fromDate: query.fromDate,
      toDate: query.toDate,
      includeCount: true,
    });
    const rows = Array.isArray(list.data) ? list.data : [];
    const items = rows
      .map((row) => mapApplicationListItem(row, bidders))
      .filter((row): row is ApplicationTableRow => row !== null);

    return {
      items,
      count: list.count ?? items.length,
      page,
      limit,
    };
  }

  async getOne(id: number): Promise<ApplicationTableDetail> {
    const [details, bidders] = await Promise.all([
      this.client.getApplicationDetails(id),
      this.loadLocalBidders(),
    ]);
    const mapped = details.data
      ? mapApplicationDetails(details.data, bidders)
      : null;
    if (!mapped) {
      throw new NotFoundException('Job application not found.');
    }
    return mapped;
  }

  async listBidders(): Promise<ApplicationBidderOption[]> {
    const bidders = await this.loadLocalBidders();
    try {
      const envelope = await this.client.listBidderStats();
      const stats = Array.isArray(envelope.data) ? envelope.data : [];
      const counts = new Map<number, number>();
      for (const row of stats) {
        const id = matchBidderIdByName(row.name ?? null, bidders);
        if (id == null) {
          continue;
        }
        counts.set(id, Number(row.applicationsCount) || 0);
      }
      return bidders
        .map((bidder) => ({
          ...bidder,
          applicationsCount: counts.get(bidder.id) ?? 0,
        }))
        .sort((left, right) => left.name.localeCompare(right.name));
    } catch {
      return bidders.sort((left, right) => left.name.localeCompare(right.name));
    }
  }

  async applicationCountsByBidder(
    from?: Date,
    to?: Date,
  ): Promise<Map<number, number>> {
    const bidders = await this.loadLocalBidders();
    const credited = await this.creditedApplications(from, to);
    const counts = countApplicationsByBidderName(credited, bidders);
    for (const bidder of bidders) {
      if (!counts.has(bidder.id)) {
        counts.set(bidder.id, 0);
      }
    }
    return counts;
  }

  async creditedApplications(
    from?: Date,
    to?: Date,
  ): Promise<CreditedApplication[]> {
    const bidders = await this.loadLocalBidders();
    const mapped = await this.collectMapped(
      {
        fromDate: from ? queryDate(from) : undefined,
        toDate: to ? queryDate(new Date(to.getTime() - 1)) : undefined,
      },
      bidders,
    );
    return mapped
      .map((row) => {
        const appliedAt = parseAppliedAt(row.appliedAt);
        if (!appliedAt) {
          return null;
        }
        if (from && appliedAt.getTime() < from.getTime()) {
          return null;
        }
        if (to && appliedAt.getTime() >= to.getTime()) {
          return null;
        }
        if (!countsTowardApplicationTotal(row.status)) {
          return null;
        }
        return {
          id: row.id,
          bidderId: row.bidderId,
          bidderName: row.bidderName,
          companyName: row.companyName,
          appliedAt,
        };
      })
      .filter((row): row is CreditedApplication => row !== null);
  }

  private async collectMapped(
    query: {
      keyword?: string;
      status?: string;
      fromDate?: string;
      toDate?: string;
    },
    bidders: ApplicationBidderOption[],
  ): Promise<ApplicationTableRow[]> {
    const cacheKey = JSON.stringify({
      keyword: query.keyword ?? '',
      status: query.status ?? '',
      fromDate: query.fromDate ?? '',
      toDate: query.toDate ?? '',
    });
    const cached = this.listCache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_MS) {
      return cached.items;
    }

    const first = await this.client.listApplications({
      page: 1,
      limit: PAGE_SIZE,
      keyword: query.keyword,
      status: query.status,
      fromDate: query.fromDate,
      toDate: query.toDate,
      includeCount: true,
    });
    const firstRows = Array.isArray(first.data) ? first.data : [];
    const items: ApplicationTableRow[] = [];
    pushMapped(firstRows, bidders, items);

    const total = typeof first.count === 'number' ? first.count : null;
    const pageCount =
      total != null
        ? Math.min(MAX_PAGES, Math.max(1, Math.ceil(total / PAGE_SIZE)))
        : MAX_PAGES;
    const fromBound = query.fromDate ? startOfQueryDate(query.fromDate) : null;

    if (
      firstRows.length === PAGE_SIZE &&
      pageCount > 1 &&
      !pageIsOlderThan(firstRows, fromBound)
    ) {
      const remaining = Array.from({ length: pageCount - 1 }, (_, index) => index + 2);
      for (let offset = 0; offset < remaining.length; offset += FETCH_BATCH) {
        const batch = remaining.slice(offset, offset + FETCH_BATCH);
        const pages = await Promise.all(
          batch.map((page) =>
            this.client.listApplications({
              page,
              limit: PAGE_SIZE,
              keyword: query.keyword,
              status: query.status,
              fromDate: query.fromDate,
              toDate: query.toDate,
            }),
          ),
        );
        let stop = false;
        for (const page of pages) {
          const rows = Array.isArray(page.data) ? page.data : [];
          pushMapped(rows, bidders, items);
          if (rows.length < PAGE_SIZE || pageIsOlderThan(rows, fromBound)) {
            stop = true;
            break;
          }
        }
        if (stop) {
          break;
        }
      }
    }

    this.listCache.set(cacheKey, { at: Date.now(), items });
    return items;
  }

  private async loadLocalBidders(): Promise<ApplicationBidderOption[]> {
    const users = await this.users.findBidders();
    return users.map((user) => ({
      id: user.id,
      name: user.name,
      username: null,
      isActive: user.isActive !== false,
      applicationsCount: 0,
    }));
  }
}

function pushMapped(
  rows: Parameters<typeof mapApplicationListItem>[0][],
  bidders: ApplicationBidderOption[],
  into: ApplicationTableRow[],
) {
  for (const row of rows) {
    const mapped = mapApplicationListItem(row, bidders);
    if (mapped) {
      into.push(mapped);
    }
  }
}

function columnFiltersFromQuery(query: {
  company?: string;
  position?: string;
  source?: string;
  statusContains?: string;
  applied?: string;
  bidderName?: string;
}): ApplicationColumnFilters {
  return {
    company: query.company,
    position: query.position,
    source: query.source,
    status: query.statusContains,
    applied: query.applied,
    bidderName: query.bidderName,
  };
}

function startOfQueryDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).getTime();
}

function pageIsOlderThan(
  rows: Array<{ createdAt?: string | null }>,
  fromBound: number | null,
) {
  if (fromBound == null || rows.length === 0) {
    return false;
  }
  return rows.every((row) => {
    const at = parseAppliedAt(row.createdAt ?? '');
    return at != null && at.getTime() < fromBound;
  });
}

function parseAppliedAt(value: string) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function queryDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function inInclusiveDateRange(
  appliedAt: string,
  fromDate?: string,
  toDate?: string,
) {
  const at = parseAppliedAt(appliedAt);
  if (!at) {
    return false;
  }
  if (fromDate) {
    const [year, month, day] = fromDate.split('-').map(Number);
    const from = new Date(year, month - 1, day);
    if (at.getTime() < from.getTime()) {
      return false;
    }
  }
  if (toDate) {
    const [year, month, day] = toDate.split('-').map(Number);
    const to = new Date(year, month - 1, day + 1);
    if (at.getTime() >= to.getTime()) {
      return false;
    }
  }
  return true;
}
