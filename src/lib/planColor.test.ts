import { describe, expect, it } from 'vitest';
import type { Category } from '../types';
import { getPlanCategoryIcon, getPlanColor } from './planColor';

const categories: Category[] = [
  { id: 'transport', userId: 'u', name: 'Транспорт', type: 'expense', icon: '🚌', color: '#000' },
  { id: 'metro', userId: 'u', name: 'Метро', type: 'expense', icon: '', color: '#000', parentId: 'transport' },
  { id: 'tutor', userId: 'u', name: 'Репетитор', type: 'expense', icon: '📚', color: '#000' },
];

describe('getPlanColor', () => {
  it('accepts hex colours and treats old named values as "no colour"', () => {
    expect(getPlanColor({ color: '#2563EB' })).toBe('#2563eb');
    expect(getPlanColor({ color: 'plum' })).toBeNull();
    expect(getPlanColor({ color: undefined })).toBeNull();
    expect(getPlanColor({ color: '#fff' })).toBeNull();
  });
});

describe('getPlanCategoryIcon', () => {
  it('uses the category icon, falling back to its parent', () => {
    expect(getPlanCategoryIcon({ categoryId: 'tutor', transactionType: 'expense' }, categories)).toBe('📚');
    expect(getPlanCategoryIcon({ categoryId: 'metro', transactionType: 'expense' }, categories)).toBe('🚌');
  });

  it('has no icon for transfers or unknown categories', () => {
    expect(getPlanCategoryIcon({ categoryId: 'tutor', transactionType: 'transfer' }, categories)).toBeNull();
    expect(getPlanCategoryIcon({ categoryId: 'missing', transactionType: 'expense' }, categories)).toBeNull();
  });
});
