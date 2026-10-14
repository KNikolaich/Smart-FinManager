import { describe, expect, it } from 'vitest';
import { avatarCrop, AVATAR_SIZE, isImageAvatar } from './avatar';
import { importBatchSchema, updateProfileSchema } from '../../validation';

describe('avatarCrop', () => {
  it('cuts a portrait phone photo to its middle square and shrinks it', () => {
    expect(avatarCrop(3024, 4032)).toEqual({ sx: 0, sy: 504, side: 3024, output: AVATAR_SIZE });
  });

  it('cuts a landscape photo to its middle square', () => {
    expect(avatarCrop(1920, 1080)).toEqual({ sx: 420, sy: 0, side: 1080, output: AVATAR_SIZE });
  });

  it('keeps a small picture at its own size instead of blowing it up', () => {
    expect(avatarCrop(48, 48)).toEqual({ sx: 0, sy: 0, side: 48, output: 48 });
    expect(avatarCrop(100, 60)).toEqual({ sx: 20, sy: 0, side: 60, output: 60 });
  });
});

describe('isImageAvatar', () => {
  it('tells pictures from emoji', () => {
    expect(isImageAvatar('data:image/webp;base64,AAAA')).toBe(true);
    expect(isImageAvatar('https://example.com/me.png')).toBe(true);
    expect(isImageAvatar('👩')).toBe(false);
    expect(isImageAvatar('')).toBe(false);
    expect(isImageAvatar(null)).toBe(false);
  });
});

describe('profile avatar validation', () => {
  const bigPicture = `data:image/webp;base64,${'A'.repeat(60_000)}`;

  it('accepts an uploaded picture, an emoji, a link and clearing', () => {
    for (const photoURL of [bigPicture, 'data:image/jpeg;base64,/9j/4AAQ==', '👩‍🦰', 'https://example.com/a.png', null, '']) {
      expect(updateProfileSchema.safeParse({ photoURL }).success).toBe(true);
    }
  });

  it('rejects SVG, broken data and oversized pictures', () => {
    for (const photoURL of [
      'data:image/svg+xml;base64,PHN2Zz4=',
      'data:text/html;base64,PGI+',
      'data:image/png;base64,<script>',
      `data:image/png;base64,${'A'.repeat(500_000)}`,
      'x'.repeat(3000),
    ]) {
      expect(updateProfileSchema.safeParse({ photoURL }).success).toBe(false);
    }
  });

  it('lets a backup with an uploaded avatar be imported', () => {
    const result = importBatchSchema.shape.profile.safeParse([{ displayName: 'Анна', photoURL: bigPicture }]);
    expect(result.success).toBe(true);
  });
});
