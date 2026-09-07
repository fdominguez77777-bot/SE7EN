export const JobApplicationStatus = {
  APPLIED: 'APPLIED',
  INTERVIEWING: 'INTERVIEWING',
  REJECTED: 'REJECTED',
  OFFER: 'OFFER',
  WITHDRAWN: 'WITHDRAWN',
} as const;

export const JobApplicationSource = {
  MANUAL: 'MANUAL',
  HIRINGCAFE: 'HIRINGCAFE',
  REMOTEYEAH: 'REMOTEYEAH',
  LINKEDIN: 'LINKEDIN',
  TALYN: 'TALYN',
  OTHER: 'OTHER',
} as const;

export function canBidderRecordForCandidate(
  assignedBidderId: number | null | undefined,
  bidderUserId: number,
) {
  return assignedBidderId === bidderUserId;
}

export function requireAssignedBidderId(assignedBidderId: number | null | undefined) {
  if (!assignedBidderId) {
    return null;
  }
  return assignedBidderId;
}

/** Historical snapshot: later reassignment must not rewrite this id. */
export function keepHistoricalBidderId(
  recordedBidderId: number,
  _currentAssignedBidderId?: number | null,
) {
  return recordedBidderId;
}

export function generatesApplicationActivity(
  operation: 'create' | 'update' | 'duplicate',
) {
  return operation === 'create';
}

export function importedRecordIdentity(
  source: string,
  sourceExternalId: string | null | undefined,
) {
  const externalId = sourceExternalId?.trim() || null;
  if (!externalId) {
    return null;
  }
  return { source, sourceExternalId: externalId };
}

export function canBidderViewApplication(params: {
  actorId: number;
  applicationBidderId: number | null | undefined;
  candidateAssignedBidderId: number | null | undefined;
}) {
  return (
    params.applicationBidderId === params.actorId ||
    params.candidateAssignedBidderId === params.actorId
  );
}

export function canBidderMutateApplication(params: {
  actorId: number;
  applicationBidderId: number | null | undefined;
  candidateAssignedBidderId: number | null | undefined;
}) {
  return (
    params.applicationBidderId === params.actorId ||
    params.candidateAssignedBidderId === params.actorId
  );
}

export function buildApplicationActivityEvent(params: {
  candidateProfileId: number;
  bidderId: number;
  appliedAt: Date;
  createdById: number | null;
  jobApplicationId: number;
}) {
  return {
    candidateProfileId: params.candidateProfileId,
    bidderId: params.bidderId,
    type: 'APPLICATION' as const,
    delta: 1,
    occurredAt: params.appliedAt,
    createdById: params.createdById,
    jobApplicationId: params.jobApplicationId,
  };
}

export function isExternalDuplicate(
  existing: { source: string; sourceExternalId: string | null } | null,
  source: string,
  sourceExternalId: string | null,
) {
  if (!sourceExternalId || !existing) {
    return false;
  }
  return (
    existing.source === source && existing.sourceExternalId === sourceExternalId
  );
}
