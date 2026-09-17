import { Repository } from 'typeorm';

import { BidderProfile } from './bidder-profile.entity';

export async function assignedProfileIds(
  profiles: Repository<BidderProfile>,
  bidderUserId: number,
): Promise<number[]> {
  const rows = await profiles.find({
    where: { assignedBidderId: bidderUserId },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}
