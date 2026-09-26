import type { ThemeDeviceClass, ThemeId, ThemePreferenceValue, ThemePreferences, UserSettings } from '../types';

export const DEFAULT_THEME: ThemeId = 'theme-nordic';

export const THEME_GROUPS: {
  type: string;
  items: { id: ThemeId; name: string; palette: string[] }[];
}[] = [
  {
    type: 'Светлые',
    items: [
      { id: 'theme-bw', palette: ['#ffffff', '#d1d5db', '#9ca3af', '#111827', '#000000'], name: 'ЧБ' },
      { id: 'theme-nordic', palette: ['#e0f2fe', '#bae6fd', '#7dd3fc', '#0369a1', '#075985'], name: 'Нордик' },
      { id: 'theme-light-blue', palette: ['#dbeafe', '#bfdbfe', '#93c5fd', '#1d4ed8', '#1e40af'], name: 'Лазурь' },
      { id: 'theme-light-orange', palette: ['#fffbeb', '#fef3c7', '#fde68a', '#b45309', '#92400e'], name: 'Пустыня' },
      { id: 'theme-light-ruby', palette: ['#fff1f2', '#fecdd3', '#fda4af', '#fb7185', '#e11d48'], name: 'Рубин' },
      { id: 'theme-light-violet', palette: ['#f5f3ff', '#ddd6fe', '#c4b5fd', '#6d28d9', '#5b21b6'], name: 'Фиалка' },
      { id: 'theme-light-green', palette: ['#d1fae5', '#a7f3d0', '#6ee7b7', '#047857', '#065f46'], name: 'Салат' },
    ],
  },
  {
    type: 'Темные',
    items: [
      { id: 'theme-midnight', palette: ['#0b1120', '#172033', '#273449', '#4f46e5', '#a5b4fc'], name: 'Полночь' },
      { id: 'theme-carbon', palette: ['#0d0f10', '#1a1d1f', '#262b2f', '#047857', '#6ee7b7'], name: 'Уголь' },
      { id: 'theme-oled', palette: ['#000000', '#0b0b0b', '#111111', '#047857', '#6ee7b7'], name: 'OLED' },
      { id: 'theme-forest-dark', palette: ['#031c10', '#073b2c', '#0b4b35', '#15803d', '#86efac'], name: 'Тайга' },
      { id: 'theme-nocturnal', palette: ['#000000', '#0b1118', '#121d29', '#008ab3', '#00d4ff'], name: 'Хронос' },
      { id: 'theme-cyber', palette: ['#030606', '#101918', '#182725', '#00b38f', '#00ffcc'], name: 'Кибер' },
    ],
  },
];

export const SYSTEM_THEME_ID = 'theme-system' as const;
export const SYSTEM_THEME_PALETTE = ['#f8fafc', '#ffffff', '#0b1120', '#172033', '#4f46e5'];
export const THEME_IDS = THEME_GROUPS.flatMap(group => group.items.map(theme => theme.id));
const themeIdSet = new Set<string>(THEME_IDS);
const THEME_DEVICE_CLASSES: ThemeDeviceClass[] = ['mobile', 'tablet', 'desktop'];
const themePreferenceSet = new Set<string>([...THEME_IDS, SYSTEM_THEME_ID]);

export const THEME_DEVICE_OPTIONS: { id: ThemeDeviceClass; label: string }[] = [
  { id: 'mobile', label: 'Телефон' },
  { id: 'tablet', label: 'Планшет / ноутбук' },
  { id: 'desktop', label: 'Большой экран' },
];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && themeIdSet.has(value);
}

export function isThemePreference(value: unknown): value is ThemePreferenceValue {
  return typeof value === 'string' && themePreferenceSet.has(value);
}

export function isCompleteThemePreferences(value: unknown): value is ThemePreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const preferences = value as Record<string, unknown>;
  return THEME_DEVICE_CLASSES.every(device => isThemePreference(preferences[device]));
}

export function normalizeThemePreferences(
  value: unknown,
  fallback: ThemePreferenceValue = DEFAULT_THEME,
): ThemePreferences {
  const preferences = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return {
    mobile: isThemePreference(preferences.mobile) ? preferences.mobile : fallback,
    tablet: isThemePreference(preferences.tablet) ? preferences.tablet : fallback,
    desktop: isThemePreference(preferences.desktop) ? preferences.desktop : fallback,
  };
}

export function resolveThemePreferences(
  settings: UserSettings | undefined,
  legacyTheme: string | null,
): { preferences: ThemePreferences; shouldPersist: boolean } {
  const hasStoredMap = Boolean(
    settings?.themeByDevice
    && typeof settings.themeByDevice === 'object'
    && !Array.isArray(settings.themeByDevice),
  );
  const fallback = isThemePreference(legacyTheme) ? legacyTheme : DEFAULT_THEME;
  const preferences = normalizeThemePreferences(settings?.themeByDevice, fallback);

  return {
    preferences,
    shouldPersist: !isCompleteThemePreferences(settings?.themeByDevice) && (hasStoredMap || fallback !== DEFAULT_THEME),
  };
}

export function getThemeDeviceClass(width: number): ThemeDeviceClass {
  if (width < 768) return 'mobile';
  if (width < 1440) return 'tablet';
  return 'desktop';
}

export function resolveThemeChoice(choice: ThemePreferenceValue, prefersDark: boolean): ThemeId {
  return choice === SYSTEM_THEME_ID ? (prefersDark ? 'theme-midnight' : DEFAULT_THEME) : choice;
}

export function applyTheme(choice: ThemePreferenceValue, prefersDark: boolean) {
  if (typeof document === 'undefined' || !document.body) return;
  document.body.classList.remove(...THEME_IDS);
  document.body.classList.add(isThemePreference(choice) ? resolveThemeChoice(choice, prefersDark) : DEFAULT_THEME);
}