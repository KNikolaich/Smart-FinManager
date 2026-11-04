import { describe, expect, it } from 'vitest';
import { groupSmallCategories, OTHER_CATEGORY_NAME } from './categoryGrouping';

const slice = (name: string, value: number) => ({ name, value, color: '#000' });

describe('groupSmallCategories', () => {
  it('keeps all categories when there are 7 or fewer', () => {
    const input = [1, 2, 3, 4, 5, 6, 7].map(v => slice(`c${v}`, v));
    const result = groupSmallCategories(input);
    expect(result).toHaveLength(7);
    expect(result.some(s => s.isOther)).toBe(false);
    expect(result.map(s => s.value)).toEqual([7, 6, 5, 4, 3, 2, 1]);
  });

  it('merges the 7th and smaller categories into «Остальные»', () => {
    const input = [
      slice('Продукты', 59263), slice('Бытовые', 32410), slice('Саморазвитие', 26980),
      slice('Здоровье', 22990), slice('Детские', 22850), slice('Транспорт', 5300),
      slice('Поборы', 5151), slice('Развлечения', 4620), slice('Легк пром-ть', 2380),
    ];
    const result = groupSmallCategories(input);
    expect(result).toHaveLength(7);
    const other = result[6];
    expect(other.name).toBe(OTHER_CATEGORY_NAME);
    expect(other.isOther).toBe(true);
    expect(other.value).toBe(5151 + 4620 + 2380);
    expect(other.members).toEqual(['Поборы', 'Развлечения', 'Легк пром-ть']);
    const total = (xs: { value: number }[]) => xs.reduce((s, x) => s + x.value, 0);
    expect(total(result)).toBe(total(input));
  });

  it('puts «Остальные» last even when it is larger than the top categories', () => {
    const input = [
      slice('a', 10), slice('b', 10), slice('c', 10), slice('d', 10), slice('e', 10), slice('f', 10),
      slice('g', 9), slice('h', 9), slice('i', 9),
    ];
    const result = groupSmallCategories(input);
    expect(result[result.length - 1].name).toBe(OTHER_CATEGORY_NAME);
    expect(result[result.length - 1].value).toBe(27);
  });

  it('returns an empty list for no data', () => {
    expect(groupSmallCategories([])).toEqual([]);
  });
});
