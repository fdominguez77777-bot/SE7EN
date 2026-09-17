import { Module } from '@nestjs/common';

import { JobApplicationsModule } from '../../job-applications/job-applications.module';
import { TalynApiKeyGuard } from './talyn-api-key.guard';
import { TalynIngestController } from './talyn-ingest.controller';

@Module({
  imports: [JobApplicationsModule],
  controllers: [TalynIngestController],
  providers: [TalynApiKeyGuard],
})
export class TalynIngestModule {}
