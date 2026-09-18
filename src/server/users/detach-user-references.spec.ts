import { EntityManager } from 'typeorm';

import { ActivityEvent } from '../activity/activity-event.entity';
import { CalendarAccount } from '../calendar/calendar-account.entity';
import { DailySubmission } from '../daily-submissions/daily-submission.entity';
import { DailySubmissionBidder } from '../daily-submissions/daily-submission-bidder.entity';
import { Interview } from '../interviews/interview.entity';
import { WeeklyInvoice } from '../weekly-invoices/weekly-invoice.entity';
import {
  detachUserReferences,
  isTransientDbError,
} from './detach-user-references';

describe('detachUserReferences', () => {
  it('treats dropped and timed-out connections as transient', () => {
    expect(isTransientDbError(new Error('Connection terminated unexpectedly'))).toBe(
      true,
    );
    expect(isTransientDbError({ code: '57014', message: 'canceling statement' })).toBe(
      true,
    );
    expect(isTransientDbError(new Error('duplicate key'))).toBe(false);
  });

  it('clears calendar assignment and manager-owned rows before delete', async () => {
    const update = jest.fn();
    const del = jest.fn();
    const query = jest.fn();
    const manager = { update, delete: del, query } as unknown as EntityManager;

    await detachUserReferences(manager, 13, 2);

    expect(update).toHaveBeenCalledWith(
      CalendarAccount,
      { assignedBidderId: 13 },
      { assignedBidderId: null },
    );
    expect(update).toHaveBeenCalledWith(
      Interview,
      { bidderId: 13 },
      { bidderId: null },
    );
    expect(update).toHaveBeenCalledWith(
      ActivityEvent,
      { bidderId: 13 },
      { bidderId: null },
    );
    expect(del).toHaveBeenCalledWith(DailySubmissionBidder, { bidderId: 13 });
    expect(del).toHaveBeenCalledWith(DailySubmission, { managerId: 13 });
    expect(del).toHaveBeenCalledWith(WeeklyInvoice, { managerId: 13 });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE daily_submission'),
      [2, 13],
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE weekly_invoice'),
      [2, 13],
    );
  });
});
