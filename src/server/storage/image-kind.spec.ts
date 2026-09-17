import { avatarPublicUrl, detectImageKind } from './image-kind';

describe('detectImageKind', () => {
  it('accepts JPEG magic bytes', () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    expect(detectImageKind(buffer)).toEqual({ ext: 'jpg', mime: 'image/jpeg' });
  });

  it('accepts PNG magic bytes', () => {
    const buffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
    ]);
    expect(detectImageKind(buffer)).toEqual({ ext: 'png', mime: 'image/png' });
  });

  it('accepts WEBP magic bytes', () => {
    const buffer = Buffer.from('RIFF....WEBP', 'ascii');
    expect(detectImageKind(buffer)?.ext).toBe('webp');
  });

  it('rejects SVG and empty payloads', () => {
    expect(detectImageKind(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(detectImageKind(Buffer.alloc(0))).toBeNull();
  });
});

describe('avatarPublicUrl', () => {
  it('maps a stored path to the public uploads URL', () => {
    expect(avatarPublicUrl('avatars/4/abc.png')).toBe('/uploads/avatars/4/abc.png');
  });

  it('rejects traversal', () => {
    expect(avatarPublicUrl('avatars/../secret.png')).toBeNull();
  });
});
