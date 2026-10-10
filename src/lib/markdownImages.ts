/** Ids of `img:` pictures that the markdown text still references. */
export function referencedImageIds(text: string): Set<string> {
  const ids = new Set<string>();
  for (const match of text.matchAll(/!\[[^\]\n]*\]\(img:([^)\s]+)/g)) ids.add(match[1]);
  return ids;
}

/** Longest side of a picture stored in a note, in pixels. */
const MAX_IMAGE_SIDE = 1280;

/**
 * Reads a picture file and shrinks it to at most {@link MAX_IMAGE_SIDE} px on
 * the longest side, so a phone photo does not grow every note save by
 * megabytes. PNG/GIF/WebP stay PNG (keeps transparency); photos become JPEG.
 */
export async function compressImageFile(file: File): Promise<string> {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('Файл не похож на картинку'));
    element.src = source;
  });
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
  const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return source;
  const keepsAlpha = /image\/(png|gif|webp)/.test(file.type);
  if (!keepsAlpha) {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(image, 0, 0, width, height);
  const compressed = canvas.toDataURL(keepsAlpha ? 'image/png' : 'image/jpeg', 0.8);
  // A small PNG can come out bigger after re-encoding; keep whichever is smaller.
  return compressed.length < source.length || scale < 1 ? compressed : source;
}

/** Markdown for an empty 3×3 table to start from. */
export const TABLE_TEMPLATE = [
  '| Столбец 1 | Столбец 2 | Столбец 3 |',
  '| --- | --- | --- |',
  '|  |  |  |',
  '|  |  |  |',
].join('\n');
