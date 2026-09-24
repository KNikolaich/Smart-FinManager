import type { CalendarNoteDraft } from '../types';

const REMINDER_WORD = /(?:напомин|напомни|заметк)/iu;
const TRANSACTION_WORD = /(?:перевод|перевед|потратил|оплатил|получил|расход|доход|в\s+долг)/iu;
const DAY_ORDINAL = /(?<![\p{L}\p{N}])(\d{1,2})\s*[-‐‑‒–—]?\s*(?:го|е|ё|ое)(?:\s+числа?)?(?![\p{L}\p{N}])/giu;
const DAY_WITH_CHISLO = /(?<![\p{L}\p{N}])(\d{1,2})\s+(?:числа|число)(?![\p{L}\p{N}])/giu;
const DAY_EXPRESSION = /(?<![\p{L}\p{N}])\d{1,2}\s*[-‐‑‒–—]?\s*(?:го|е|ё|ое)(?:\s+числа?)?(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])\d{1,2}\s+(?:числа|число)(?![\p{L}\p{N}])/giu;
const WHAT_MARKER = /(?<![\p{L}])что(?![\p{L}])/iu;

function findDayExpression(text: string): { day: number; index: number; length: number } | null {
  for (const pattern of [DAY_ORDINAL, DAY_WITH_CHISLO]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const day = Number(match[1]);
      if (day >= 1 && day <= 31) {
        return { day, index: match.index, length: match[0].length };
      }
    }
  }

  return null;
}

function getNearestFutureDateWithDay(day: number, now: Date): string | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (let monthOffset = 0; monthOffset < 24; monthOffset += 1) {
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const lastDayOfMonth = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth() + 1, 0).getDate();
    if (day > lastDayOfMonth) continue;

    const candidate = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth(), day);
    if (candidate < today) continue;

    const year = candidate.getFullYear();
    const month = String(candidate.getMonth() + 1).padStart(2, '0');
    const date = String(candidate.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
  }

  return null;
}

/**
 * Deterministically handles clear, date-specific reminder requests without
 * letting the language model invent amounts or classify "in the plan" as a
 * monthly budget-plan mutation. Ambiguous or compound requests stay with AI.
 */
export function parseExplicitCalendarReminderRequest(
  text: string,
  now: Date = new Date(),
): CalendarNoteDraft | null {
  if (!REMINDER_WORD.test(text) || TRANSACTION_WORD.test(text)) return null;

  const dayExpression = findDayExpression(text);
  if (!dayExpression) return null;

  const whatMarker = WHAT_MARKER.exec(text);
  const bodyStart = whatMarker
    ? whatMarker.index + whatMarker[0].length
    : dayExpression.index + dayExpression.length;
  const rawBody = text
    .slice(bodyStart)
    .replace(DAY_EXPRESSION, ' ')
    .replace(/^[\s,.:;—–-]+|[\s,.:;—–-]+$/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();

  if (!rawBody) return null;

  const date = getNearestFutureDateWithDay(dayExpression.day, now);
  if (!date) return null;

  return { date, text: rawBody.slice(0, 4000) };
}