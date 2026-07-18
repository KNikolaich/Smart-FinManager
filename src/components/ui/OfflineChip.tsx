import { WifiOff } from 'lucide-react';
import { useState, useEffect } from 'react';
import { safeStorage, getCacheTimestamp } from '../../lib/api';

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

function formatCacheAge(ms: number): string {
  const age = Date.now() - ms;
  const m = Math.floor(age / 60_000);
  const h = Math.floor(age / 3_600_000);
  const d = Math.floor(age / 86_400_000);
  if (d >= 1) return `${d} ${d === 1 ? 'день' : d < 5 ? 'дня' : 'дней'} назад`;
  if (h >= 1) return `${h} ${h === 1 ? 'час' : h < 5 ? 'часа' : 'часов'} назад`;
  if (m >= 1) return `${m} ${m === 1 ? 'минуту' : m < 5 ? 'минуты' : 'минут'} назад`;
  return 'только что';
}

function getQueueCount(): number {
  const raw = safeStorage.getItem('api_offline_queue');
  if (!raw) return 0;
  try { return JSON.parse(raw).length; } catch { return 0; }
}

interface OfflineChipProps {
  isOnline: boolean;
  /** 'header' = horizontal pill with text label (portrait AppHeader)
   *  'sidebar' = icon-only with badge (landscape BottomNav) */
  variant?: 'header' | 'sidebar';
}

export function OfflineChip({ isOnline, variant = 'header' }: OfflineChipProps) {
  const [cacheTs, setCacheTs] = useState<number | null>(null);
  const [queueCount, setQueueCount] = useState(getQueueCount);

  useEffect(() => {
    if (!isOnline) setCacheTs(getCacheTimestamp('/initial-data'));
  }, [isOnline]);

  useEffect(() => {
    if (isOnline) return;
    const id = setInterval(() => {
      setCacheTs(getCacheTimestamp('/initial-data'));
      setQueueCount(getQueueCount());
    }, 5000);
    return () => clearInterval(id);
  }, [isOnline]);

  if (isOnline || cacheTs === null) return null;

  const isStale = Date.now() - cacheTs > STALE_THRESHOLD_MS;
  const ageLabel = formatCacheAge(cacheTs);

  const chipColor = isStale
    ? 'bg-amber-100 text-amber-700 border-amber-200'
    : 'bg-blue-100 text-blue-700 border-blue-200';
  const badgeColor = isStale ? 'bg-amber-600' : 'bg-blue-600';

  /* ── Tooltip (same for both variants) ─────────────────────────────── */
  const tooltip = (
    <div
      className={`
        absolute z-[200] w-52 rounded-2xl bg-neutral-900 text-white text-xs shadow-2xl p-3 space-y-1.5
        pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150
        ${variant === 'sidebar'
          ? 'left-full top-1/2 -translate-y-1/2 ml-3'
          : 'right-0 top-full mt-2'}
      `}
    >
      <p className="font-bold text-[11px] uppercase tracking-wider text-neutral-400">Режим офлайн</p>
      <p className="text-neutral-200">
        Кэш обновлён: <span className="text-white font-semibold">{ageLabel}</span>
      </p>
      {isStale && (
        <p className="text-amber-400 font-medium">⚠ Данные устарели — обновите при подключении</p>
      )}
      {queueCount > 0 ? (
        <p className="text-neutral-200">
          Ожидают синхронизации:{' '}
          <span className="text-white font-semibold">
            {queueCount}{' '}
            {queueCount === 1 ? 'операция' : queueCount < 5 ? 'операции' : 'операций'}
          </span>
        </p>
      ) : (
        <p className="text-neutral-400">Нет ожидающих операций</p>
      )}
    </div>
  );

  /* ── Sidebar variant (landscape, icon-only) ───────────────────────── */
  if (variant === 'sidebar') {
    return (
      <div className="relative group flex items-center justify-center">
        <div className={`relative flex items-center justify-center w-10 h-10 rounded-2xl border ${chipColor} cursor-default select-none`}>
          <WifiOff size={16} />
          {queueCount > 0 && (
            <span className={`absolute -top-1 -right-1 ${badgeColor} text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none`}>
              {queueCount > 99 ? '99+' : queueCount}
            </span>
          )}
        </div>
        {tooltip}
      </div>
    );
  }

  /* ── Header variant (portrait, horizontal pill) ───────────────────── */
  return (
    <div className="relative group flex items-center">
      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold cursor-default select-none ${chipColor}`}>
        <WifiOff size={13} />
        <span className="hidden sm:inline">Офлайн</span>
        {queueCount > 0 && (
          <span className={`${badgeColor} text-white rounded-full text-[10px] font-bold px-1.5 leading-5 min-w-[20px] text-center`}>
            {queueCount > 99 ? '99+' : queueCount}
          </span>
        )}
      </div>
      {tooltip}
    </div>
  );
}
