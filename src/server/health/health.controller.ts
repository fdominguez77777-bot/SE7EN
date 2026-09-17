import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Process and database health' })
  async check() {
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'ok',
        info: {
          database: { status: 'up' },
        },
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        info: {
          database: { status: 'down' },
        },
      });
    }
  }
}
