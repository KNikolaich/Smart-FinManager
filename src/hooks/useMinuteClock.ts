import { useEffect, useState } from 'react';

/**
 * Current time, refreshed at the start of every minute, so views that depend
 * on the clock (e.g. a plan becoming overdue at 12:30) update by themselves.
 */
export function useMinuteClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const current = new Date();
      const untilNextMinute = 60_000 - (current.getSeconds() * 1000 + current.getMilliseconds());
      timer = setTimeout(() => {
        setNow(new Date());
        schedule();
      }, untilNextMinute + 50);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  return now;
}
