import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DASHBOARD_WIDGET_ORDER,
  getDashboardLayout,
  normalizeDashboardLayoutSettings,
} from './dashboardLayout';
import { updateProfileSchema } from '../../validation';

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

  it('defaults every widget to one row and keeps saved heights', () => {
    const defaults = normalizeDashboardLayoutSettings();
    expect(Object.values(defaults.desktop.rows).every(rows => rows === 1)).toBe(true);

    const layout = normalizeDashboardLayoutSettings({
      desktop: {
        rows: { transactions: 2, accounts: 9, goals: 0.5 } as never,
      },
    });

    expect(layout.desktop.rows.transactions).toBe(2);
    expect(layout.desktop.rows.accounts).toBe(1);
    expect(layout.desktop.rows.goals).toBe(1);
    expect(layout.tablet.rows.transactions).toBe(1);
  });

  it('accepts saved layouts with and without row heights', () => {
    const withRows = normalizeDashboardLayoutSettings({ desktop: { rows: { transactions: 2 } as never } });
    expect(updateProfileSchema.safeParse({ settings: { dashboard: withRows } }).success).toBe(true);

    const { rows: _rows, ...legacyDesktop } = withRows.desktop;
    const legacy = { ...withRows, desktop: legacyDesktop };
    expect(updateProfileSchema.safeParse({ settings: { dashboard: legacy } }).success).toBe(true);

    const tooTall = { ...withRows, desktop: { ...withRows.desktop, rows: { ...withRows.desktop.rows, goals: 5 } } };
    expect(updateProfileSchema.safeParse({ settings: { dashboard: tooTall } }).success).toBe(false);
  });
});
