import { api, getCacheTimestamp, safeStorage } from '../lib/api';
import { Currency } from '../types';

export interface RateHistoryPoint {
  timestamp?: string;
  buyRate?: number;
  sellRate?: number;
  spread?: number;
  spreadPercent?: number;
  /** Legacy shape kept for consumers that compare old cached histories. */
  date?: string;
  rate?: number;
}

export interface BankRate {
  iso: string;
  buyRate: number;
  sellRate: number;
  midRate: number;
}

export interface BankRatesResponse {
  source: string;
  quoteType: string;
  quotedAt: string;
  rates: BankRate[];
}

export interface CryptoRatesResponse {
  source: 'coingecko' | string;
  quoteType: 'market' | string;
  quotedAt: string;
  rates: Record<string, number>;
}

export interface RateHistoryResponse {
  iso: string;
  days: number;
  source: string;
  quoteType: string;
  points: RateHistoryPoint[];
  refreshing?: boolean;
}

export interface RateChange {
  absolute: number;
  percent: number | null;
  direction: 'up' | 'down' | 'flat';
}

/**
 * Compares the first and last points in an already chronologically ordered
 * rate history. A null percentage means the first rate cannot be used as a
 * percentage baseline (for example, when it is zero).
 */
export function getRateChange(points: RateHistoryPoint[]): RateChange | null {
  if (points.length < 2) return null;

  const midpoint = (point: RateHistoryPoint) =>
    point.rate ?? ((point.buyRate ?? 0) + (point.sellRate ?? 0)) / 2;
  const firstRate = midpoint(points[0]);
  const lastRate = midpoint(points[points.length - 1]);
  if (!Number.isFinite(firstRate) || !Number.isFinite(lastRate)) return null;

  const absolute = lastRate - firstRate;
  return {
    absolute,
    percent: firstRate === 0 ? null : (absolute / firstRate) * 100,
    direction: absolute > 0 ? 'up' : absolute < 0 ? 'down' : 'flat',
  };
}

export const currencyService = {
  getCachedCurrencies(): Currency[] | null {
    const raw = safeStorage.getItem('api_cache_/currencies');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },

  getCachedRateHistory(iso: string, days: number): RateHistoryResponse | null {
    const endpoint = `/currencies/history/${encodeURIComponent(iso)}?days=${days}`;
    const raw = safeStorage.getItem(`api_cache_${endpoint}`);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && Array.isArray(parsed.points) ? parsed : null;
    } catch {
      return null;
    }
  },

  hasFreshCache(endpoint: string): boolean {
    const timestamp = getCacheTimestamp(endpoint);
    if (timestamp === null) return false;
    const dateKey = (date: Date) => [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
    return dateKey(new Date(timestamp)) === dateKey(new Date());
  },

  async getCurrencies(): Promise<Currency[]> {
    return await api.get('/currencies');
  },

  subscribeToCurrencies(callback: (currencies: Currency[]) => void) {
    // Polling as a fallback for real-time since we don't have WebSockets yet
    const interval = setInterval(async () => {
      const currencies = await this.getCurrencies();
      callback(currencies);
    }, 30000); // Increased to 30 seconds

    this.getCurrencies().then(callback);

    return () => clearInterval(interval);
  },

  async updateCurrency(currency: Currency): Promise<void> {
    // The record id belongs in the URL. The update schema intentionally
    // rejects server-controlled fields in the request body.
    const { id, buyRate, sellRate, rateSource, rateUpdatedAt, ...changes } = currency;
    await api.put(`/currencies/${id}`, {
      ...changes,
      iso: changes.iso.trim().toUpperCase(),
    });
  },

  async deleteCurrency(id: string): Promise<void> {
    await api.delete(`/currencies/${id}`);
  },

  async addCurrency(currency: Omit<Currency, 'id'>): Promise<void> {
    await api.post('/currencies', currency);
  },

  async getCryptoRates(): Promise<CryptoRatesResponse> {
    return await api.get('/currencies/crypto-rates');
  },

  async refreshCryptoRates(): Promise<CryptoRatesResponse> {
    return await api.post('/currencies/crypto-rates/refresh', {});
  },

  async refreshBankRates(): Promise<BankRatesResponse> {
    return await api.post('/currencies/bank-rates/refresh', {});
  },

  async getRateHistory(iso: string, days: number): Promise<RateHistoryResponse> {
    return await api.get(`/currencies/history/${encodeURIComponent(iso)}?days=${days}`);
  },

  async seedDefaultCurrencies() {
    try {
      await api.post('/currencies/seed', {});
    } catch (error) {
      console.error('Error seeding currencies:', error);
    }
  }
};
