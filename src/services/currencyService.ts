import { api } from '../lib/api';
import { Currency } from '../types';

export interface RateHistoryPoint {
  date: string;
  rate: number;
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

  const firstRate = points[0].rate;
  const lastRate = points[points.length - 1].rate;
  if (!Number.isFinite(firstRate) || !Number.isFinite(lastRate)) return null;

  const absolute = lastRate - firstRate;
  return {
    absolute,
    percent: firstRate === 0 ? null : (absolute / firstRate) * 100,
    direction: absolute > 0 ? 'up' : absolute < 0 ? 'down' : 'flat',
  };
}

export const currencyService = {
  async getCurrencies(): Promise<Currency[]> {
    try {
      return await api.get('/currencies');
    } catch (error) {
      console.error('Error fetching currencies:', error);
      return [];
    }
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
    const { id, ...changes } = currency;
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

  async getCryptoRates(): Promise<{ rates: Record<string, number> }> {
    return await api.get('/currencies/crypto-rates');
  },

  async getRateHistory(iso: string): Promise<{ iso: string; days: number; points: RateHistoryPoint[] }> {
    return await api.get(`/currencies/history/${encodeURIComponent(iso)}`);
  },

  async seedDefaultCurrencies() {
    try {
      await api.post('/currencies/seed', {});
    } catch (error) {
      console.error('Error seeding currencies:', error);
    }
  }
};
