import { describe, expect, it } from 'vitest';
import { normalizeTransactionDate } from './transactionDate';

describe('normalizeTransactionDate', () => {
  const fallback = new Date('2026-09-07T10:00:00.000Z');

  it('keeps a valid AI timestamp, including future dates', () => {
    expect(normalizeTransactionDate('2026-10-15T09:30:00+03:00', fallback))
      .toBe('2026-10-15T06:30:00.000Z');
  });

  it('preserves the selected local calendar day for date-only values', () => {
    const result = new Date(normalizeTransactionDate('2026-09-05', fallback));

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(8);
    expect(result.getDate()).toBe(5);
  });

  it('falls back to now when AI returns no date or an invalid date', () => {
    expect(normalizeTransactionDate(undefined, fallback)).toBe(fallback.toISOString());
    expect(normalizeTransactionDate('2026-02-31', fallback)).toBe(fallback.toISOString());
  });
});