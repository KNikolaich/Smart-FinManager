/**
 * Tests for OfflineBanner – verifies that the banner:
 *  1. Appears when offline and a cache timestamp is present
 *  2. Hides when connectivity is restored (isOnline becomes true)
 *  3. Reappears when the connection drops again (hide state is not sticky)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { OfflineBanner } from './OfflineBanner';

// ---------------------------------------------------------------------------
// Minimal localStorage shim (same pattern as api.offline.test.ts)
// ---------------------------------------------------------------------------

function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem:    (k: string) => store.get(k) ?? null,
    setItem:    (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear:      () => store.clear(),
    get length() { return store.size; },
    key: (i: number) => [...store.keys()][i] ?? null,
    _store: store,
  };
}

let fakeStorage = makeLocalStorage();

beforeEach(() => {
  fakeStorage = makeLocalStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: fakeStorage,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helper: seed the cache timestamp that getCacheTimestamp('/initial-data') reads
// ---------------------------------------------------------------------------

function seedCacheTimestamp(tsMs: number) {
  fakeStorage.setItem('api_cache_timestamp_/initial-data', String(tsMs));
}

// ---------------------------------------------------------------------------
// 1. Banner appears when offline and cache timestamp is present
// ---------------------------------------------------------------------------

describe('OfflineBanner – visibility when offline', () => {
  it('renders the banner when isOnline is false and a cache timestamp exists', async () => {
    seedCacheTimestamp(Date.now() - 60_000); // 1 minute ago

    const { container } = render(<OfflineBanner isOnline={false} />);

    // useEffect fires after first render; flush it
    await act(async () => {});

    expect(container.firstChild).not.toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('does not render when isOnline is false but no cache timestamp exists', async () => {
    // No cache timestamp seeded → getCacheTimestamp returns null

    const { container } = render(<OfflineBanner isOnline={false} />);
    await act(async () => {});

    expect(container.firstChild).toBeNull();
  });

  it('shows fresh-cache text when cache is less than 24 hours old', async () => {
    seedCacheTimestamp(Date.now() - 30 * 60_000); // 30 minutes ago

    render(<OfflineBanner isOnline={false} />);
    await act(async () => {});

    // Fresh-cache variant includes "Режим офлайн"
    expect(screen.getByRole('status').textContent).toMatch(/Режим офлайн/);
  });

  it('shows stale-data text when cache is older than 24 hours', async () => {
    seedCacheTimestamp(Date.now() - 25 * 60 * 60_000); // 25 hours ago

    render(<OfflineBanner isOnline={false} />);
    await act(async () => {});

    expect(screen.getByRole('status').textContent).toMatch(/Устаревшие данные/);
  });
});

// ---------------------------------------------------------------------------
// 2. Banner hides when connectivity is restored (isOnline flips to true)
// ---------------------------------------------------------------------------

describe('OfflineBanner – hides on reconnection', () => {
  it('disappears when isOnline transitions from false to true', async () => {
    seedCacheTimestamp(Date.now() - 5 * 60_000); // 5 minutes ago

    const { rerender, container } = render(<OfflineBanner isOnline={false} />);
    await act(async () => {});

    // Confirm banner is visible
    expect(container.firstChild).not.toBeNull();

    // Simulate reconnection
    rerender(<OfflineBanner isOnline={true} />);
    await act(async () => {});

    // Banner must be gone
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. Banner reappears on the next offline event (no sticky hidden state)
// ---------------------------------------------------------------------------

describe('OfflineBanner – reappears after reconnect + second dropout', () => {
  it('shows banner again when isOnline goes false after having been restored', async () => {
    seedCacheTimestamp(Date.now() - 10 * 60_000); // 10 minutes ago

    const { rerender, container } = render(<OfflineBanner isOnline={false} />);
    await act(async () => {});
    expect(container.firstChild).not.toBeNull(); // visible

    // Go online
    rerender(<OfflineBanner isOnline={true} />);
    await act(async () => {});
    expect(container.firstChild).toBeNull(); // hidden

    // Drop offline again
    rerender(<OfflineBanner isOnline={false} />);
    await act(async () => {});
    expect(container.firstChild).not.toBeNull(); // visible again
  });

  it('banner content is correct after a second offline transition', async () => {
    seedCacheTimestamp(Date.now() - 2 * 60_000); // 2 minutes ago

    const { rerender } = render(<OfflineBanner isOnline={false} />);
    await act(async () => {});

    rerender(<OfflineBanner isOnline={true} />);
    await act(async () => {});

    rerender(<OfflineBanner isOnline={false} />);
    await act(async () => {});

    expect(screen.getByRole('status').textContent).toMatch(/Режим офлайн/);
  });
});
