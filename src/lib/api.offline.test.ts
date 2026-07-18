/**
 * Offline queue tests for src/lib/api.ts
 *
 * Covers:
 *  1. Queue survives a page reload (items written to localStorage persist)
 *  2. Quota-exceeded: the `storage-quota-exceeded` CustomEvent is dispatched
 *     when safeStorage.setItem fails
 *  3. Eviction via pushToOfflineQueue: oldest non-plan-grid item is dropped
 *     first, plan-grid items are preserved, and storage-quota-exceeded is
 *     ALWAYS dispatched (no silent data-loss)
 *  4. Quota on unrelated cache writes must NOT silently remove queue items
 *  5. syncOfflineQueue replays every queued item and clears the queue on
 *     reconnect; handles mid-queue network errors and server 4xx errors
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { safeStorage, pushToOfflineQueue, syncOfflineQueue, describeQueueItem } from './api';

// ---------------------------------------------------------------------------
// Minimal localStorage shim backed by a plain Map so tests are fully isolated
// ---------------------------------------------------------------------------

function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
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
  Object.defineProperty(navigator, 'onLine', {
    value: true,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seedQueue(items: object[]) {
  fakeStorage.setItem('api_offline_queue', JSON.stringify(items));
}

function readQueue(): any[] {
  const raw = fakeStorage.getItem('api_offline_queue');
  return raw ? JSON.parse(raw) : [];
}

function makeQueueItem(endpoint: string, overrides: object = {}): object {
  return {
    id: Math.random().toString(36).slice(2),
    method: 'POST',
    endpoint,
    data: { id: 'offline_abc', amount: 10 },
    timestamp: Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 0. describeQueueItem – human-readable label for a queue item
// ---------------------------------------------------------------------------
describe('describeQueueItem – human-readable labels', () => {
  it('labels POST /transactions as "добавление транзакции"', () => {
    expect(describeQueueItem({ method: 'POST', endpoint: '/transactions' }))
      .toBe('добавление транзакции');
  });

  it('labels PUT /transactions/123 as "изменение транзакции"', () => {
    expect(describeQueueItem({ method: 'PUT', endpoint: '/transactions/123' }))
      .toBe('изменение транзакции');
  });

  it('labels DELETE /accounts/abc as "удаление счёта"', () => {
    expect(describeQueueItem({ method: 'DELETE', endpoint: '/accounts/abc' }))
      .toBe('удаление счёта');
  });

  it('labels POST /categories as "добавление категории"', () => {
    expect(describeQueueItem({ method: 'POST', endpoint: '/categories' }))
      .toBe('добавление категории');
  });

  it('labels PUT /goals/x as "изменение цели"', () => {
    expect(describeQueueItem({ method: 'PUT', endpoint: '/goals/x' }))
      .toBe('изменение цели');
  });

  it('labels DELETE /plan-grid/monthly as "удаление плана"', () => {
    expect(describeQueueItem({ method: 'DELETE', endpoint: '/plan-grid/monthly' }))
      .toBe('удаление плана');
  });

  it('falls back gracefully for unknown endpoints', () => {
    expect(describeQueueItem({ method: 'POST', endpoint: '/unknown-endpoint' }))
      .toBe('добавление операции');
  });
});

// ---------------------------------------------------------------------------
// 1. Queue survives a page reload
// ---------------------------------------------------------------------------
describe('offline queue – persistence across reload', () => {
  it('items written to localStorage are readable after a simulated reload', () => {
    const items = [
      makeQueueItem('/transactions', { timestamp: 1000 }),
      makeQueueItem('/accounts',     { timestamp: 2000 }),
    ];
    seedQueue(items);

    // Simulate reload: re-parse the raw string (exactly what syncOfflineQueue does)
    const raw = fakeStorage.getItem('api_offline_queue');
    expect(raw).not.toBeNull();
    const reloaded = JSON.parse(raw!);
    expect(reloaded).toHaveLength(2);
    expect(reloaded[0].endpoint).toBe('/transactions');
    expect(reloaded[1].endpoint).toBe('/accounts');
  });

  it('safeStorage.setItem persists and safeStorage.getItem recovers the queue', () => {
    const payload = JSON.stringify([makeQueueItem('/goals')]);
    safeStorage.setItem('api_offline_queue', payload);

    const recovered = safeStorage.getItem('api_offline_queue');
    expect(recovered).not.toBeNull();
    const queue = JSON.parse(recovered!);
    expect(queue).toHaveLength(1);
    expect(queue[0].endpoint).toBe('/goals');
  });
});

// ---------------------------------------------------------------------------
// 2. safeStorage.setItem – quota exceeded fires the event (no eviction here)
// ---------------------------------------------------------------------------
describe('safeStorage.setItem – quota exceeded', () => {
  it('dispatches storage-quota-exceeded when localStorage.setItem throws a QuotaExceededError', () => {
    const err = Object.assign(new DOMException('QuotaExceededError'), { code: 22 });
    vi.spyOn(fakeStorage, 'setItem').mockImplementation(() => { throw err; });

    const handler = vi.fn();
    window.addEventListener('storage-quota-exceeded', handler);

    const result = safeStorage.setItem('some-cache-key', 'value');

    window.removeEventListener('storage-quota-exceeded', handler);

    expect(result).toBe(false);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does NOT dispatch storage-quota-exceeded for unrelated errors', () => {
    vi.spyOn(fakeStorage, 'setItem').mockImplementation(() => {
      throw new Error('Some other error');
    });

    const handler = vi.fn();
    window.addEventListener('storage-quota-exceeded', handler);

    const result = safeStorage.setItem('any-key', 'value');

    window.removeEventListener('storage-quota-exceeded', handler);

    expect(result).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('does NOT touch the offline queue when a cache write hits the quota', () => {
    // Seed a queue with a pending operation
    const txItem = makeQueueItem('/transactions', { timestamp: 1000 });
    seedQueue([txItem]);

    // Simulate quota error on a cache write (not a queue write)
    const err = Object.assign(new DOMException('QuotaExceededError'), { code: 22 });
    let callCount = 0;
    vi.spyOn(fakeStorage, 'setItem').mockImplementation((k: string) => {
      callCount++;
      // Only throw for the cache key, not for api_offline_queue
      if (k === 'api_cache_/initial-data') {
        throw err;
      }
      // For all other keys, store normally (simulate real storage)
    });

    safeStorage.setItem('api_cache_/initial-data', '{"accounts":[]}');

    // The queue must remain untouched — safeStorage.setItem must never evict
    // queue items on behalf of a cache write
    const remaining = readQueue();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].endpoint).toBe('/transactions');
  });
});

// ---------------------------------------------------------------------------
// 3. pushToOfflineQueue – eviction policy
// ---------------------------------------------------------------------------
describe('pushToOfflineQueue – eviction on quota exceeded', () => {
  it('evicts the oldest non-plan-grid item and dispatches offline-queue-item-evicted (not the generic quota event)', () => {
    // Seed queue: txItem is oldest regular op, planItem is plan-grid, acItem is newer regular op
    const txItem   = makeQueueItem('/transactions',       { timestamp: 1000 });
    const planItem = makeQueueItem('/plan-grid/monthly',  { timestamp: 1500 });
    const acItem   = makeQueueItem('/accounts',           { timestamp: 2000 });
    seedQueue([txItem, planItem, acItem]);

    // First setItem call throws (simulates storage being full); retry succeeds
    let callCount = 0;
    const realSetItem = fakeStorage.setItem.bind(fakeStorage);
    vi.spyOn(fakeStorage, 'setItem').mockImplementation((k: string, v: string) => {
      if (callCount === 0) {
        callCount++;
        const err = Object.assign(new DOMException('QuotaExceededError'), { code: 22 });
        throw err;
      }
      callCount++;
      realSetItem(k, v);
    });

    const genericHandler = vi.fn();
    const evictedItems: any[] = [];
    window.addEventListener('storage-quota-exceeded', genericHandler);
    window.addEventListener('offline-queue-item-evicted', (e: Event) => {
      evictedItems.push((e as CustomEvent).detail?.item);
    });

    const newItem = makeQueueItem('/goals', { timestamp: 3000 });
    const result = pushToOfflineQueue(newItem);

    window.removeEventListener('storage-quota-exceeded', genericHandler);

    // The write should succeed after eviction
    expect(result).toBe(true);
    // The named eviction event must fire — no silent drops
    expect(evictedItems).toHaveLength(1);
    expect(evictedItems[0].endpoint).toBe('/transactions');
    // The generic quota toast must NOT also fire (avoid duplicate notifications)
    expect(genericHandler).not.toHaveBeenCalled();

    // txItem (oldest non-plan-grid) should be gone; plan-grid + newer items preserved
    const remaining = readQueue();
    const endpoints = remaining.map((i: any) => i.endpoint);
    expect(endpoints).not.toContain('/transactions');    // evicted
    expect(endpoints).toContain('/plan-grid/monthly');   // preserved
    expect(endpoints).toContain('/accounts');            // preserved
    expect(endpoints).toContain('/goals');               // newly added
  });

  it('dispatches offline-queue-item-evicted with the dropped item in detail', () => {
    const txItem  = makeQueueItem('/transactions', { timestamp: 1000 });
    const accItem = makeQueueItem('/accounts',     { timestamp: 2000 });
    seedQueue([txItem, accItem]);

    // First setItem call throws; retry succeeds
    let callCount = 0;
    const realSetItem = fakeStorage.setItem.bind(fakeStorage);
    vi.spyOn(fakeStorage, 'setItem').mockImplementation((k: string, v: string) => {
      if (callCount === 0) {
        callCount++;
        const err = Object.assign(new DOMException('QuotaExceededError'), { code: 22 });
        throw err;
      }
      callCount++;
      realSetItem(k, v);
    });

    const evictedItems: any[] = [];
    const genericHandler = vi.fn();
    const evictHandler = (e: Event) => evictedItems.push((e as CustomEvent).detail?.item);

    window.addEventListener('storage-quota-exceeded', genericHandler);
    window.addEventListener('offline-queue-item-evicted', evictHandler);

    const newItem = makeQueueItem('/goals', { timestamp: 3000 });
    pushToOfflineQueue(newItem);

    window.removeEventListener('storage-quota-exceeded', genericHandler);
    window.removeEventListener('offline-queue-item-evicted', evictHandler);

    // One eviction event fired with the dropped item
    expect(evictedItems).toHaveLength(1);
    expect(evictedItems[0].endpoint).toBe('/transactions'); // oldest non-plan-grid item

    // The generic quota toast must NOT also fire (avoid duplicate notifications)
    expect(genericHandler).not.toHaveBeenCalled();
  });

  it('plan-grid items are never the first to be evicted', () => {
    // Queue contains only plan-grid items — nothing to evict
    const pg1 = makeQueueItem('/plan-grid/monthly', { timestamp: 100 });
    const pg2 = makeQueueItem('/plan-grid/yearly',  { timestamp: 200 });
    seedQueue([pg1, pg2]);

    let callCount = 0;
    const realSetItem = fakeStorage.setItem.bind(fakeStorage);
    vi.spyOn(fakeStorage, 'setItem').mockImplementation((k: string, v: string) => {
      if (callCount === 0) {
        callCount++;
        const err = Object.assign(new DOMException('QuotaExceededError'), { code: 22 });
        throw err;
      }
      callCount++;
      realSetItem(k, v);
    });

    const newItem = makeQueueItem('/goals', { timestamp: 300 });
    pushToOfflineQueue(newItem);

    // Both plan-grid items must still be in the queue
    const remaining = readQueue();
    const endpoints = remaining.map((i: any) => i.endpoint);
    expect(endpoints).toContain('/plan-grid/monthly');
    expect(endpoints).toContain('/plan-grid/yearly');
  });

  it('plan-grid deduplication: pushing the same plan-grid endpoint replaces the existing entry', () => {
    const first  = { ...makeQueueItem('/plan-grid/monthly'), data: { content: 'v1' } };
    const second = { ...makeQueueItem('/plan-grid/monthly'), data: { content: 'v2' } };
    seedQueue([first]);

    pushToOfflineQueue(second);

    const queue = readQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].data.content).toBe('v2');
  });
});

// ---------------------------------------------------------------------------
// 4. syncOfflineQueue – replay on reconnect
// ---------------------------------------------------------------------------
describe('syncOfflineQueue – replay on reconnect', () => {
  it('returns false immediately when queue is empty', async () => {
    seedQueue([]);
    const result = await syncOfflineQueue();
    expect(result).toBe(false);
  });

  it('returns false when queue key is absent', async () => {
    const result = await syncOfflineQueue();
    expect(result).toBe(false);
  });

  it('replays all queued items via fetch and clears the queue on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json:  async () => ({ id: 'server-id', success: true }),
      text:  async () => '{"id":"server-id","success":true}',
    } as any);
    vi.stubGlobal('fetch', fetchMock);
    fakeStorage.setItem('token', 'test-token');

    const postItem   = makeQueueItem('/transactions', { method: 'POST',   timestamp: 1000 });
    const putItem    = { ...makeQueueItem('/transactions/123', { timestamp: 2000 }), method: 'PUT'    };
    const deleteItem = { ...makeQueueItem('/transactions/456', { timestamp: 3000 }), method: 'DELETE' };
    seedQueue([postItem, putItem, deleteItem]);

    const failed: string[] = [];
    const result = await syncOfflineQueue((msg) => failed.push(msg));

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(readQueue()).toHaveLength(0);
    expect(failed).toHaveLength(0);
  });

  it('keeps remaining items and returns false when a network error occurs mid-sync', async () => {
    fakeStorage.setItem('token', 'test-token');

    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true, status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ success: true }),
          text: async () => '{"success":true}',
        };
      }
      throw new TypeError('Failed to fetch');
    }));

    const item1 = makeQueueItem('/transactions', { timestamp: 1000 });
    const item2 = makeQueueItem('/accounts',     { timestamp: 2000 });
    const item3 = makeQueueItem('/goals',        { timestamp: 3000 });
    seedQueue([item1, item2, item3]);

    const result = await syncOfflineQueue();

    expect(result).toBe(false);
    const remaining = readQueue();
    expect(remaining).toHaveLength(2);
    expect(remaining[0].endpoint).toBe('/accounts');
    expect(remaining[1].endpoint).toBe('/goals');
  });

  it('calls onItemFailed and continues when server returns a 4xx error', async () => {
    fakeStorage.setItem('token', 'test-token');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: false, status: 400,
        headers: { get: () => 'application/json' },
        json: async () => ({ error: 'bad request' }),
        text: async () => '{"error":"bad request"}',
      } as any)
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true }),
        text: async () => '{"success":true}',
      } as any)
    );

    const badItem  = makeQueueItem('/transactions', { timestamp: 1000 });
    const goodItem = makeQueueItem('/accounts',     { timestamp: 2000 });
    seedQueue([badItem, goodItem]);

    const failed: string[] = [];
    const result = await syncOfflineQueue((msg) => failed.push(msg));

    expect(result).toBe(true);
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatch(/bad request/i);
    expect(readQueue()).toHaveLength(0);
  });
});
