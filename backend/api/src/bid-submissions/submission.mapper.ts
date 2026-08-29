import { BidSubmission } from './bid-submission.entity';

export function toSubmissionDto(submission: BidSubmission) {
  return {
    id: submission.id,
    projectId: submission.projectId,
    projectTitle: submission.project?.title ?? null,
    bidderProfileId: submission.bidderProfileId,
    bidderName: submission.bidderProfile?.name ?? null,
    invitationId: submission.invitationId,
    amount: Number(submission.amount),
    currency: submission.currency,
    notes: submission.notes,
    status: submission.status,
    createdById: submission.createdById,
    created_at: submission.created_at,
    updated_at: submission.updated_at,
  };
}
