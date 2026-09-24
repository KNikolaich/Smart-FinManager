import type { Account, Category, PlannedPaymentDraft, PlannedPaymentRecurrence } from '../types';

const RECURRENCES: PlannedPaymentRecurrence[] = [
  'none',
  'weekly',
  'biweekly',
  'weekdays',
  'monthly',
  'quarterly',
  'yearly',
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asText(value: unknown, maxLength = 200): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim().slice(0, maxLength);
  return text || undefined;
}

function normalizeLookupValue(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase() : '';
}

function normalizeDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? value.trim()
    : undefined;
}

function findUniqueAccount(
  references: string[],
  accounts: Account[],
): Account | undefined {
  const normalizedReferences = references.map(normalizeLookupValue).filter(Boolean);
  if (normalizedReferences.length === 0) return undefined;

  const matches = accounts.filter(account => {
    const labels = [
      account.id,
      account.name,
      ...(account.aliases || '').split(','),
    ].map(normalizeLookupValue);
    return normalizedReferences.some(reference => labels.includes(reference));
  });

  return matches.length === 1 ? matches[0] : undefined;
}

function findUniqueCategory(
  references: string[],
  transactionType: 'expense' | 'income',
  categories: Category[],
): Category | undefined {
  const normalizedReferences = references.map(normalizeLookupValue).filter(Boolean);
  if (normalizedReferences.length === 0) return undefined;

  const matches = categories.filter(category =>
    category.type === transactionType &&
    normalizedReferences.some(reference =>
      reference === normalizeLookupValue(category.id) ||
      reference === normalizeLookupValue(category.name),
    ),
  );

  return matches.length === 1 ? matches[0] : undefined;
}

export function normalizeAICalendarPlanDraft(
  value: unknown,
  accounts: Account[],
  categories: Category[],
): PlannedPaymentDraft {
  const data = asRecord(value);
  const transactionType = data.transactionType === 'income' || data.type === 'income'
    ? 'income'
    : 'expense';
  const accountReferences = [asText(data.accountId), asText(data.accountName)].filter(
    (reference): reference is string => Boolean(reference),
  );
  const categoryReferences = [asText(data.categoryId), asText(data.categoryName)].filter(
    (reference): reference is string => Boolean(reference),
  );
  const account = findUniqueAccount(accountReferences, accounts);
  const category = findUniqueCategory(categoryReferences, transactionType, categories);
  const rawAmount = Number(data.amount);
  const amount = Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : 0;
  const recurrence = RECURRENCES.includes(data.recurrence as PlannedPaymentRecurrence)
    ? data.recurrence as PlannedPaymentRecurrence
    : 'none';
  const weekdays = Array.isArray(data.weekdays)
    ? [...new Set(data.weekdays.map(Number).filter(day => Number.isInteger(day) && day >= 1 && day <= 7))]
    : undefined;
  const time = asText(data.time, 5);
  const validTime = time && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : undefined;
  const note = asText(data.note, 4000);

  const draft: PlannedPaymentDraft = {
    title: asText(data.title) || asText(data.name) || '',
    amount,
    transactionType,
    recurrence,
  };

  const date = normalizeDate(data.date);
  if (date) draft.date = date;
  if (note) draft.note = note;
  if (validTime) draft.time = validTime;
  if (weekdays?.length) draft.weekdays = weekdays;
  if (accountReferences.length > 0) draft.accountId = account?.id || '';
  if (categoryReferences.length > 0) draft.categoryId = category?.id || '';

  return draft;
}