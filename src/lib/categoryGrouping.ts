export interface CategorySlice {
  name: string;
  value: number;
  color: string;
  /** true for the synthetic «Остальные» slice that sums the small categories */
  isOther?: boolean;
  /** names of the categories merged into «Остальные» */
  members?: string[];
}

export const OTHER_CATEGORY_NAME = 'Остальные';
export const OTHER_CATEGORY_COLOR = '#9CA3AF';
/** How many of the largest categories are shown on their own. */
export const TOP_CATEGORY_COUNT = 6;

/**
 * Keeps the largest categories as they are and merges the rest into one
 * «Остальные» slice, which always goes last whatever its sum.
 * Nothing is merged while there are at most TOP_CATEGORY_COUNT + 1 categories,
 * since folding a single category into «Остальные» would only rename it.
 */
export function groupSmallCategories<T extends CategorySlice>(
  slices: T[],
  topCount: number = TOP_CATEGORY_COUNT,
): CategorySlice[] {
  const sorted = [...slices].sort((a, b) => b.value - a.value);
  if (sorted.length <= topCount + 1) return sorted;

  const top = sorted.slice(0, topCount);
  const rest = sorted.slice(topCount);
  return [
    ...top,
    {
      name: OTHER_CATEGORY_NAME,
      value: rest.reduce((sum, s) => sum + s.value, 0),
      color: OTHER_CATEGORY_COLOR,
      isOther: true,
      members: rest.map(s => s.name),
    },
  ];
}
