import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { safeStorage, getCacheTimestamp } from '../../lib/api';

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

function formatCacheAge(timestampMs: number): string {
  const ageMs = Date.now() - timestampMs;
  const minutes = Math.floor(ageMs / 60_000);
  const hours = Math.floor(ageMs / 3_600_000);
  const days = Math.floor(ageMs / 86_400_000);
  if (days >= 1) return `${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'} назад`;
  if (hours >= 1) return `${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'} назад`;
  if (minutes >= 1) return `${minutes} ${minutes === 1 ? 'минуту' : minutes < 5 ? 'минуты' : 'минут'} назад`;
  return 'только что';
}

function getQueueCount(): number {
  const raw = safeStorage.getItem('api_offline_queue');
  if (!raw) return 0;
  try {
    return JSON.parse(raw).length;
  } catch {
    return 0;
  }
}

interface OfflineBannerProps {
  isOnline: boolean;
}

export function OfflineBanner({ isOnline }: OfflineBannerProps) {
  const [cacheTs, setCacheTs] = useState<number | null>(null);
  const [queueCount, setQueueCount] = useState(getQueueCount);

  // Read cache timestamp whenever connectivity changes
  useEffect(() => {
    if (!isOnline) {
      setCacheTs(getCacheTimestamp('/initial-data'));
    }
  }, [isOnline]);

  // Poll cache timestamp and queue count while offline so labels stay fresh
  useEffect(() => {
    if (isOnline) return;
    const id = setInterval(() => {
      setCacheTs(getCacheTimestamp('/initial-data'));
      setQueueCount(getQueueCount());
    }, 5000);
    return () => clearInterval(id);
  }, [isOnline]);

  // Don't render when online, or when there is no cached data to reference
  if (isOnline || cacheTs === null) return null;

  const isStale = Date.now() - cacheTs > STALE_THRESHOLD_MS;
  const ageLabel = formatCacheAge(cacheTs);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        shrink-0 w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium
        border-b z-40
        ${isStale
          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
          : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
        }
      `}
    >
      <WifiOff size={14} className="shrink-0 opacity-70" />

      <span className="flex-1 min-w-0 leading-snug">
        {isStale ? (
          <>
            <span className="font-semibold">Устаревшие данные: </span>
            кэш обновлён {ageLabel}. Подключитесь к сети для актуальной информации.
          </>
        ) : (
          <>
            Режим офлайн — просматриваете данные из кэша ({ageLabel}).
          </>
        )}
        {queueCount > 0 && (
          <span className="ml-1.5 inline-flex items-center gap-1 opacity-75">
            · {queueCount}{' '}
            {queueCount === 1
              ? 'операция ожидает'
              : queueCount < 5
              ? 'операции ожидают'
              : 'операций ожидают'}{' '}
            синхронизации
          </span>
        )}
      </span>

      <span className="shrink-0 flex items-center gap-1 text-xs opacity-60 select-none">
        <RefreshCw size={11} />
        Обновится автоматически
      </span>
    </div>
  );
}
