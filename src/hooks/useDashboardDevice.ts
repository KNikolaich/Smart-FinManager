import { useEffect, useState } from 'react';
import { DashboardDevice } from '../types';

function getDashboardDevice(): DashboardDevice {
  if (typeof window === 'undefined') return 'desktop';
  if (window.matchMedia('(min-width: 1024px)').matches) return 'desktop';
  if (window.matchMedia('(min-width: 768px)').matches) return 'tablet';
  return 'mobile';
}

export function useDashboardDevice(): DashboardDevice {
  const [device, setDevice] = useState<DashboardDevice>(getDashboardDevice);

  useEffect(() => {
    const handleResize = () => setDevice(getDashboardDevice());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return device;
}