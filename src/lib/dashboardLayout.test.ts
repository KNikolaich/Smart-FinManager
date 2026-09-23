import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DASHBOARD_WIDGET_ORDER,
  getDashboardLayout,
  normalizeDashboardLayoutSettings,
} from './dashboardLayout';

describe('dashboard layout settings', () => {
  it('provides the current default order and shows every widget', () => {
    const layout = normalizeDashboardLayoutSettings();

    expect(layout.desktop.order).toEqual(DEFAULT_DASHBOARD_WIDGET_ORDER);
    expect(layout.tablet.order).toEqual(DEFAULT_DASHBOARD_WIDGET_ORDER);
    expect(layout.mobile.order).toEqual(DEFAULT_DASHBOARD_WIDGET_ORDER);
    expect(layout.desktop.spans.accounts).toBe(8);
    expect(layout.desktop.spans.upcomingTasks).toBe(4);
    expect(layout.desktop.spans.transactions).toBe(12);
    expect(layout.mobile.spans.transactions).toBe(12);
    expect(Object.values(layout.mobile.visibility).every(Boolean)).toBe(true);
  });

  it('keeps a custom order and visibility independently for each device', () => {
    const layout = normalizeDashboardLayoutSettings({
      desktop: {
        order: ['goals', 'balance', 'accounts', 'transactions', 'upcomingTasks'],
        visibility: {
          upcomingTasks: false,
          accounts: true,
          transactions: true,
          balance: true,
          goals: true,
        },
      },
    });

    expect(layout.desktop.order[0]).toBe('goals');
    expect(layout.desktop.visibility.upcomingTasks).toBe(false);
    expect(layout.desktop.spans.accounts).toBe(8);
    expect(layout.tablet.visibility.upcomingTasks).toBe(true);
  });

  it('repairs incomplete or invalid layouts without dropping widgets', () => {
    const layout = normalizeDashboardLayoutSettings({
      mobile: {
        order: ['goals', 'goals', 'unknown' as never],
        visibility: { goals: false } as never,
      },
    });

    expect(layout.mobile.order).toHaveLength(5);
    expect(new Set(layout.mobile.order).size).toBe(5);
    expect(layout.mobile.visibility.goals).toBe(false);
    expect(layout.mobile.spans.goals).toBe(12);
    expect(layout.mobile.visibility.balance).toBe(true);
  });

  it('selects the layout for the active device', () => {
    const layout = {
      showTotalBalance: true,
      dashboard: normalizeDashboardLayoutSettings({
        tablet: {
          order: ['accounts', 'balance', 'upcomingTasks', 'transactions', 'goals'],
          visibility: {
            upcomingTasks: true,
            accounts: false,
            transactions: true,
            balance: true,
            goals: true,
          },
        },
      }),
    };

    expect(getDashboardLayout(layout, 'tablet').order[0]).toBe('accounts');
    expect(getDashboardLayout(layout, 'tablet').visibility.accounts).toBe(false);
  });
});