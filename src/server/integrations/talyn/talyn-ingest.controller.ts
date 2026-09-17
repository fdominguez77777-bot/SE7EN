import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { TalynBulkSyncDto, TalynSyncDto } from '../../job-applications/dto/talyn-sync.dto';
import { TalynSyncService } from '../../job-applications/talyn-sync.service';
import { TalynApiKeyGuard } from './talyn-api-key.guard';

@ApiTags('talyn-sync')
@ApiSecurity('talyn-ingest')
@UseGuards(TalynApiKeyGuard)
@Controller('integrations/talyn')
export class TalynIngestController {
  private readonly logger = new Logger(TalynIngestController.name);

  constructor(private readonly talynSync: TalynSyncService) {}

  @Post('sync')
  @ApiOperation({ summary: 'Synchronize one Talyn application' })
  async syncOne(@Body() dto: TalynSyncDto) {
    const result = await this.talynSync.syncOne(dto, null);
    return {
      created: result.status === 'CREATED',
      status: result.status,
      application: result.application,
    };
  }

  @Post('sync/bulk')
  @ApiOperation({ summary: 'Synchronize up to 100 Talyn applications' })
  async syncBulk(@Body() dto: TalynBulkSyncDto) {
    return this.talynSync.syncBulk(dto, null);
  }

  @Post('sync/validate')
  @ApiOperation({ summary: 'Validate a Talyn payload without writing records' })
  validate(@Body() dto: TalynSyncDto) {
    return this.talynSync.validate(dto);
  }
}
