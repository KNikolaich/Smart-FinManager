import type { ThemeDeviceClass, ThemeId, ThemePreferences, UserSettings } from '../types';

export const DEFAULT_THEME: ThemeId = 'theme-nordic';

export const THEME_GROUPS: {
  type: string;
  items: { id: ThemeId; name: string; palette: string[] }[];
}[] = [
  {
    type: 'Светлые',
    items: [
      { id: 'theme-bw', palette: ['#ffffff', '#d1d5db', '#9ca3af', '#111827', '#000000'], name: 'ЧБ' },
      { id: 'theme-nordic', palette: ['#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9'], name: 'Нордик' },
      { id: 'theme-light-blue', palette: ['#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#2563eb'], name: 'Лазурь' },
      { id: 'theme-light-orange', palette: ['#fffbeb', '#fef3c7', '#fde68a', '#fbbf24', '#f59e0b'], name: 'Пустыня' },
      { id: 'theme-light-ruby', palette: ['#fff1f2', '#fecdd3', '#fda4af', '#fb7185', '#e11d48'], name: 'Рубин' },
      { id: 'theme-light-violet', palette: ['#f5f3ff', '#ddd6fe', '#c4b5fd', '#a78bfa', '#7c3aed'], name: 'Фиалка' },
      { id: 'theme-light-green', palette: ['#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#059669'], name: 'Салат' },
    ],
  },
  {
    type: 'Темные',
    items: [
      { id: 'theme-midnight', palette: ['#0b1120', '#172033', '#273449', '#4f46e5', '#818cf8'], name: 'Полночь' },
      { id: 'theme-carbon', palette: ['#0d0f10', '#1a1d1f', '#262b2f', '#059669', '#34d399'], name: 'Уголь' },
      { id: 'theme-oled', palette: ['#000000', '#0b0b0b', '#111111', '#059669', '#34d399'], name: 'OLED' },
      { id: 'theme-forest-dark', palette: ['#031c10', '#073b2c', '#0b4b35', '#16a34a', '#4ade80'], name: 'Тайга' },
      { id: 'theme-nocturnal', palette: ['#000000', '#0b1118', '#121d29', '#008ab3', '#00d4ff'], name: 'Хронос' },
      { id: 'theme-cyber', palette: ['#030606', '#101918', '#182725', '#00b38f', '#00ffcc'], name: 'Кибер' },
    ],
  },
];

export const THEME_IDS = THEME_GROUPS.flatMap(group => group.items.map(theme => theme.id));
const themeIdSet = new Set<string>(THEME_IDS);
const THEME_DEVICE_CLASSES: ThemeDeviceClass[] = ['mobile', 'tablet', 'desktop'];

export const THEME_DEVICE_OPTIONS: { id: ThemeDeviceClass; label: string }[] = [
  { id: 'mobile', label: 'Телефон' },
  { id: 'tablet', label: 'Планшет / ноутбук' },
  { id: 'desktop', label: 'Большой экран' },
];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && themeIdSet.has(value);
}

export function isCompleteThemePreferences(value: unknown): value is ThemePreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const preferences = value as Record<string, unknown>;
  return THEME_DEVICE_CLASSES.every(device => isThemeId(preferences[device]));
}

export function normalizeThemePreferences(
  value: unknown,
  fallback: ThemeId = DEFAULT_THEME,
): ThemePreferences {
  const preferences = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return {
    mobile: isThemeId(preferences.mobile) ? preferences.mobile : fallback,
    tablet: isThemeId(preferences.tablet) ? preferences.tablet : fallback,
    desktop: isThemeId(preferences.desktop) ? preferences.desktop : fallback,
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
  const fallback = isThemeId(legacyTheme) ? legacyTheme : DEFAULT_THEME;
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

export function applyTheme(themeId: ThemeId) {
  if (typeof document === 'undefined' || !document.body) return;
  document.body.classList.remove(...THEME_IDS);
  document.body.classList.add(isThemeId(themeId) ? themeId : DEFAULT_THEME);
}