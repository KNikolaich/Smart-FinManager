import { describe, expect, it } from 'vitest';
import { getRateChange } from './currencyService';

describe('getRateChange', () => {
  it('returns null when there are fewer than two points', () => {
    expect(getRateChange([])).toBeNull();
    expect(getRateChange([{ date: '2026-08-01', rate: 90 }])).toBeNull();
  });

  it('calculates positive absolute and percentage changes', () => {
    expect(getRateChange([
      { date: '2026-08-01', rate: 100 },
      { date: '2026-08-30', rate: 110 },
    ])).toEqual({
      absolute: 10,
      percent: 10,
      direction: 'up',
    });
  });

  it('calculates negative changes and handles an unchanged rate', () => {
    expect(getRateChange([
      { date: '2026-08-01', rate: 100 },
      { date: '2026-08-30', rate: 90 },
    ])?.direction).toBe('down');
    expect(getRateChange([
      { date: '2026-08-01', rate: 100 },
      { date: '2026-08-30', rate: 100 },
    ])).toEqual({
      absolute: 0,
      percent: 0,
      direction: 'flat',
    });
  });

  it('does not divide by zero when the first rate is zero', () => {
    expect(getRateChange([
      { date: '2026-08-01', rate: 0 },
      { date: '2026-08-30', rate: 1 },
    ])).toEqual({
      absolute: 1,
      percent: null,
      direction: 'up',
    });
  });
});