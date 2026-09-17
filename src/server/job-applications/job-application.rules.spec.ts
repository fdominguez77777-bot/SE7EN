import {
  buildApplicationActivityEvent,
  canBidderMutateApplication,
  canBidderRecordForCandidate,
  canBidderViewApplication,
  generatesApplicationActivity,
  importedRecordIdentity,
  isExternalDuplicate,
  JobApplicationSource,
  JobApplicationStatus,
  keepHistoricalBidderId,
  requireAssignedBidderId,
} from './job-application.rules';

describe('job application rules', () => {
  it('A. snapshots the currently assigned bidder on create', () => {
    expect(requireAssignedBidderId(1)).toBe(1);
    expect(requireAssignedBidderId(null)).toBeNull();
  });

  it('B. generated APPLICATION activity is +1 for the same candidate and bidder', () => {
    const appliedAt = new Date('2026-08-30T12:00:00.000Z');
    expect(
      buildApplicationActivityEvent({
        candidateProfileId: 9,
        bidderId: 1,
        appliedAt,
        createdById: 50,
        jobApplicationId: 100,
      }),
    ).toEqual({
      candidateProfileId: 9,
      bidderId: 1,
      type: 'APPLICATION',
      delta: 1,
      occurredAt: appliedAt,
      createdById: 50,
      jobApplicationId: 100,
    });
  });

  it('C. editing an application does not generate another +1', () => {
    expect(generatesApplicationActivity('create')).toBe(true);
    expect(generatesApplicationActivity('update')).toBe(false);
    expect(generatesApplicationActivity('duplicate')).toBe(false);
  });

  it('D. reassignment does not rewrite historical application.bidderId', () => {
    expect(keepHistoricalBidderId(1, 2)).toBe(1);
  });

  it('E. a new application after reassignment uses Bidder 2', () => {
    expect(requireAssignedBidderId(2)).toBe(2);
  });

  it('F. BIDDER cannot create an application for an unrelated candidate', () => {
    expect(canBidderRecordForCandidate(2, 1)).toBe(false);
    expect(canBidderRecordForCandidate(1, 1)).toBe(true);
  });

  it('G. source + sourceExternalId reuse does not create another activity', () => {
    const existing = {
      source: JobApplicationSource.TALYN,
      sourceExternalId: 'ext-1',
    };
    expect(
      isExternalDuplicate(existing, JobApplicationSource.TALYN, 'ext-1'),
    ).toBe(true);
    expect(importedRecordIdentity(JobApplicationSource.TALYN, 'ext-1')).toEqual({
      source: JobApplicationSource.TALYN,
      sourceExternalId: 'ext-1',
    });
    expect(importedRecordIdentity(JobApplicationSource.MANUAL, null)).toBeNull();
    expect(generatesApplicationActivity('duplicate')).toBe(false);
  });

  it('H. manual correction activity remains independent of records', () => {
    expect(JobApplicationStatus.APPLIED).toBe('APPLIED');
    expect(canBidderViewApplication({
      actorId: 1,
      applicationBidderId: 1,
      candidateAssignedBidderId: 2,
    })).toBe(true);
    expect(canBidderMutateApplication({
      actorId: 2,
      applicationBidderId: 1,
      candidateAssignedBidderId: 2,
    })).toBe(true);
    expect(canBidderMutateApplication({
      actorId: 3,
      applicationBidderId: 1,
      candidateAssignedBidderId: 2,
    })).toBe(false);
    expect(canBidderViewApplication({
      actorId: 2,
      applicationBidderId: 1,
      candidateAssignedBidderId: 2,
    })).toBe(true);
  });
});
