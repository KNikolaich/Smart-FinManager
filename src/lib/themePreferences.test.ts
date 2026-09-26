import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME,
  getThemeDeviceClass,
  isCompleteThemePreferences,
  isThemeId,
  isThemePreference,
  normalizeThemePreferences,
  resolveThemeChoice,
  resolveThemePreferences,
} from './themePreferences';

describe('theme preferences', () => {
  it('recognizes the three viewport classes without changing dashboard breakpoints', () => {
    expect(getThemeDeviceClass(390)).toBe('mobile');
    expect(getThemeDeviceClass(1024)).toBe('tablet');
    expect(getThemeDeviceClass(1439)).toBe('tablet');
    expect(getThemeDeviceClass(1440)).toBe('desktop');
  });

  it('validates theme ids and fills missing device preferences safely', () => {
    expect(isThemeId('theme-midnight')).toBe(true);
    expect(isThemeId('theme-injected')).toBe(false);
    expect(isThemePreference('theme-system')).toBe(true);
    expect(isThemePreference('theme-injected')).toBe(false);
    expect(normalizeThemePreferences(
      { mobile: 'theme-carbon', tablet: 'invalid', desktop: 'theme-oled' },
      'theme-light-blue',
    )).toEqual({
      mobile: 'theme-carbon',
      tablet: 'theme-light-blue',
      desktop: 'theme-oled',
    });
  });

  it('resolves system mode to the light or dark default palette', () => {
    expect(resolveThemeChoice('theme-system', false)).toBe(DEFAULT_THEME);
    expect(resolveThemeChoice('theme-system', true)).toBe('theme-midnight');
    expect(resolveThemeChoice('theme-carbon', true)).toBe('theme-carbon');
    expect(isCompleteThemePreferences({
      mobile: 'theme-system',
      tablet: 'theme-light-blue',
      desktop: 'theme-carbon',
    })).toBe(true);
  });

  it('migrates the previous browser theme to all device classes', () => {
    const migrated = resolveThemePreferences(undefined, 'theme-forest-dark');

    expect(migrated).toEqual({
      preferences: {
        mobile: 'theme-forest-dark',
        tablet: 'theme-forest-dark',
        desktop: 'theme-forest-dark',
      },
      shouldPersist: true,
    });
  });

  it('preserves complete account preferences and defaults safely for new accounts', () => {
    const complete = {
      mobile: 'theme-light-blue',
      tablet: 'theme-carbon',
      desktop: 'theme-oled',
    } as const;

    expect(resolveThemePreferences({ showTotalBalance: true, themeByDevice: complete }, null)).toEqual({
      preferences: complete,
      shouldPersist: false,
    });
    expect(resolveThemePreferences(undefined, null)).toEqual({
      preferences: { mobile: DEFAULT_THEME, tablet: DEFAULT_THEME, desktop: DEFAULT_THEME },
      shouldPersist: false,
    });
    expect(isCompleteThemePreferences(complete)).toBe(true);
    expect(isCompleteThemePreferences({ mobile: 'theme-light-blue' })).toBe(false);
  });
});