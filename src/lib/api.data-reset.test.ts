import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLocalUserDataAfterReset } from './api';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
}

const storage = new MemoryStorage();

describe('clearLocalUserDataAfterReset', () => {
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal('localStorage', storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('drops pending personal-data writes and caches but keeps categories and currencies', () => {
    storage.setItem('api_offline_queue', JSON.stringify([
      { method: 'POST', endpoint: '/transactions', data: { amount: 10 } },
      {
        method: 'POST',
        endpoint: '/plan-grid/cashback',
        data: {
          categories: [{ id: 'local-food', name: 'Еда' }],
          months: [{ id: '2026-09', entries: [{ id: 'entry' }] }],
        },
      },
      { method: 'POST', endpoint: '/categories', data: { name: 'Еда' } },
      { method: 'PUT', endpoint: '/currencies/eur', data: { rate: 100 } },
    ]));
    storage.setItem('api_cache_/plan-grid/calendar', 'stale-calendar');
    storage.setItem('api_cache_timestamp_/plan-grid/cashback', '123');
    storage.setItem('api_cache_/initial-data', 'stale-initial-data');
    storage.setItem('api_cache_/categories', 'category-cache');
    storage.setItem('api_cache_/currencies', 'currency-cache');

    clearLocalUserDataAfterReset();

    expect(JSON.parse(storage.getItem('api_offline_queue') || '[]')).toEqual([
      {
        method: 'POST',
        endpoint: '/plan-grid/cashback',
        data: {
          categories: [{ id: 'local-food', name: 'Еда' }],
          months: [],
          entries: [],
        },
      },
      { method: 'POST', endpoint: '/categories', data: { name: 'Еда' } },
      { method: 'PUT', endpoint: '/currencies/eur', data: { rate: 100 } },
    ]);
    expect(storage.getItem('api_cache_/plan-grid/calendar')).toBeNull();
    expect(storage.getItem('api_cache_timestamp_/plan-grid/cashback')).toBeNull();
    expect(storage.getItem('api_cache_/initial-data')).toBeNull();
    expect(storage.getItem('api_cache_/categories')).toBe('category-cache');
    expect(storage.getItem('api_cache_/currencies')).toBe('currency-cache');
  });
});