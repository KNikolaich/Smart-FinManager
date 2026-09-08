import type { PlanNotesPayload } from '../types';

const DEFAULT_NOTE = {
  id: 'note-1',
  title: 'Моя заметка',
  content: '',
};

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
      return {
        id: String(candidate.id || `note-${index + 1}`),
        title: String(candidate.title || `Заметка ${index + 1}`),
        content: String(candidate.content || ''),
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