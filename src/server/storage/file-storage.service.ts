import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import { EnvironmentVariables } from '../config/env.validation';

@Injectable()
export class FileStorageService {
  private readonly root: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.root = resolve(config.get('UPLOAD_DIR', { infer: true }) ?? 'uploads');
  }

  getRoot(): string {
    return this.root;
  }

  async put(relativeKey: string, body: Buffer): Promise<void> {
    const dest = this.resolveKey(relativeKey);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, body);
  }

  async delete(relativeKey: string | null | undefined): Promise<void> {
    if (!relativeKey) {
      return;
    }
    const dest = this.resolveKey(relativeKey);
    try {
      await unlink(dest);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        throw error;
      }
    }
  }

  resolveKey(relativeKey: string): string {
    const normalized = relativeKey.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized || normalized.includes('..') || normalized.includes('\0')) {
      throw new BadRequestException('Invalid storage key');
    }
    const dest = resolve(this.root, normalized);
    const rel = relative(this.root, dest);
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
      throw new BadRequestException('Invalid storage key');
    }
    return dest;
  }
}
