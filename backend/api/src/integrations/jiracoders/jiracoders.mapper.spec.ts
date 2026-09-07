import {
  mapApplicationDetails,
  mapApplicationListItem,
  mapBidderStat,
} from './jiracoders.mapper';

const listFixture = {
  id: 101,
  userId: 12,
  companyName: 'Globex',
  position: 'Node.js Engineer',
  source: 'LinkedIn',
  url: 'https://linkedin.com/jobs/view/123456',
  status: 'applied',
  outcome: 'ongoing',
  createdAt: '2026-03-06T14:30:00.000Z',
  user: {
    id: 12,
    name: 'Alex Chen',
    avatar: 'https://cdn.example.com/avatar/alex.jpg',
  },
  profile: { name: 'Backend Resume' },
  bidder: { name: 'Night Owl Bot' },
};

describe('jiracoders mapper', () => {
  it('maps a list row onto the applications table columns', () => {
    const bidders = [
      mapBidderStat({
        id: 5,
        name: 'Night Owl Bot',
        username: 'night-owl',
        isActive: true,
        applicationsCount: 34,
      })!,
    ];

    expect(mapApplicationListItem(listFixture, bidders)).toEqual({
      id: 101,
      companyName: 'Globex',
      jobTitle: 'Node.js Engineer',
      source: 'LinkedIn',
      status: 'applied',
      outcome: 'ongoing',
      appliedAt: '2026-03-06T14:30:00.000Z',
      jobUrl: 'https://linkedin.com/jobs/view/123456',
      candidateFullName: 'Alex Chen',
      candidateAvatarUrl: 'https://cdn.example.com/avatar/alex.jpg',
      profileName: 'Backend Resume',
      bidderId: 5,
      bidderName: 'Night Owl Bot',
    });
  });

  it('credits the local bidder id when names match, ignoring upstream bidder ids', () => {
    const mapped = mapApplicationListItem(
      { ...listFixture, bidder: { id: 9001, name: 'Yel' } },
      [{ id: 8, name: 'Yel', username: null, isActive: true, applicationsCount: 0 }],
    );
    expect(mapped?.bidderId).toBe(8);
    expect(mapped?.bidderName).toBe('Yel');
  });

  it('maps details fields used by the row panel', () => {
    const mapped = mapApplicationDetails({
      ...listFixture,
      jobDescription: 'Remote backend role using TypeScript and PostgreSQL.',
      resume: 'https://cdn.example.com/resumes/alex.pdf',
      note: null,
      profileId: 4,
      bidderId: 5,
      interviews: [{ id: 1 }],
    });

    expect(mapped?.jobDescriptionText).toContain('TypeScript');
    expect(mapped?.resumeUrl).toBe('https://cdn.example.com/resumes/alex.pdf');
    expect(mapped?.salary).toBeNull();
    expect(mapped?.expYears).toBeNull();
    expect(mapped?.statusHistory).toEqual([]);
    expect(mapped?.profileId).toBe(4);
    expect(mapped?.bidderId).toBeNull();
    expect(mapped?.interviewCount).toBe(1);
    expect(mapped?.profileWorkHistory).toEqual([]);
    expect(mapped?.profileEducation).toEqual([]);
  });

  it('pairs profile work history from the details payload', () => {
    const mapped = mapApplicationDetails({
      ...listFixture,
      profile: {
        name: 'Backend Resume',
        experience: JSON.stringify([
          {
            companyName: 'IBM',
            startDate: '2024-09',
            endDate: '',
            isPresent: true,
          },
        ]),
      },
    });

    expect(mapped?.profileWorkHistory).toEqual([
      {
        companyName: 'IBM',
        startDate: '2024-09',
        endDate: null,
        isPresent: true,
      },
    ]);
  });

  it('maps profile education from the details payload', () => {
    const mapped = mapApplicationDetails({
      ...listFixture,
      profile: {
        name: 'Backend Resume',
        education: JSON.stringify([
          {
            institutionName: 'University of Washington - Seattle',
            degree: "Bachelor's Degree",
            fromDate: '2010-09',
            toDate: '2014-06',
          },
        ]),
      },
    });

    expect(mapped?.profileEducation).toEqual([
      {
        degree: "Bachelor's Degree",
        institutionName: 'University of Washington - Seattle',
        startDate: '2010-09',
        endDate: '2014-06',
        isPresent: false,
      },
    ]);
  });

  it('drops rows without a positive id', () => {
    expect(mapApplicationListItem({ id: 0, companyName: 'Globex' })).toBeNull();
  });
});
