import { describe, expect, it } from 'vitest';
import { mergeUserSettings } from './userSettings';

describe('mergeUserSettings', () => {
  it('updates one screen theme without replacing the other stored themes', () => {
    expect(mergeUserSettings(
      {
        showTotalBalance: true,
        themeByDevice: {
          mobile: 'theme-oled',
          tablet: 'theme-carbon',
          desktop: 'theme-midnight',
        },
      },
      { themeByDevice: { tablet: 'theme-nordic' } },
    )).toEqual({
      showTotalBalance: true,
      themeByDevice: {
        mobile: 'theme-oled',
        tablet: 'theme-nordic',
        desktop: 'theme-midnight',
      },
    });
  });

  it('preserves unrelated settings while applying a top-level settings patch', () => {
    expect(mergeUserSettings(
      { showTotalBalance: true, dashboard: { desktop: { order: ['accounts'] } } },
      { themeByDevice: { mobile: 'theme-carbon' } },
    )).toEqual({
      showTotalBalance: true,
      dashboard: { desktop: { order: ['accounts'] } },
      themeByDevice: { mobile: 'theme-carbon' },
    });
  });
});