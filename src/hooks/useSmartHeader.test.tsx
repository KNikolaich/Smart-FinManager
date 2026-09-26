import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSmartHeader } from './useSmartHeader';

function SmartHeaderHarness({ activeTab = 'dashboard' }: { activeTab?: string }) {
  const { scrollContainerRef, isHeaderHidden } = useSmartHeader(activeTab);

  return (
    <div ref={scrollContainerRef} data-testid="app-scroll-container">
      <div data-testid="nested-scroll-container" />
      <output data-testid="header-visibility">{String(isHeaderHidden)}</output>
    </div>
  );
}

function scrollTo(element: HTMLElement, scrollTop: number) {
  element.scrollTop = scrollTop;
  fireEvent.scroll(element);
}

describe('useSmartHeader', () => {
  it('hides while scrolling down and reveals while scrolling up or returning to the top', () => {
    render(<SmartHeaderHarness />);
    const container = screen.getByTestId('app-scroll-container');
    const visibility = screen.getByTestId('header-visibility');

    scrollTo(container, 80);
    expect(visibility.textContent).toBe('true');

    scrollTo(container, 68);
    expect(visibility.textContent).toBe('false');

    scrollTo(container, 80);
    expect(visibility.textContent).toBe('true');
    scrollTo(container, 12);
    expect(visibility.textContent).toBe('false');
  });

  it('also reacts to scrolling inside nested page content and resets after tab changes', () => {
    const { rerender } = render(<SmartHeaderHarness />);
    const nestedContainer = screen.getByTestId('nested-scroll-container');
    const visibility = screen.getByTestId('header-visibility');

    scrollTo(nestedContainer, 24);
    expect(visibility.textContent).toBe('true');

    rerender(<SmartHeaderHarness activeTab="settings" />);
    expect(visibility.textContent).toBe('false');
  });
});