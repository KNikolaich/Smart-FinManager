import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  LayoutDashboard,
  Monitor,
  RotateCcw,
  Smartphone,
  Tablet,
  X,
} from 'lucide-react';
import {
  DASHBOARD_WIDGETS,
  getDefaultDashboardLayoutSettings,
  normalizeDashboardLayoutSettings,
} from '../../lib/dashboardLayout';
import {
  DashboardDevice,
  DashboardColumnSpan,
  DashboardLayoutSettings,
  DashboardWidgetId,
} from '../../types';
import { cn } from '../../lib/utils';

interface DashboardLayoutEditorProps {
  value?: DashboardLayoutSettings;
  onClose: () => void;
  onSave: (value: DashboardLayoutSettings) => Promise<void>;
}

const DEVICES: Array<{
  id: DashboardDevice;
  label: string;
  icon: typeof Monitor;
}> = [
  { id: 'desktop', label: 'Десктоп', icon: Monitor },
  { id: 'tablet', label: 'Планшет', icon: Tablet },
  { id: 'mobile', label: 'Смартфон', icon: Smartphone },
];

export function DashboardLayoutEditor({ value, onClose, onSave }: DashboardLayoutEditorProps) {
  const [draft, setDraft] = useState(() => normalizeDashboardLayoutSettings(value));
  const [activeDevice, setActiveDevice] = useState<DashboardDevice>('desktop');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const activeLayout = draft[activeDevice];
  const activeDeviceMeta = useMemo(
    () => DEVICES.find(device => device.id === activeDevice) ?? DEVICES[0],
    [activeDevice],
  );

  const updateVisibility = (device: DashboardDevice, widgetId: DashboardWidgetId, checked: boolean) => {
    setDraft(current => ({
      ...current,
      [device]: {
        ...current[device],
        visibility: {
          ...current[device].visibility,
          [widgetId]: checked,
        },
      },
    }));
  };

  const moveWidget = (widgetId: DashboardWidgetId, direction: -1 | 1) => {
    setDraft(current => {
      const order = [...current[activeDevice].order];
      const currentIndex = order.indexOf(widgetId);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= order.length) return current;

      [order[currentIndex], order[nextIndex]] = [order[nextIndex], order[currentIndex]];
      return {
        ...current,
        [activeDevice]: {
          ...current[activeDevice],
          order,
        },
      };
    });
  };

  const updateSpan = (widgetId: DashboardWidgetId, span: DashboardColumnSpan) => {
    setDraft(current => ({
      ...current,
      [activeDevice]: {
        ...current[activeDevice],
        spans: {
          ...current[activeDevice].spans,
          [widgetId]: span,
        },
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(draft);
      onClose();
    } catch (error: any) {
      setSaveError(error?.message || 'Не удалось сохранить настройки дашборда.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[180] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[28px] bg-theme-main shadow-2xl sm:rounded-[28px]">
        <header className="flex shrink-0 items-center justify-between border-b border-theme-base px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-theme-primary-light text-theme-primary">
              <LayoutDashboard size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-theme-main">Настройка дашборда</h3>
              <p className="text-xs text-theme-muted">Состав и порядок блоков для каждого устройства</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть настройку дашборда"
            className="rounded-xl p-2 text-theme-muted transition-colors hover:bg-theme-surface hover:text-theme-main"
          >
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          <section>
            <div className="mb-3">
              <h4 className="text-xs font-black uppercase tracking-widest text-theme-primary">Видимость компонентов</h4>
              <p className="mt-1 text-xs text-theme-muted">Выберите, какие блоки показывать на каждом типе устройства.</p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-theme-base bg-theme-surface">
              <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,76px)] items-center border-b border-theme-base px-3 py-3 text-[9px] font-black uppercase tracking-wider text-theme-muted sm:px-4">
                <span>Компонент</span>
                {DEVICES.map(device => (
                  <span key={device.id} className="text-center">{device.label}</span>
                ))}
              </div>
              {DASHBOARD_WIDGETS.map(widget => (
                <div
                  key={widget.id}
                  className="grid grid-cols-[minmax(0,1fr)_repeat(3,76px)] items-center border-b border-theme-base px-3 py-3 last:border-0 sm:px-4"
                >
                  <div className="min-w-0 pr-2">
                    <p className="truncate text-sm font-bold text-theme-main">{widget.label}</p>
                    <p className="hidden truncate text-[10px] text-theme-muted sm:block">{widget.description}</p>
                  </div>
                  {DEVICES.map(device => (
                    <label key={device.id} className="flex justify-center">
                      <input
                        type="checkbox"
                        checked={draft[device.id].visibility[widget.id]}
                        onChange={event => updateVisibility(device.id, widget.id, event.target.checked)}
                        aria-label={`Показывать «${widget.label}» на устройстве «${device.label}»`}
                        className="h-4 w-4 rounded border-theme-base accent-theme-primary"
                      />
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6">
            <div className="mb-3">
              <h4 className="text-xs font-black uppercase tracking-widest text-theme-primary">Порядок компонентов</h4>
              <p className="mt-1 text-xs text-theme-muted">Порядок и ширина настраиваются отдельно для каждого устройства.</p>
            </div>

            <div className="mb-3 flex gap-2 overflow-x-auto rounded-2xl bg-theme-surface p-1">
              {DEVICES.map(device => {
                const Icon = device.icon;
                return (
                  <button
                    key={device.id}
                    type="button"
                    onClick={() => setActiveDevice(device.id)}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors',
                      activeDevice === device.id
                        ? 'bg-theme-main text-theme-primary shadow-sm'
                        : 'text-theme-muted hover:text-theme-main',
                    )}
                  >
                    <Icon size={15} />
                    {device.label}
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              {activeLayout.order.map((widgetId, index) => {
                const widget = DASHBOARD_WIDGETS.find(item => item.id === widgetId);
                if (!widget) return null;
                const isVisible = activeLayout.visibility[widgetId];
                return (
                  <div
                    key={widgetId}
                    className={cn(
                      'flex items-center gap-2 rounded-2xl border px-3 py-2.5 transition-colors',
                      isVisible
                        ? 'border-theme-base bg-theme-surface'
                        : 'border-dashed border-theme-base bg-theme-main opacity-60',
                    )}
                  >
                    <GripVertical size={17} className="shrink-0 text-theme-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-theme-main">{widget.label}</p>
                      {!isVisible && <p className="text-[10px] font-bold text-theme-muted">Скрыт на этом устройстве</p>}
                    </div>
                    <select
                      value={activeLayout.spans[widgetId]}
                      onChange={event => updateSpan(widgetId, Number(event.target.value) as DashboardColumnSpan)}
                      aria-label={`Ширина «${widget.label}» на устройстве «${activeDeviceMeta.label}»`}
                      className="shrink-0 rounded-lg border border-theme-base bg-theme-main px-2 py-1.5 text-[10px] font-bold text-theme-main outline-none focus:ring-1 ring-theme-primary/30"
                    >
                      {Array.from({ length: 12 }, (_, index) => index + 1).map(span => (
                        <option key={span} value={span}>
                          {span === 12 ? '1 — весь ряд' : `${span}/12`}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveWidget(widgetId, -1)}
                        disabled={index === 0}
                        aria-label={`Переместить «${widget.label}» выше`}
                        className="rounded-lg border border-theme-base p-1.5 text-theme-muted transition-colors hover:text-theme-primary disabled:opacity-30"
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveWidget(widgetId, 1)}
                        disabled={index === activeLayout.order.length - 1}
                        aria-label={`Переместить «${widget.label}» ниже`}
                        className="rounded-lg border border-theme-base p-1.5 text-theme-muted transition-colors hover:text-theme-primary disabled:opacity-30"
                      >
                        <ArrowDown size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {saveError && (
            <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
              {saveError}
            </div>
          )}
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-theme-base px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <button
            type="button"
            onClick={() => setDraft(getDefaultDashboardLayoutSettings())}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-theme-muted transition-colors hover:bg-theme-surface hover:text-theme-main disabled:opacity-50"
          >
            <RotateCcw size={15} />
            Сбросить по умолчанию
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-xl border border-theme-base px-4 py-2.5 text-xs font-bold text-theme-muted transition-colors hover:bg-theme-surface disabled:opacity-50 sm:flex-none"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-theme-primary px-5 py-2.5 text-xs font-black text-theme-on-primary transition-opacity disabled:opacity-50 sm:flex-none"
            >
              <Check size={15} />
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}