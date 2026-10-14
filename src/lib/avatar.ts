/** Side of the square picture stored as an avatar, in pixels (enough for 3× screens). */
export const AVATAR_SIZE = 256;

/** Largest file the picker accepts before shrinking (phone photos are 2–15 MB). */
export const MAX_AVATAR_FILE_BYTES = 30 * 1024 * 1024;

/** True when the stored avatar is a picture (uploaded data URL or a web link), not an emoji. */
export function isImageAvatar(value: string | null | undefined): value is string {
  return !!value && /^(data:image\/|https?:\/\/)/i.test(value.trim());
}

/**
 * Centered square crop of a picture and the size to draw it at: a large
 * photo is cut to its middle square and shrunk to {@link AVATAR_SIZE}; a small
 * picture keeps its own pixels so it is never blown up.
 */
export function avatarCrop(width: number, height: number, maxSide = AVATAR_SIZE) {
  const side = Math.max(1, Math.min(width, height));
  return {
    sx: Math.max(0, Math.round((width - side) / 2)),
    sy: Math.max(0, Math.round((height - side) / 2)),
    side,
    output: Math.max(1, Math.min(side, maxSide)),
  };
}

/**
 * Reads a picture file of any size and turns it into a small square data URL
 * for the profile: center-cropped, shrunk to at most {@link AVATAR_SIZE} px,
 * WebP (or JPEG where WebP is not supported). Transparency survives in WebP.
 */
export async function prepareAvatarFile(file: File): Promise<string> {
  if (file.type && !file.type.startsWith('image/')) throw new Error('Файл не похож на картинку');
  if (file.size > MAX_AVATAR_FILE_BYTES) throw new Error('Картинка слишком большая (больше 30 МБ)');
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Не удалось открыть картинку. Попробуйте JPG или PNG'));
      element.src = url;
    });
    // naturalWidth/Height already account for EXIF rotation of phone photos.
    const { sx, sy, side, output } = avatarCrop(image.naturalWidth || 1, image.naturalHeight || 1);
    const canvas = document.createElement('canvas');
    canvas.width = output;
    canvas.height = output;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Браузер не смог обработать картинку');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, sx, sy, side, side, 0, 0, output, output);
    const webp = canvas.toDataURL('image/webp', 0.85);
    if (webp.startsWith('data:image/webp')) return webp;
    // JPEG has no transparency: put the picture on white instead of black.
    const flat = document.createElement('canvas');
    flat.width = output;
    flat.height = output;
    const flatContext = flat.getContext('2d');
    if (!flatContext) return canvas.toDataURL('image/png');
    flatContext.fillStyle = '#ffffff';
    flatContext.fillRect(0, 0, output, output);
    flatContext.drawImage(canvas, 0, 0);
    return flat.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
