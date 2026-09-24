import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeAICalendarNoteDraft } from './aiCalendarNoteDraft';

describe('normalizeAICalendarNoteDraft', () => {
  afterEach(() => vi.useRealTimers());

  it('trims note text and accepts only a real calendar date', () => {
    expect(normalizeAICalendarNoteDraft({
      date: '2026-10-02',
      text: '  вернет. дал в долг Алехе 2000 с карты спб в буфер  ',
    })).toEqual({
      date: '2026-10-02',
      text: 'вернет. дал в долг Алехе 2000 с карты спб в буфер',
    });
  });

  it('uses local today and an empty editable note for invalid model fields', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 24, 12));

    expect(normalizeAICalendarNoteDraft({
      date: '2026-02-30',
      text: 123,
    })).toEqual({
      date: '2026-09-24',
      text: '',
    });

  });
});