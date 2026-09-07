import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EnvironmentVariables } from '../../config/env.validation';
import {
  JiracodersApplicationDetails,
  JiracodersApplicationListItem,
  JiracodersBidderStat,
  JiracodersEnvelope,
  JiracodersListQuery,
} from './jiracoders.types';

type UpstreamError = {
  status: number;
  message: string;
};

@Injectable()
export class JiracodersClient {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  listApplications(query: JiracodersListQuery) {
    const params = new URLSearchParams();
    if (query.page && query.page > 0 && !query.cursor) {
      params.set('page', String(query.page));
    }
    if (query.limit && query.limit > 0) {
      params.set('limit', String(Math.min(query.limit, 100)));
    }
    if (query.keyword && query.keyword.trim().length >= 2) {
      params.set('keyword', query.keyword.trim());
    }
    if (query.status?.trim()) {
      params.set('status', query.status.trim());
    }
    if (query.cursor?.trim()) {
      params.set('cursor', query.cursor.trim());
    }
    if (query.fromDate?.trim()) {
      params.set('fromDate', query.fromDate.trim());
    }
    if (query.toDate?.trim()) {
      params.set('toDate', query.toDate.trim());
    }
    if (query.includeCount) {
      params.set('includeCount', 'true');
    }
    return this.getJson<JiracodersApplicationListItem[]>(
      `/api/pju/job/applications${qs(params)}`,
    );
  }

  getApplicationDetails(id: number) {
    return this.getJson<JiracodersApplicationDetails>(
      `/api/pju/job/application/${id}/details`,
    );
  }

  listBidderStats(query?: { fromDate?: string; toDate?: string; timezone?: string }) {
    const params = new URLSearchParams();
    if (query?.fromDate) {
      params.set('fromDate', query.fromDate);
    }
    if (query?.toDate) {
      params.set('toDate', query.toDate);
    }
    if (query?.timezone) {
      params.set('timezone', query.timezone);
    }
    return this.getJson<JiracodersBidderStat[]>(
      `/api/pju/bidder/stats${qs(params)}`,
    );
  }

  private baseUrl() {
    return (
      this.config.get('JIRACODERS_API_BASE_URL', { infer: true }) ??
      'https://api.jiracoders.com'
    ).replace(/\/$/, '');
  }

  private token() {
    return (
      this.config.get('JIRACODERS_API_TOKEN', { infer: true }) ?? ''
    ).trim();
  }

  private async getJson<T>(path: string): Promise<JiracodersEnvelope<T>> {
    const token = this.token();
    if (!token) {
      throw new ServiceUnavailableException(
        'JiraCoders is not configured. Set JIRACODERS_API_TOKEN.',
      );
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl()}${path}`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new BadGatewayException('Could not reach JiraCoders.');
    }

    const envelope = await readEnvelope(response);
    if (response.ok && envelope.success !== false) {
      return envelope as JiracodersEnvelope<T>;
    }

    throw mapUpstreamError({
      status: response.status,
      message:
        envelope.message || `JiraCoders request failed (${response.status}).`,
    });
  }
}

function qs(params: URLSearchParams) {
  const value = params.toString();
  return value ? `?${value}` : '';
}

async function readEnvelope(response: Response): Promise<JiracodersEnvelope<unknown>> {
  const raw = await response.text();
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw) as JiracodersEnvelope<unknown>;
  } catch {
    return { message: raw.slice(0, 200) };
  }
}

function mapUpstreamError(error: UpstreamError): never {
  if (error.status === 400) {
    throw new BadRequestException(error.message);
  }
  if (error.status === 401) {
    throw new BadGatewayException(
      'JiraCoders rejected the configured token.',
    );
  }
  if (error.status === 403) {
    throw new BadGatewayException(
      'JiraCoders denied access to this resource.',
    );
  }
  if (error.status === 404) {
    throw new NotFoundException(error.message || 'Job application not found.');
  }
  throw new BadGatewayException(error.message);
}
