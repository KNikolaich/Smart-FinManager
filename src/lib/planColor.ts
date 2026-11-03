import type { Category, PlannedPayment } from '../types';

/**
 * Colours a plan can be marked with in the calendar. A plan without a colour
 * (or with one of the old named values like "plum") keeps the default look.
 */
export const PLAN_COLORS: Array<{ value: string; label: string }> = [
  { value: '#e11d48', label: 'Красный' },
  { value: '#f97316', label: 'Оранжевый' },
  { value: '#eab308', label: 'Жёлтый' },
  { value: '#16a34a', label: 'Зелёный' },
  { value: '#0d9488', label: 'Бирюзовый' },
  { value: '#2563eb', label: 'Синий' },
  { value: '#7c3aed', label: 'Фиолетовый' },
  { value: '#db2777', label: 'Розовый' },
  { value: '#78716c', label: 'Серый' },
];

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** The plan's own colour, or null when the plan uses the default look. */
export function getPlanColor(payment: Pick<PlannedPayment, 'color'>): string | null {
  const color = typeof payment.color === 'string' ? payment.color.trim() : '';
  return HEX_COLOR.test(color) ? color.toLowerCase() : null;
}

/** Emoji of the plan's category (or its parent category), if it has one. */
export function getPlanCategoryIcon(
  payment: Pick<PlannedPayment, 'categoryId' | 'transactionType'>,
  categories: Category[],
): string | null {
  if (payment.transactionType === 'transfer' || !payment.categoryId) return null;
  const category = categories.find(item => item.id === payment.categoryId);
  if (!category) return null;
  const parent = category.parentId ? categories.find(item => item.id === category.parentId) : undefined;
  const icon = category.icon?.trim() || parent?.icon?.trim();
  return icon || null;
}
