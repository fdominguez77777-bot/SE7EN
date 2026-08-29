import { BidInvitation } from './bid-invitation.entity';

export function toInvitationDto(invite: BidInvitation) {
  return {
    id: invite.id,
    projectId: invite.projectId,
    projectTitle: invite.project?.title ?? null,
    bidderProfileId: invite.bidderProfileId,
    bidderName: invite.bidderProfile?.name ?? null,
    status: invite.status,
    invitedById: invite.invitedById,
    created_at: invite.created_at,
    updated_at: invite.updated_at,
  };
}
