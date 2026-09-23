import {
  DashboardDevice,
  DashboardDeviceLayout,
  DashboardLayoutSettings,
  DashboardWidgetId,
  UserSettings,
} from '../types';

export const DASHBOARD_WIDGETS: ReadonlyArray<{
  id: DashboardWidgetId;
  label: string;
  description: string;
}> = [
  { id: 'upcomingTasks', label: 'Предстоящие планы', description: 'Ближайшие запланированные платежи и задачи' },
  { id: 'accounts', label: 'Счета', description: 'Баланс и список ваших счетов' },
  { id: 'transactions', label: 'Операции', description: 'Последние доходы, расходы и переводы' },
  { id: 'balance', label: 'Баланс', description: 'Общий баланс и динамика за период' },
  { id: 'goals', label: 'Цели', description: 'Прогресс по финансовым целям' },
];

export const DEFAULT_DASHBOARD_WIDGET_ORDER: DashboardWidgetId[] = [
  'balance',
  'upcomingTasks',
  'accounts',
  'transactions',
  'goals',
];

const DEFAULT_WIDGET_VISIBILITY: Record<DashboardWidgetId, boolean> = {
  upcomingTasks: true,
  accounts: true,
  transactions: true,
  balance: true,
  goals: true,
};

function isDashboardWidgetId(value: unknown): value is DashboardWidgetId {
  return DASHBOARD_WIDGETS.some(widget => widget.id === value);
}

function normalizeDeviceLayout(value: unknown): DashboardDeviceLayout {
  const candidate = value && typeof value === 'object' ? value as Partial<DashboardDeviceLayout> : {};
  const sourceOrder = Array.isArray(candidate.order) ? candidate.order : [];
  const order = Array.from(new Set(sourceOrder.filter(isDashboardWidgetId)));

  for (const widgetId of DEFAULT_DASHBOARD_WIDGET_ORDER) {
    if (!order.includes(widgetId)) order.push(widgetId);
  }

  const rawVisibility = candidate.visibility && typeof candidate.visibility === 'object'
    ? candidate.visibility as Partial<Record<DashboardWidgetId, unknown>>
    : {};
  const visibility = { ...DEFAULT_WIDGET_VISIBILITY };

  for (const widget of DASHBOARD_WIDGETS) {
    if (typeof rawVisibility[widget.id] === 'boolean') {
      visibility[widget.id] = rawVisibility[widget.id] as boolean;
    }
  }

  return { order, visibility };
}

export function getDefaultDashboardLayoutSettings(): DashboardLayoutSettings {
  return {
    desktop: normalizeDeviceLayout(undefined),
    tablet: normalizeDeviceLayout(undefined),
    mobile: normalizeDeviceLayout(undefined),
  };
}

export function normalizeDashboardLayoutSettings(value?: Partial<DashboardLayoutSettings> | null): DashboardLayoutSettings {
  return {
    desktop: normalizeDeviceLayout(value?.desktop),
    tablet: normalizeDeviceLayout(value?.tablet),
    mobile: normalizeDeviceLayout(value?.mobile),
  };
}

export function getDashboardLayout(
  settings: UserSettings | undefined,
  device: DashboardDevice,
): DashboardDeviceLayout {
  return normalizeDashboardLayoutSettings(settings?.dashboard)[device];
}