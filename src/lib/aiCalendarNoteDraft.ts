import type { CalendarNoteDraft } from '../types';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return value.trim();
}

function getLocalTodayKey(): string {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}-${month}-${day}`;
}

export function normalizeAICalendarNoteDraft(value: unknown): CalendarNoteDraft {
  const data = asRecord(value);
  const rawText = [data.text, data.note, data.description].find(
    item => typeof item === 'string' && item.trim(),
  );

  return {
    date: normalizeDate(data.date) || getLocalTodayKey(),
    text: typeof rawText === 'string' ? rawText.trim().slice(0, 4000) : '',
  };
}