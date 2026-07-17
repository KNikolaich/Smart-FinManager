import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { safeStorage } from '../../lib/api';

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
  const [queueCount, setQueueCount] = useState(getQueueCount);

  // Poll queue count while offline so the badge stays accurate as the user
  // adds transactions / saves the plan without network access
  useEffect(() => {
    if (isOnline) return;
    setQueueCount(getQueueCount());
    const id = setInterval(() => setQueueCount(getQueueCount()), 2000);
    return () => clearInterval(id);
  }, [isOnline]);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-16 left-0 right-0 z-50 flex justify-center pointer-events-none px-4">
      <div className="bg-neutral-800/90 backdrop-blur-sm text-white text-xs font-medium px-4 py-2 rounded-full flex items-center gap-2 shadow-lg pointer-events-auto select-none">
        <WifiOff size={12} className="text-amber-400 shrink-0" />
        <span>Оффлайн режим — данные сохраняются локально</span>
        {queueCount > 0 && (
          <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
            {queueCount}
          </span>
        )}
      </div>
    </div>
  );
}
