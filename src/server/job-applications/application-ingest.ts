import { JobApplicationSource } from './job-application.rules';

export const TALYN_BULK_LIMIT = 100;

export const TALYN_INGEST_HEADER = 'x-talyn-api-key';

export function assertTalynBulkSize(count: number) {
  if (count > TALYN_BULK_LIMIT) {
    return `Bulk ingest is limited to ${TALYN_BULK_LIMIT} applications per request`;
  }
  return null;
}

export function resolveTalynApplicationId(dto: {
  talynApplicationId?: string | null;
  externalId?: string | null;
}) {
  return (dto.talynApplicationId ?? dto.externalId ?? '').trim();
}

export function talynIdentity(externalId: string) {
  const talynApplicationId = externalId.trim();
  return {
    source: JobApplicationSource.TALYN,
    sourceExternalId: talynApplicationId,
    talynApplicationId,
  };
}
