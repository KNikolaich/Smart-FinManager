import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../server/prisma', () => ({
  prisma: {
    currency: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '../../server/prisma';
import { resolveConversionFields } from '../../server/services/transactions.service';

const rubAccount = { currency: 'RUB', currencyId: null };
const usdAccount = { currency: 'USD', currencyId: 'usd' };

describe('server conversion recalculation', () => {
  beforeEach(() => {
    const rubCurrency = {
      id: 'rub',
      currency: 'рубль',
      name: 'Рубль',
      iso: 'RUB',
      rate: 1,
      symbol: '₽',
    } as never;
    const usdCurrency = {
      id: 'usd',
      currency: 'доллар',
      name: 'Доллар',
      iso: 'USD',
      rate: 90,
      symbol: '$',
    } as never;
    vi.mocked(prisma.currency.findFirst).mockResolvedValue(rubCurrency);
    vi.mocked(prisma.currency.findUnique).mockResolvedValue(usdCurrency);
  });

  it('credits USD from RUB using the human-readable quote "1 USD = 90 RUB"', async () => {
    await expect(resolveConversionFields('transfer', 9_000, {
      accountId: 'rub',
      targetAccountId: 'usd',
      targetAmount: 100,
      exchangeRate: 90,
    }, rubAccount, usdAccount)).resolves.toEqual({
      targetAmount: 100,
      exchangeRate: 90,
    });
  });

  it('credits RUB from USD using that same USD quote', async () => {
    await expect(resolveConversionFields('transfer', 100, {
      accountId: 'usd',
      targetAccountId: 'rub',
      targetAmount: 9_000,
      exchangeRate: 90,
    }, usdAccount, rubAccount)).resolves.toEqual({
      targetAmount: 9_000,
      exchangeRate: 90,
    });
  });

  it('calculates the credited amount when the client sends only a manual quote', async () => {
    await expect(resolveConversionFields('transfer', 9_200, {
      accountId: 'rub',
      targetAccountId: 'usd',
      exchangeRate: 92,
    }, rubAccount, usdAccount)).resolves.toEqual({
      targetAmount: 100,
      exchangeRate: 92,
    });
  });

  it('uses Currency.rate when a cross-currency transfer has no manual quote', async () => {
    await expect(resolveConversionFields('transfer', 9_000, {
      accountId: 'rub',
      targetAccountId: 'usd',
    }, rubAccount, usdAccount)).resolves.toEqual({
      targetAmount: 100,
      exchangeRate: 90,
    });
  });

  it('does not accept a target-only amount that conflicts with Currency.rate', async () => {
    await expect(resolveConversionFields('transfer', 9_000, {
      accountId: 'rub',
      targetAccountId: 'usd',
      targetAmount: 99,
    }, rubAccount, usdAccount)).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a client-supplied credited amount that does not match the ruble quote', async () => {
    await expect(resolveConversionFields('transfer', 9_000, {
      accountId: 'rub',
      targetAccountId: 'usd',
      targetAmount: 99,
      exchangeRate: 90,
    }, rubAccount, usdAccount)).rejects.toMatchObject({ status: 400 });
  });
});