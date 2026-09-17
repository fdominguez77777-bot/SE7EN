import {
  applicationStatusAfterInterviewCreate,
  canBidderCreateLinkedInterview,
  canBidderViewInterview,
  deriveInterviewFromApplication,
  InterviewMethod,
  InterviewStatus,
  isScheduledUpcoming,
  keepHistoricalInterviewBidderId,
  migratedInterviewStatus,
  shouldPromoteApplicationToInterviewing,
  snapshotInterviewBidderId,
} from './interview.rules';

describe('interview rules', () => {
  it('A/B. linked interviews store the application and snapshot company/role', () => {
    expect(
      deriveInterviewFromApplication({
        candidateProfileId: 9,
        companyName: 'Acme Corp',
        jobTitle: 'Senior Backend Engineer',
        bidderId: 1,
      }),
    ).toEqual({
      candidateProfileId: 9,
      company: 'Acme Corp',
      jobTitle: 'Senior Backend Engineer',
      bidderId: 1,
    });
  });

  it('C. APPLIED applications promote to INTERVIEWING on first interview', () => {
    expect(shouldPromoteApplicationToInterviewing('APPLIED')).toBe(true);
    expect(applicationStatusAfterInterviewCreate('APPLIED')).toBe('INTERVIEWING');
  });

  it('D. OFFER and other terminal statuses are not downgraded', () => {
    expect(applicationStatusAfterInterviewCreate('OFFER')).toBe('OFFER');
    expect(applicationStatusAfterInterviewCreate('REJECTED')).toBe('REJECTED');
    expect(applicationStatusAfterInterviewCreate('WITHDRAWN')).toBe('WITHDRAWN');
    expect(applicationStatusAfterInterviewCreate('INTERVIEWING')).toBe(
      'INTERVIEWING',
    );
  });

  it('E. BIDDER cannot link an interview to an unrelated application', () => {
    expect(
      canBidderCreateLinkedInterview({
        actorId: 1,
        applicationBidderId: 2,
        candidateAssignedBidderId: 3,
      }),
    ).toBe(false);
    expect(
      canBidderCreateLinkedInterview({
        actorId: 1,
        applicationBidderId: 1,
        candidateAssignedBidderId: 2,
      }),
    ).toBe(true);
  });

  it('F. Scheduled future interviews are upcoming', () => {
    expect(
      isScheduledUpcoming({
        status: InterviewStatus.SCHEDULED,
        startsAt: new Date(Date.now() + 60_000),
      }),
    ).toBe(true);
  });

  it('G. Cancelled future interviews are not upcoming', () => {
    expect(
      isScheduledUpcoming({
        status: InterviewStatus.CANCELLED,
        startsAt: new Date(Date.now() + 60_000),
      }),
    ).toBe(false);
  });

  it('H. Completed interviews are not upcoming', () => {
    expect(
      isScheduledUpcoming({
        status: InterviewStatus.COMPLETED,
        startsAt: new Date(Date.now() + 60_000),
      }),
    ).toBe(false);
    expect(
      isScheduledUpcoming({
        status: InterviewStatus.NO_SHOW,
        startsAt: new Date(Date.now() + 60_000),
      }),
    ).toBe(false);
  });

  it('I. reassignment does not rewrite interview bidder attribution', () => {
    expect(keepHistoricalInterviewBidderId(1, 2)).toBe(1);
    expect(
      snapshotInterviewBidderId({
        applicationBidderId: 1,
        assignedBidderId: 2,
      }),
    ).toBe(1);
    expect(
      snapshotInterviewBidderId({
        applicationBidderId: null,
        assignedBidderId: 2,
      }),
    ).toBe(2);
    expect(migratedInterviewStatus(new Date('2020-01-01'))).toBe(
      InterviewStatus.COMPLETED,
    );
    expect(InterviewMethod.VIDEO).toBe('VIDEO');
    expect(
      canBidderViewInterview({
        actorId: 1,
        interviewBidderId: 1,
        candidateAssignedBidderId: 2,
      }),
    ).toBe(true);
  });
});
