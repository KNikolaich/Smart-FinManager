import { differenceInCalendarDays, differenceInCalendarMonths, format } from 'date-fns';
import { ru } from 'date-fns/locale';

export function dateFromKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00`);
}

function plural(value: number, one: string, few: string, many: string) {
  const mod100 = value % 100;
  const mod10 = value % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function getRelativeDateLabel(date: Date, now: Date = new Date()): string {
  const daysAgo = differenceInCalendarDays(now, date);

  if (daysAgo === 0) return 'сегодня';
  if (daysAgo === 1) return 'вчера';
  if (daysAgo === 2) return 'позавчера';
  if (daysAgo === -1) return 'завтра';
  if (daysAgo === -2) return 'послезавтра';

  const monthsAgo = differenceInCalendarMonths(now, date);
  if (daysAgo >= 28 && monthsAgo > 0) {
    return `${monthsAgo} мес. назад`;
  }
  if (daysAgo <= -28 && monthsAgo < 0) {
    const monthsAhead = Math.abs(monthsAgo);
    return `через ${monthsAhead} мес.`;
  }

  if (daysAgo >= 7) {
    const weeks = Math.floor(daysAgo / 7);
    return `${weeks} нед. назад`;
  }
  if (daysAgo <= -7) {
    const weeks = Math.floor(Math.abs(daysAgo) / 7);
    return `через ${weeks} нед.`;
  }

  if (daysAgo > 0) {
    return `${daysAgo} ${plural(daysAgo, 'день', 'дня', 'дней')} назад`;
  }

  const daysAhead = Math.abs(daysAgo);
  return `через ${daysAhead} ${plural(daysAhead, 'день', 'дня', 'дней')}`;
}

export function formatTransactionDateHeading(dateKey: string, now: Date = new Date()) {
  const date = dateFromKey(dateKey);
  return {
    date: format(date, 'dd MMMM', { locale: ru }),
    weekday: format(date, 'EEEEEE', { locale: ru }),
    relative: getRelativeDateLabel(date, now),
  };
}