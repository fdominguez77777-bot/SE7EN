export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export const AVATAR_FIELD = 'file';

export type ImageKind = {
  ext: 'jpg' | 'png' | 'webp';
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
};

export function detectImageKind(buffer: Buffer): ImageKind | null {
  if (buffer.length < 12) {
    return null;
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ext: 'png', mime: 'image/png' };
  }
  const riff = buffer.subarray(0, 4).toString('ascii');
  const webp = buffer.subarray(8, 12).toString('ascii');
  if (riff === 'RIFF' && webp === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

export function avatarPublicUrl(
  avatarPath: string | null | undefined,
): string | null {
  if (!avatarPath) {
    return null;
  }
  const key = avatarPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!key.startsWith('avatars/') || key.includes('..')) {
    return null;
  }
  return `/uploads/${key}`;
}
