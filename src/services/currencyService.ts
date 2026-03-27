import { api } from '../lib/api';
import { Currency } from '../types';

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
    }, 5000);

    this.getCurrencies().then(callback);

    return () => clearInterval(interval);
  },

  async seedDefaultCurrencies() {
    try {
      await api.post('/currencies/seed', {});
    } catch (error) {
      console.error('Error seeding currencies:', error);
    }
  }
};
