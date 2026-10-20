import { useMemo, useState } from 'react';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDown,
  ArrowUp,
  Check,
  EyeOff,
  GripVertical,
  LayoutDashboard,
  Monitor,
  Plus,
  RotateCcw,
  Smartphone,
  Tablet,
  X,
} from 'lucide-react';
import {
  DASHBOARD_MAX_ROW_SPAN,
  DASHBOARD_WIDGETS,
  getDefaultDashboardLayoutSettings,
  normalizeDashboardLayoutSettings,
} from '../../lib/dashboardLayout';
import {
  DashboardDevice,
  DashboardColumnSpan,
  DashboardDeviceLayout,
  DashboardLayoutSettings,
  DashboardRowSpan,
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

function widgetLabel(widgetId: DashboardWidgetId) {
  return DASHBOARD_WIDGETS.find(widget => widget.id === widgetId)?.label ?? widgetId;
}

interface LayoutTileProps {
  widgetId: DashboardWidgetId;
  span: DashboardColumnSpan;
  rows: DashboardRowSpan;
  selected: boolean;
  onSelect: () => void;
}

function LayoutTile({ widgetId, span, rows, selected, onSelect }: LayoutTileProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: widgetId });
  const label = widgetLabel(widgetId);

  return (
    <div
      ref={setNodeRef}
      onClick={onSelect}
      style={{
        gridColumn: `span ${span} / span ${span}`,
        gridRow: `span ${rows} / span ${rows}`,
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      className={cn(
        'relative flex min-w-0 cursor-pointer flex-col justify-between overflow-hidden rounded-xl border bg-theme-main p-1.5 text-left transition-colors',
        selected ? 'border-theme-primary ring-2 ring-theme-primary/30' : 'border-theme-base hover:border-theme-primary/50',
        isDragging && 'z-10 opacity-80 shadow-lg',
      )}
    >
      <div className="flex min-w-0 items-start gap-1">
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Перетащить «${label}»`}
          className="shrink-0 cursor-grab touch-none rounded-md p-0.5 text-theme-muted hover:text-theme-primary active:cursor-grabbing"
        >
          <GripVertical size={14} />
        </button>
        <span className="min-w-0 truncate text-[11px] font-bold leading-5 text-theme-main">{label}</span>
      </div>
      <span className="self-end text-[9px] font-bold tabular-nums text-theme-muted">
        {span}/12{rows > 1 ? ` × ${rows}` : ''}
      </span>
    </div>
  );
}

export function DashboardLayoutEditor({ value, onClose, onSave }: DashboardLayoutEditorProps) {
  const [draft, setDraft] = useState(() => normalizeDashboardLayoutSettings(value));
  const [activeDevice, setActiveDevice] = useState<DashboardDevice>('desktop');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [selectedWidget, setSelectedWidget] = useState<DashboardWidgetId | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeLayout = draft[activeDevice];
  const visibleOrder = activeLayout.order.filter(widgetId => activeLayout.visibility[widgetId]);
  const hiddenOrder = activeLayout.order.filter(widgetId => !activeLayout.visibility[widgetId]);
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

  const updateOrder = (getOrder: (layout: DashboardDeviceLayout) => DashboardWidgetId[] | null) => {
    setDraft(current => {
      const order = getOrder(current[activeDevice]);
      if (!order) return current;
      return {
        ...current,
        [activeDevice]: {
          ...current[activeDevice],
          order,
        },
      };
    });
  };

  // Hidden widgets keep their slot in the order but are skipped here, so a
  // step always swaps with the neighbour that is actually on screen.
  const moveWidget = (widgetId: DashboardWidgetId, direction: -1 | 1) => {
    updateOrder(layout => {
      const visible = layout.order.filter(id => layout.visibility[id]);
      const neighbour = visible[visible.indexOf(widgetId) + direction];
      if (!neighbour) return null;
      return arrayMove(layout.order, layout.order.indexOf(widgetId), layout.order.indexOf(neighbour));
    });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    updateOrder(layout => arrayMove(
      layout.order,
      layout.order.indexOf(active.id as DashboardWidgetId),
      layout.order.indexOf(over.id as DashboardWidgetId),
    ));
  };

  const updateRows = (widgetId: DashboardWidgetId, rows: DashboardRowSpan) => {
    setDraft(current => ({
      ...current,
      [activeDevice]: {
        ...current[activeDevice],
        rows: {
          ...current[activeDevice].rows,
          [widgetId]: rows,
        },
      },
    }));
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
              <p className="text-xs text-theme-muted">Состав и расположение блоков для каждого устройства</p>
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
              <h4 className="text-xs font-black uppercase tracking-widest text-theme-primary">Расположение компонентов</h4>
              <p className="mt-1 text-xs text-theme-muted">Порядок, ширина и высота блоков настраиваются отдельно для каждого устройства.</p>
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

            <p className="mb-2 text-[11px] text-theme-muted">
              Перетащите блок за ручку, чтобы поменять местами. Нажмите на блок, чтобы задать ширину и высоту:
              высокий блок оставляет рядом место, и соседние блоки встают друг под другом.
            </p>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={event => setSelectedWidget(event.active.id as DashboardWidgetId)}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={visibleOrder} strategy={rectSortingStrategy}>
                <div
                  data-testid="dashboard-layout-preview"
                  className="grid grid-cols-12 gap-1.5 rounded-2xl border border-theme-base bg-theme-surface p-2"
                  style={{ gridAutoRows: '56px' }}
                >
                  {visibleOrder.map(widgetId => (
                    <LayoutTile
                      key={widgetId}
                      widgetId={widgetId}
                      span={activeLayout.spans[widgetId]}
                      rows={activeLayout.rows[widgetId]}
                      selected={selectedWidget === widgetId}
                      onSelect={() => setSelectedWidget(widgetId)}
                    />
                  ))}
                  {visibleOrder.length === 0 && (
                    <p className="col-span-12 self-center text-center text-xs text-theme-muted">
                      На этом устройстве все блоки скрыты
                    </p>
                  )}
                </div>
              </SortableContext>
            </DndContext>

            {hiddenOrder.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">Скрыты:</span>
                {hiddenOrder.map(widgetId => (
                  <button
                    key={widgetId}
                    type="button"
                    onClick={() => updateVisibility(activeDevice, widgetId, true)}
                    aria-label={`Показать «${widgetLabel(widgetId)}» на устройстве «${activeDeviceMeta.label}»`}
                    className="inline-flex items-center gap-1 rounded-lg border border-dashed border-theme-base px-2 py-1 text-[11px] font-bold text-theme-muted transition-colors hover:border-theme-primary hover:text-theme-primary"
                  >
                    <Plus size={12} />
                    {widgetLabel(widgetId)}
                  </button>
                ))}
              </div>
            )}

            {selectedWidget && activeLayout.visibility[selectedWidget] && (
              <div className="mt-3 rounded-2xl border border-theme-base bg-theme-surface p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-black text-theme-main">{widgetLabel(selectedWidget)}</p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveWidget(selectedWidget, -1)}
                      disabled={visibleOrder.indexOf(selectedWidget) === 0}
                      aria-label={`Переместить «${widgetLabel(selectedWidget)}» раньше`}
                      className="rounded-lg border border-theme-base p-1.5 text-theme-muted transition-colors hover:text-theme-primary disabled:opacity-30"
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveWidget(selectedWidget, 1)}
                      disabled={visibleOrder.indexOf(selectedWidget) === visibleOrder.length - 1}
                      aria-label={`Переместить «${widgetLabel(selectedWidget)}» позже`}
                      className="rounded-lg border border-theme-base p-1.5 text-theme-muted transition-colors hover:text-theme-primary disabled:opacity-30"
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateVisibility(activeDevice, selectedWidget, false)}
                      aria-label={`Скрыть «${widgetLabel(selectedWidget)}» на устройстве «${activeDeviceMeta.label}»`}
                      className="rounded-lg border border-theme-base p-1.5 text-theme-muted transition-colors hover:text-rose-500"
                    >
                      <EyeOff size={15} />
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-theme-muted">Ширина</span>
                    <select
                      value={activeLayout.spans[selectedWidget]}
                      onChange={event => updateSpan(selectedWidget, Number(event.target.value) as DashboardColumnSpan)}
                      aria-label={`Ширина «${widgetLabel(selectedWidget)}» на устройстве «${activeDeviceMeta.label}»`}
                      className="w-full rounded-lg border border-theme-base bg-theme-main px-2 py-2 text-xs font-bold text-theme-main outline-none focus:ring-1 ring-theme-primary/30"
                    >
                      {Array.from({ length: 12 }, (_, index) => index + 1).map(span => (
                        <option key={span} value={span}>
                          {span === 12 ? 'Весь ряд (12/12)' : `${span}/12`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-theme-muted">Высота, рядов</span>
                    <div role="radiogroup" aria-label={`Высота «${widgetLabel(selectedWidget)}»`} className="flex gap-1">
                      {Array.from({ length: DASHBOARD_MAX_ROW_SPAN }, (_, index) => (index + 1) as DashboardRowSpan).map(rows => (
                        <button
                          key={rows}
                          type="button"
                          role="radio"
                          aria-checked={activeLayout.rows[selectedWidget] === rows}
                          onClick={() => updateRows(selectedWidget, rows)}
                          className={cn(
                            'flex-1 rounded-lg border px-2 py-2 text-xs font-bold transition-colors',
                            activeLayout.rows[selectedWidget] === rows
                              ? 'border-theme-primary bg-theme-primary-light text-theme-primary'
                              : 'border-theme-base bg-theme-main text-theme-muted hover:text-theme-main',
                          )}
                        >
                          {rows}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
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