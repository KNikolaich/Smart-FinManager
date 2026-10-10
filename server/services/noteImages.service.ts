import { prisma } from "../prisma";

export const NOTE_IMAGE_ID = /^[A-Za-z0-9_-]{3,64}$/;
export const MAX_NOTE_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_NOTE_IMAGES_PER_USER = 500;
/** Pictures younger than this are never pruned: the note that uses one may not be saved yet. */
const PRUNE_GRACE_MS = 60 * 60 * 1000;

export class NoteImageError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "NoteImageError";
  }
}

function detectMime(bytes: Buffer): string | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length > 7 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length > 5 && /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString("latin1"))) return "image/gif";
  if (bytes.length > 11 && bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

/** Decodes a `data:image/...;base64,` URL and checks that the bytes really are a picture. */
export function decodeImageDataUrl(dataUrl: string): { bytes: Buffer; mime: string } {
  const match = /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) throw new NoteImageError("Поддерживаются только PNG, JPEG, GIF и WebP");
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length === 0) throw new NoteImageError("Пустая картинка");
  if (bytes.length > MAX_NOTE_IMAGE_BYTES) throw new NoteImageError("Картинка слишком большая (максимум 3 МБ)", 413);
  const mime = detectMime(bytes);
  if (!mime) throw new NoteImageError("Файл не похож на картинку");
  return { bytes, mime };
}

export async function saveNoteImage(userId: string, id: string, dataUrl: string) {
  if (!NOTE_IMAGE_ID.test(id)) throw new NoteImageError("Некорректный идентификатор картинки");
  const { bytes, mime } = decodeImageDataUrl(dataUrl);
  const existing = await prisma.noteImage.findUnique({
    where: { userId_id: { userId, id } },
    select: { id: true },
  });
  if (!existing && (await prisma.noteImage.count({ where: { userId } })) >= MAX_NOTE_IMAGES_PER_USER) {
    throw new NoteImageError("Слишком много картинок в заметках", 409);
  }
  const data = { mime, data: bytes, size: bytes.length };
  await prisma.noteImage.upsert({
    where: { userId_id: { userId, id } },
    create: { userId, id, ...data },
    update: data,
  });
  return { id, size: bytes.length };
}

export function getNoteImage(userId: string, id: string) {
  if (!NOTE_IMAGE_ID.test(id)) return Promise.resolve(null);
  return prisma.noteImage.findUnique({ where: { userId_id: { userId, id } } });
}

/** Ids of pictures a saved notes payload still refers to, or null when it has no notes to read. */
export function referencedNoteImageIds(payload: unknown): Set<string> | null {
  const value = payload && typeof payload === "object" && "comment" in payload
    ? (payload as { comment: unknown }).comment
    : payload;
  if (!value || typeof value !== "object" || !Array.isArray((value as { notes?: unknown }).notes)) return null;
  const ids = new Set<string>();
  for (const note of (value as { notes: unknown[] }).notes) {
    const content = note && typeof note === "object" ? (note as { content?: unknown }).content : undefined;
    if (typeof content !== "string") continue;
    for (const match of content.matchAll(/!\[[^\]\n]*\]\(img:([^)\s]+)/g)) ids.add(match[1]);
  }
  return ids;
}

/** Deletes pictures that no note refers to any more (except fresh uploads). */
export async function pruneUnreferencedNoteImages(userId: string, notesPayload: unknown, now = new Date()) {
  const used = referencedNoteImageIds(notesPayload);
  if (!used) return 0;
  const stored = await prisma.noteImage.findMany({
    where: { userId, createdAt: { lt: new Date(now.getTime() - PRUNE_GRACE_MS) } },
    select: { id: true },
  });
  const unused = stored.map(image => image.id).filter(id => !used.has(id));
  if (unused.length === 0) return 0;
  const result = await prisma.noteImage.deleteMany({ where: { userId, id: { in: unused } } });
  return result.count;
}
