import { describe, expect, it } from 'vitest';
import { normalizePlanNotes, pruneNoteImages } from './planNotes';

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
describe('note pictures', () => {
  it('keeps pictures of a note and drops values that are not pictures', () => {
    const payload = normalizePlanNotes({
      version: 1,
      activeNoteId: 'n',
      notes: [{ id: 'n', title: 'С картинкой', content: '![](img:a)', images: { a: 'data:image/jpeg;base64,AA', b: 'javascript:alert(1)', c: 5 } }],
    });
    expect(payload.notes[0].images).toEqual({ a: 'data:image/jpeg;base64,AA' });
  });

  it('leaves old notes without the images field', () => {
    const payload = normalizePlanNotes({ version: 1, activeNoteId: 'n', notes: [{ id: 'n', title: 'Старая', content: 'Текст' }] });
    expect(payload.notes[0]).toEqual({ id: 'n', title: 'Старая', content: 'Текст' });
  });

  it('prunes pictures that the text no longer references', () => {
    expect(pruneNoteImages({
      id: 'n', title: 't', content: 'текст ![x](img:keep "right")',
      images: { keep: 'data:image/png;base64,A', gone: 'data:image/png;base64,B' },
    }).images).toEqual({ keep: 'data:image/png;base64,A' });
    expect(pruneNoteImages({ id: 'n', title: 't', content: 'без картинок', images: { gone: 'data:image/png;base64,B' } }))
      .toEqual({ id: 'n', title: 't', content: 'без картинок' });
  });
});
