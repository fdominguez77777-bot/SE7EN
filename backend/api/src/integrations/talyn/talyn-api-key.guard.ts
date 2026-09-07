import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';

import { EnvironmentVariables } from '../../config/env.validation';
import { TALYN_INGEST_HEADER } from '../../job-applications/application-ingest';

@Injectable()
export class TalynApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  canActivate(context: ExecutionContext) {
    const expected = this.config.get('TALYN_INGEST_API_KEY', { infer: true })?.trim();
    if (!expected) {
      throw new ServiceUnavailableException(
        'Talyn ingestion is not configured on this server.',
      );
    }
    const request = context.switchToHttp().getRequest<{ headers: Record<string, unknown> }>();
    const raw = request.headers[TALYN_INGEST_HEADER];
    const provided = Array.isArray(raw) ? raw[0] : raw;
    if (typeof provided !== 'string' || !provided.trim()) {
      throw new UnauthorizedException('Invalid Talyn ingest key');
    }
    const a = createHash('sha256').update(expected).digest();
    const b = createHash('sha256').update(provided.trim()).digest();
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid Talyn ingest key');
    }
    return true;
  }
}
