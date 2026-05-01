import { useState, useEffect } from 'react';

export function useNetworkStatus(onStatusChange?: (status: 'online' | 'offline') => void) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (onStatusChange) onStatusChange('online');
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (onStatusChange) onStatusChange('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onStatusChange]);

  return isOnline;
}
