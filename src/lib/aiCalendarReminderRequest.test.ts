import { describe, expect, it } from 'vitest';
import { parseExplicitCalendarReminderRequest } from './aiCalendarReminderRequest';

const now = new Date(2026, 8, 24, 12);

describe('parseExplicitCalendarReminderRequest', () => {
  it('turns an explicit reminder in a plan into a calendar note without inventing an amount', () => {
    expect(
      parseExplicitCalendarReminderRequest(
        'создай напоминалку в плане, что 5 го числа Валера должен вернуть деньги',
        now,
      ),
    ).toEqual({
      date: '2026-10-05',
      text: 'Валера должен вернуть деньги',
    });
  });

  it('does not intercept compound money movement requests', () => {
    expect(
      parseExplicitCalendarReminderRequest(
        'дал в долг Алехе 2000 с карты СПб в Буфер, заметка, вернет 2го числа',
        now,
      ),
    ).toBeNull();
  });

  it('returns null when the reminder has no usable date or reminder text', () => {
    expect(parseExplicitCalendarReminderRequest('создай напоминалку Валере', now)).toBeNull();
    expect(parseExplicitCalendarReminderRequest('создай напоминалку на 5-го числа', now)).toBeNull();
  });

  it('uses the current month when that day is still upcoming', () => {
    expect(
      parseExplicitCalendarReminderRequest('напоминание на 30-е числа: оплатить', now),
    ).toEqual({
      date: '2026-09-30',
      text: 'оплатить',
    });
  });
});