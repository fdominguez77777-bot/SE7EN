import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';

import { PhaseAJobOps1769800000000 } from './migrations/1769800000000-PhaseAJobOps';
import { Phase4Procurement1767129600000 } from './migrations/1767129600000-Phase4Procurement';
import { CandidateAssignedBidder1770000000000 } from './migrations/1770000000000-CandidateAssignedBidder';
import { ActivityAttributedBidder1770100000000 } from './migrations/1770100000000-ActivityAttributedBidder';
import { JobApplication1770200000000 } from './migrations/1770200000000-JobApplication';
import { InterviewApplicationLink1770300000000 } from './migrations/1770300000000-InterviewApplicationLink';
import { NullableApplicationCreatedBy1770400000000 } from './migrations/1770400000000-NullableApplicationCreatedBy';
import { Compensation1770500000000 } from './migrations/1770500000000-Compensation';
import { BidderIndividualCompensationRate1770600000000 } from './migrations/1770600000000-BidderIndividualCompensationRate';
import { UserIsActive1770700000000 } from './migrations/1770700000000-UserIsActive';
import { DailySubmission1770800000000 } from './migrations/1770800000000-DailySubmission';
import { WeeklyInvoice1770900000000 } from './migrations/1770900000000-WeeklyInvoice';
import { DailySubmissionUnread1771000000000 } from './migrations/1771000000000-DailySubmissionUnread';
import { UserAvatar1771100000000 } from './migrations/1771100000000-UserAvatar';
import { NullableApplicationBidder1771200000000 } from './migrations/1771200000000-NullableApplicationBidder';
import { TalynApplicationId1771300000000 } from './migrations/1771300000000-TalynApplicationId';
import { JiracodersApplicationStatus1771400000000 } from './migrations/1771400000000-JiracodersApplicationStatus';
import { DropJiracodersApplicationStatus1771410000000 } from './migrations/1771410000000-DropJiracodersApplicationStatus';
import { CalendarIntegration1771500000000 } from './migrations/1771500000000-CalendarIntegration';
import { CalendarAssignedBidder1771600000000 } from './migrations/1771600000000-CalendarAssignedBidder';

config({ path: resolve(process.cwd(), '.env') });

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  migrations: [
    Phase4Procurement1767129600000,
    PhaseAJobOps1769800000000,
    CandidateAssignedBidder1770000000000,
    ActivityAttributedBidder1770100000000,
    JobApplication1770200000000,
    InterviewApplicationLink1770300000000,
    NullableApplicationCreatedBy1770400000000,
    Compensation1770500000000,
    BidderIndividualCompensationRate1770600000000,
    UserIsActive1770700000000,
    DailySubmission1770800000000,
    WeeklyInvoice1770900000000,
    DailySubmissionUnread1771000000000,
    UserAvatar1771100000000,
    NullableApplicationBidder1771200000000,
    TalynApplicationId1771300000000,
    JiracodersApplicationStatus1771400000000,
    DropJiracodersApplicationStatus1771410000000,
    CalendarIntegration1771500000000,
    CalendarAssignedBidder1771600000000,
  ],
  migrationsTableName: 'migrations',
});
