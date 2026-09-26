import { useEffect, useRef, useState } from 'react';

const SCROLL_DIRECTION_THRESHOLD = 12;
const TOP_REVEAL_THRESHOLD = 24;

export function useSmartHeader(activeTab: string) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previousScrollTopsRef = useRef(new WeakMap<HTMLElement, number>());
  const lastDirectionRef = useRef(0);
  const accumulatedScrollRef = useRef(0);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    previousScrollTopsRef.current.set(scrollContainer, scrollContainer.scrollTop);

    const handleScroll = (event: Event) => {
      const target = event.target instanceof HTMLElement ? event.target : scrollContainer;
      if (target.closest('[role="dialog"], [aria-modal="true"]')) return;

      const currentScrollTop = Math.max(0, target.scrollTop);
      const previousScrollTop = previousScrollTopsRef.current.get(target);
      previousScrollTopsRef.current.set(target, currentScrollTop);

      if (target === scrollContainer && currentScrollTop <= TOP_REVEAL_THRESHOLD) {
        lastDirectionRef.current = 0;
        accumulatedScrollRef.current = 0;
        setIsHeaderHidden(false);
        return;
      }

      if (previousScrollTop === undefined) {
        if (currentScrollTop <= 0) return;
        lastDirectionRef.current = 1;
        accumulatedScrollRef.current = currentScrollTop;
        if (currentScrollTop >= SCROLL_DIRECTION_THRESHOLD) setIsHeaderHidden(true);
        return;
      }

      const delta = currentScrollTop - previousScrollTop;
      if (delta === 0) return;

      const direction = Math.sign(delta);
      if (direction !== lastDirectionRef.current) {
        lastDirectionRef.current = direction;
        accumulatedScrollRef.current = 0;
      }
      accumulatedScrollRef.current += Math.abs(delta);

      if (accumulatedScrollRef.current >= SCROLL_DIRECTION_THRESHOLD) {
        setIsHeaderHidden(direction > 0);
        accumulatedScrollRef.current = 0;
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll, true);
  }, []);

  useEffect(() => {
    previousScrollTopsRef.current = new WeakMap<HTMLElement, number>();
    lastDirectionRef.current = 0;
    accumulatedScrollRef.current = 0;
    setIsHeaderHidden(false);
  }, [activeTab]);

  return { scrollContainerRef, isHeaderHidden };
}