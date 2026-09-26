import { useEffect, useState } from 'react';
import { getThemeDeviceClass } from '../lib/themePreferences';

function readDeviceClass() {
  return typeof window === 'undefined'
    ? 'desktop'
    : getThemeDeviceClass(window.innerWidth);
}

export function useThemeDeviceClass() {
  const [deviceClass, setDeviceClass] = useState(readDeviceClass);

  useEffect(() => {
    const handleResize = () => setDeviceClass(readDeviceClass());
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return deviceClass;
}