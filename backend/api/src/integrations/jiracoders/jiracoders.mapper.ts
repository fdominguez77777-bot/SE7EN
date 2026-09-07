import { matchBidderIdByName } from './bidder-name';
import {
  JiracodersApplicationDetails,
  JiracodersApplicationListItem,
  JiracodersBidderStat,
} from './jiracoders.types';

export type ApplicationTableRow = {
  id: number;
  companyName: string;
  jobTitle: string;
  source: string;
  status: string;
  outcome: string | null;
  appliedAt: string;
  jobUrl: string | null;
  candidateFullName: string | null;
  candidateAvatarUrl: string | null;
  profileName: string | null;
  bidderId: number | null;
  bidderName: string | null;
};

export type ApplicationTableDetail = ApplicationTableRow & {
  notes: string | null;
  jobDescriptionText: string | null;
  resumeUrl: string | null;
  resumeText: string | null;
  salary: string | null;
  expYears: string | null;
  profileId: number | null;
  interviewCount: number;
  interviews: Array<{
    id: number;
    summary: string | null;
    startsAt: string | null;
    status: string | null;
  }>;
  statusHistory: Array<{
    id: number;
    status: string | null;
    outcome: string | null;
    changedAt: string | null;
    changedBy: string | null;
  }>;
  profileWorkHistory: Array<{
    companyName: string | null;
    startDate: string | null;
    endDate: string | null;
    isPresent: boolean;
  }>;
  profileEducation: Array<{
    degree: string | null;
    institutionName: string | null;
    startDate: string | null;
    endDate: string | null;
    isPresent: boolean;
  }>;
};

export type ApplicationBidderOption = {
  id: number;
  name: string;
  username: string | null;
  isActive: boolean;
  applicationsCount: number;
};

function text(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function money(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `$${value}`;
  }
  return text(value);
}

function years(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return text(value);
}

function parseJsonArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === 'object' && !Array.isArray(item),
    );
  }
  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return parseJsonArray(parsed);
  } catch {
    return [];
  }
}

function mapWorkHistory(profile: JiracodersApplicationDetails['profile']) {
  return parseJsonArray(profile?.experience).map((item) => ({
    companyName: text(item.companyName) ?? text(item.company),
    startDate: text(item.startDate) ?? text(item.fromDate),
    endDate: text(item.endDate) ?? text(item.toDate),
    isPresent: item.isPresent === true || item.currentlyWorksHere === true,
  }));
}

function mapEducation(profile: JiracodersApplicationDetails['profile']) {
  return parseJsonArray(profile?.education).map((item) => ({
    degree: text(item.degree) ?? text(item.credential) ?? text(item.field),
    institutionName:
      text(item.institutionName) ??
      text(item.institution) ??
      text(item.school) ??
      text(item.university) ??
      text(item.college),
    startDate: text(item.fromDate) ?? text(item.startDate),
    endDate: text(item.toDate) ?? text(item.endDate),
    isPresent: item.isPresent === true || item.currentlyEnrolled === true,
  }));
}

function resumeFields(resume: string | null) {
  if (!resume) {
    return { resumeUrl: null, resumeText: null };
  }
  if (/^https?:\/\//i.test(resume)) {
    return { resumeUrl: resume, resumeText: null };
  }
  return { resumeUrl: null, resumeText: resume };
}

function profileDisplayName(
  profile: JiracodersApplicationListItem['profile'],
): string | null {
  const named = text(profile?.name);
  if (named) {
    return named;
  }
  const parts = [text(profile?.firstName), text(profile?.lastName)].filter(
    Boolean,
  );
  return parts.length > 0 ? parts.join(' ') : null;
}

export function mapBidderStat(
  row: JiracodersBidderStat,
): ApplicationBidderOption | null {
  if (!Number.isFinite(row.id) || row.id < 1) {
    return null;
  }
  return {
    id: row.id,
    name: text(row.name) ?? `Bidder ${row.id}`,
    username: text(row.username),
    isActive: row.isActive !== false,
    applicationsCount: Number(row.applicationsCount) || 0,
  };
}

export function mapApplicationListItem(
  row: JiracodersApplicationListItem,
  bidders: ApplicationBidderOption[] = [],
): ApplicationTableRow | null {
  if (!Number.isFinite(row.id) || row.id < 1) {
    return null;
  }
  const bidderName = text(row.bidder?.name);

  return {
    id: row.id,
    companyName: text(row.companyName) ?? 'Unknown company',
    jobTitle: text(row.position) ?? 'Unknown position',
    source: text(row.source) ?? '',
    status: text(row.status) ?? '',
    outcome: text(row.outcome),
    appliedAt: text(row.createdAt) ?? '',
    jobUrl: text(row.url),
    candidateFullName: text(row.user?.name),
    candidateAvatarUrl: text(row.user?.avatar),
    profileName: profileDisplayName(row.profile),
    bidderId: matchBidderIdByName(bidderName, bidders),
    bidderName,
  };
}

export function mapApplicationDetails(
  row: JiracodersApplicationDetails,
  bidders: ApplicationBidderOption[] = [],
): ApplicationTableDetail | null {
  const base = mapApplicationListItem(row, bidders);
  if (!base) {
    return null;
  }
  const bidderId = base.bidderId;
  const interviews = Array.isArray(row.interviews) ? row.interviews : [];
  const history = Array.isArray(row.statusHistory) ? row.statusHistory : [];
  const resume = resumeFields(text(row.resume));

  return {
    ...base,
    bidderId,
    notes: text(row.note),
    jobDescriptionText: text(row.jobDescription),
    ...resume,
    salary: money(row.salary),
    expYears: years(row.expYears),
    profileId:
      typeof row.profileId === 'number' && row.profileId > 0
        ? row.profileId
        : null,
    interviewCount: interviews.length,
    interviews: interviews.map((item, index) => ({
      id: item.id ?? index,
      summary: text(item.event?.summary),
      startsAt: text(item.event?.start),
      status: text(item.event?.status),
    })),
    statusHistory: history.map((item, index) => ({
      id: item.id ?? index,
      status: text(item.status),
      outcome: text(item.outcome),
      changedAt: text(item.changedAt),
      changedBy: text(item.changedByUser?.name),
    })),
    profileWorkHistory: mapWorkHistory(row.profile),
    profileEducation: mapEducation(row.profile),
  };
}
