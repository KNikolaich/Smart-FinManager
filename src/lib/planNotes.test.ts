import { describe, expect, it } from 'vitest';
import { normalizePlanNotes } from './planNotes';

describe('normalizePlanNotes', () => {
  it('opens a legacy string as one automatically named note', () => {
    expect(normalizePlanNotes('Старая заметка')).toEqual({
      version: 1,
      activeNoteId: 'note-1',
      notes: [{
        id: 'note-1',
        title: 'Моя заметка',
        content: 'Старая заметка',
      }],
    });
  });

  it('reads the wrapped API response in the new format', () => {
    expect(normalizePlanNotes({
      comment: {
        version: 1,
        activeNoteId: 'shopping',
        notes: [
          { id: 'ideas', title: 'Идеи', content: 'Текст' },
          { id: 'shopping', title: 'Покупки', content: '- Молоко' },
        ],
      },
    })).toMatchObject({
      activeNoteId: 'shopping',
      notes: [
        { id: 'ideas', title: 'Идеи', content: 'Текст' },
        { id: 'shopping', title: 'Покупки', content: '- Молоко' },
      ],
    });
  });

  it('repairs an empty or invalid collection into a usable note', () => {
    expect(normalizePlanNotes({
      version: 1,
      activeNoteId: 'missing',
      notes: [],
    }).notes).toEqual([{
      id: 'note-1',
      title: 'Моя заметка',
      content: '',
    }]);
  });
});