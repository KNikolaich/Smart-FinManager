const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function normalizeTransactionDate(
  value: unknown,
  fallback: Date = new Date()
): string {
  if (typeof value !== 'string' && !(value instanceof Date)) {
    return fallback.toISOString();
  }

  const rawValue = value instanceof Date ? value.toISOString() : value.trim();
  const dateOnlyMatch = rawValue.match(DATE_ONLY_PATTERN);

  if (dateOnlyMatch) {
    const [, yearText, monthText, dayText] = dateOnlyMatch;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    // Noon in the user's local timezone avoids an accidental shift to the
    // previous/next calendar day when the timestamp is formatted later.
    const localNoon = new Date(year, month - 1, day, 12, 0, 0, 0);

    if (
      localNoon.getFullYear() === year &&
      localNoon.getMonth() === month - 1 &&
      localNoon.getDate() === day
    ) {
      return localNoon.toISOString();
    }

    return fallback.toISOString();
  }

  const parsed = new Date(rawValue);
  return Number.isNaN(parsed.getTime()) ? fallback.toISOString() : parsed.toISOString();
}