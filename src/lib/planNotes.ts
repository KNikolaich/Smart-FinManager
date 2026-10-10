import type { PlanNote, PlanNotesPayload } from '../types';
import { referencedImageIds } from './markdownImages';

const DEFAULT_NOTE = {
  id: 'note-1',
  title: 'Моя заметка',
  content: '',
};

function normalizeNoteImages(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const entries = Object.entries(raw as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].startsWith('data:image/'));
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/** Drops pictures that the note's text no longer references. */
export function pruneNoteImages(note: PlanNote): PlanNote {
  if (!note.images) return note;
  const used = referencedImageIds(note.content);
  const kept = Object.entries(note.images).filter(([id]) => used.has(id));
  const { images: _images, ...rest } = note;
  return kept.length ? { ...rest, images: Object.fromEntries(kept) } : rest;
}

export function normalizePlanNotes(raw: unknown): PlanNotesPayload {
  const value = (
    raw &&
    typeof raw === 'object' &&
    'comment' in raw
  ) ? (raw as { comment: unknown }).comment : raw;

  if (
    value &&
    typeof value === 'object' &&
    'version' in value &&
    value.version === 1 &&
    'notes' in value &&
    Array.isArray(value.notes)
  ) {
    const notes = value.notes.map((note: unknown, index: number) => {
      const candidate = note && typeof note === 'object'
        ? note as Record<string, unknown>
        : {};
      const images = normalizeNoteImages(candidate.images);
      return {
        id: String(candidate.id || `note-${index + 1}`),
        title: String(candidate.title || `Заметка ${index + 1}`),
        content: String(candidate.content || ''),
        ...(images ? { images } : {}),
      };
    });
    const safeNotes = notes.length ? notes : [{ ...DEFAULT_NOTE }];
    const requestedActiveId = 'activeNoteId' in value ? String(value.activeNoteId) : '';
    const activeNoteId = safeNotes.some(note => note.id === requestedActiveId)
      ? requestedActiveId
      : safeNotes[0].id;

    return { version: 1, activeNoteId, notes: safeNotes };
  }

  return {
    version: 1,
    activeNoteId: DEFAULT_NOTE.id,
    notes: [{
      ...DEFAULT_NOTE,
      content: typeof value === 'string' ? value : '',
    }],
  };
}