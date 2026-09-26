import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemePreferences, UserProfile } from '../types';
import Settings from './Settings';

const user: UserProfile = {
  id: 'theme-test-user',
  email: 'theme@example.com',
  createdAt: '2026-01-01T00:00:00.000Z',
  settings: { showTotalBalance: true },
};

function renderSettings(themePreferences: ThemePreferences, themeDeviceClass: 'mobile' | 'tablet' | 'desktop' = 'mobile') {
  const onSaveThemePreference = vi.fn().mockResolvedValue(undefined);
  const onSaveThemeForAllDevices = vi.fn().mockResolvedValue(undefined);
  const props = {
    user,
    accounts: [],
    onLogout: vi.fn(),
    onShowLogs: vi.fn(),
    onRefresh: vi.fn(),
    onSaveDashboardLayout: vi.fn().mockResolvedValue(undefined),
    themePreferences,
    themeDeviceClass,
    onSaveThemePreference,
    onSaveThemeForAllDevices,
  };
  return { ...render(<Settings {...props} />), props, onSaveThemePreference, onSaveThemeForAllDevices };
}

describe('Settings theme controls', () => {
  it('previews system mode and saves it for the selected device group', async () => {
    const preferences: ThemePreferences = {
      mobile: 'theme-nordic',
      tablet: 'theme-carbon',
      desktop: 'theme-oled',
    };
    const { onSaveThemePreference } = renderSettings(preferences);

    fireEvent.click(screen.getByTestId('theme-picker-toggle'));
    fireEvent.click(screen.getByTestId('theme-option-system'));

    const preview = screen.getByTestId('theme-preview');
    expect(preview.className).toContain('theme-nordic');
    expect(preview.getAttribute('aria-label')).toContain('Системная');

    fireEvent.click(screen.getByTestId('theme-apply-current'));
    await waitFor(() => expect(onSaveThemePreference).toHaveBeenCalledWith('mobile', 'theme-system'));
  });

  it('applies the draft to all device groups and resets all groups to Nordic', async () => {
    const defaultPreferences: ThemePreferences = {
      mobile: 'theme-nordic',
      tablet: 'theme-nordic',
      desktop: 'theme-nordic',
    };
    const { onSaveThemeForAllDevices, rerender, props } = renderSettings(defaultPreferences);

    fireEvent.click(screen.getByTestId('theme-picker-toggle'));
    fireEvent.click(screen.getByTestId('theme-option-theme-carbon'));
    fireEvent.click(screen.getByTestId('theme-apply-all'));
    await waitFor(() => expect(onSaveThemeForAllDevices).toHaveBeenCalledWith('theme-carbon'));

    const allCarbon: ThemePreferences = {
      mobile: 'theme-carbon',
      tablet: 'theme-carbon',
      desktop: 'theme-carbon',
    };
    rerender(<Settings {...props} themePreferences={allCarbon} />);

    fireEvent.click(screen.getByTestId('theme-reset-all'));
    await waitFor(() => expect(onSaveThemeForAllDevices).toHaveBeenCalledWith('theme-nordic'));
  });
});