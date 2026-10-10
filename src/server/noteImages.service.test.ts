import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => {
  const rows: any[] = [];
  const key = (where: any) => where.userId_id;
  const noteImage = {
    findUnique: vi.fn(async ({ where }: any) =>
      rows.find(row => row.userId === key(where).userId && row.id === key(where).id) ?? null),
    count: vi.fn(async ({ where }: any) => rows.filter(row => row.userId === where.userId).length),
    upsert: vi.fn(async ({ where, create, update }: any) => {
      const existing = rows.find(row => row.userId === key(where).userId && row.id === key(where).id);
      if (existing) Object.assign(existing, update);
      else rows.push({ createdAt: new Date(), ...create });
    }),
    findMany: vi.fn(async ({ where }: any) =>
      rows.filter(row => row.userId === where.userId && row.createdAt < where.createdAt.lt)),
    deleteMany: vi.fn(async ({ where }: any) => {
      let count = 0;
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (rows[index].userId === where.userId && where.id.in.includes(rows[index].id)) {
          rows.splice(index, 1);
          count += 1;
        }
      }
      return { count };
    }),
  };
  return { rows, db: { noteImage } };
});

vi.mock("../../server/prisma", () => ({ prisma: fake.db }));

import {
  decodeImageDataUrl,
  getNoteImage,
  MAX_NOTE_IMAGES_PER_USER,
  NoteImageError,
  pruneUnreferencedNoteImages,
  referencedNoteImageIds,
  saveNoteImage,
} from "../../server/services/noteImages.service";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const pngUrl = `data:image/png;base64,${PNG.toString("base64")}`;

describe("note images", () => {
  beforeEach(() => {
    fake.rows.splice(0, fake.rows.length);
    vi.clearAllMocks();
  });

  it("accepts a real picture and stores its detected type", async () => {
    expect(await saveNoteImage("u1", "abc123", pngUrl)).toEqual({ id: "abc123", size: PNG.length });
    expect(fake.rows[0]).toMatchObject({ userId: "u1", id: "abc123", mime: "image/png", size: PNG.length });
  });

  it("rejects non-pictures, wrong declared types and bad ids", async () => {
    expect(() => decodeImageDataUrl("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toThrow(NoteImageError);
    expect(() => decodeImageDataUrl(`data:image/png;base64,${Buffer.from("<script>alert(1)</script>").toString("base64")}`))
      .toThrow("не похож на картинку");
    await expect(saveNoteImage("u1", "../x", pngUrl)).rejects.toThrow("идентификатор");
    await expect(saveNoteImage("u1", "ok", "data:text/html;base64,AAAA")).rejects.toThrow(NoteImageError);
  });

  it("keeps pictures of different users apart, even with the same id", async () => {
    await saveNoteImage("u1", "same", pngUrl);
    expect(await getNoteImage("u2", "same")).toBeNull();
    expect(await getNoteImage("u1", "same")).toMatchObject({ id: "same" });
  });

  it("limits how many pictures one user can keep, but still lets an existing one be replaced", async () => {
    for (let index = 0; index < MAX_NOTE_IMAGES_PER_USER; index += 1) {
      fake.rows.push({ userId: "u1", id: `img${index}`, createdAt: new Date() });
    }
    await expect(saveNoteImage("u1", "extra", pngUrl)).rejects.toMatchObject({ status: 409 });
    await expect(saveNoteImage("u1", "img1", pngUrl)).resolves.toBeTruthy();
  });

  it("reads picture ids from the notes payload", () => {
    const payload = { comment: { version: 1, notes: [{ content: "![](img:a1 \"right\") текст ![x](img:b2)" }, { content: "без" }] } };
    expect([...referencedNoteImageIds(payload)!]).toEqual(["a1", "b2"]);
    expect(referencedNoteImageIds({ comment: "старая строка" })).toBeNull();
  });

  it("prunes unused pictures but keeps fresh uploads and referenced ones", async () => {
    const old = new Date("2026-01-01T00:00:00Z");
    fake.rows.push(
      { userId: "u1", id: "used", createdAt: old },
      { userId: "u1", id: "gone", createdAt: old },
      { userId: "u1", id: "fresh", createdAt: new Date("2026-01-02T11:30:00Z") },
      { userId: "u2", id: "other", createdAt: old },
    );
    const removed = await pruneUnreferencedNoteImages(
      "u1",
      { comment: { notes: [{ content: "![](img:used)" }] } },
      new Date("2026-01-02T12:00:00Z"),
    );
    expect(removed).toBe(1);
    expect(fake.rows.map(row => row.id).sort()).toEqual(["fresh", "other", "used"]);
  });

  it("does nothing when the payload has no readable notes", async () => {
    fake.rows.push({ userId: "u1", id: "keep", createdAt: new Date("2020-01-01") });
    expect(await pruneUnreferencedNoteImages("u1", { comment: "legacy text" })).toBe(0);
    expect(fake.rows).toHaveLength(1);
  });
});
