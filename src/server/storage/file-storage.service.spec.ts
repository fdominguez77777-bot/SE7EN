import { BadRequestException } from '@nestjs/common';
import { resolve } from 'node:path';

import { FileStorageService } from './file-storage.service';

describe('FileStorageService', () => {
  const service = new FileStorageService({
    get: () => 'uploads',
  } as never);

  it('keeps keys inside the upload root', () => {
    const dest = service.resolveKey('avatars/1/photo.png');
    expect(dest.startsWith(resolve('uploads'))).toBe(true);
    expect(dest.endsWith(resolve('avatars', '1', 'photo.png').slice(-18)) || dest.includes('photo.png')).toBe(true);
  });

  it('rejects path traversal', () => {
    expect(() => service.resolveKey('../secret.txt')).toThrow(BadRequestException);
    expect(() => service.resolveKey('avatars/../../etc/passwd')).toThrow(
      BadRequestException,
    );
  });
});
