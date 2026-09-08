import { describe, expect, it } from 'vitest';
import { dateFromKey, formatTransactionDateHeading, getRelativeDateLabel } from './dateLabels';

describe('transaction date labels', () => {
  const now = dateFromKey('2026-09-08');

  it('labels nearby past and future dates', () => {
    expect(getRelativeDateLabel(dateFromKey('2026-09-08'), now)).toBe('сегодня');
    expect(getRelativeDateLabel(dateFromKey('2026-09-07'), now)).toBe('вчера');
    expect(getRelativeDateLabel(dateFromKey('2026-09-06'), now)).toBe('позавчера');
    expect(getRelativeDateLabel(dateFromKey('2026-09-09'), now)).toBe('завтра');
  });

  it('labels weeks and months in both directions', () => {
    expect(getRelativeDateLabel(dateFromKey('2026-08-25'), now)).toBe('2 нед. назад');
    expect(getRelativeDateLabel(dateFromKey('2026-08-08'), now)).toBe('1 мес. назад');
    expect(getRelativeDateLabel(dateFromKey('2026-09-22'), now)).toBe('через 2 нед.');
    expect(getRelativeDateLabel(dateFromKey('2026-10-08'), now)).toBe('через 1 мес.');
  });

  it('formats the calendar date and weekday in Russian', () => {
    expect(formatTransactionDateHeading('2026-09-08', now)).toEqual({
      date: '08 сентября',
      weekday: 'вт',
      relative: 'сегодня',
    });
  });
});