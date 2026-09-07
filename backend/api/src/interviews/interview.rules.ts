import { JobApplicationStatus } from '../job-applications/job-application.rules';

export const InterviewStatus = {
  SCHEDULED: 'SCHEDULED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
} as const;

export const InterviewMethod = {
  PHONE: 'PHONE',
  VIDEO: 'VIDEO',
  ONSITE: 'ONSITE',
  OTHER: 'OTHER',
} as const;

export function snapshotInterviewBidderId(params: {
  applicationBidderId?: number | null;
  assignedBidderId?: number | null;
}) {
  if (params.applicationBidderId) {
    return params.applicationBidderId;
  }
  return params.assignedBidderId ?? null;
}

export function keepHistoricalInterviewBidderId(
  recordedBidderId: number | null,
  _currentAssignedBidderId?: number | null,
) {
  return recordedBidderId;
}

export function shouldPromoteApplicationToInterviewing(status: string) {
  return status === JobApplicationStatus.APPLIED;
}

export function applicationStatusAfterInterviewCreate(status: string) {
  if (shouldPromoteApplicationToInterviewing(status)) {
    return JobApplicationStatus.INTERVIEWING;
  }
  return status;
}

export function migratedInterviewStatus(startsAt: Date, now = new Date()) {
  return startsAt.getTime() < now.getTime()
    ? InterviewStatus.COMPLETED
    : InterviewStatus.SCHEDULED;
}

export function isScheduledUpcoming(
  item: { status: string | null | undefined; startsAt: Date | string },
  now = Date.now(),
) {
  return (
    item.status === InterviewStatus.SCHEDULED &&
    new Date(item.startsAt).getTime() >= now
  );
}

export function canBidderCreateLinkedInterview(params: {
  actorId: number;
  applicationBidderId: number | null | undefined;
  candidateAssignedBidderId: number | null | undefined;
}) {
  return (
    params.applicationBidderId === params.actorId ||
    params.candidateAssignedBidderId === params.actorId
  );
}

export function canBidderViewInterview(params: {
  actorId: number;
  interviewBidderId: number | null | undefined;
  candidateAssignedBidderId: number | null | undefined;
}) {
  return (
    params.interviewBidderId === params.actorId ||
    params.candidateAssignedBidderId === params.actorId
  );
}

export function deriveInterviewFromApplication(application: {
  candidateProfileId: number;
  companyName: string;
  jobTitle: string;
  bidderId: number | null;
}) {
  return {
    candidateProfileId: application.candidateProfileId,
    company: application.companyName,
    jobTitle: application.jobTitle,
    bidderId: application.bidderId,
  };
}
