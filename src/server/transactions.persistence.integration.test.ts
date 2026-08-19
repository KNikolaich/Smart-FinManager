import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../server/prisma';
import { importBatch } from '../../server/services/import.service';
import { createTransaction, deleteTransaction, updateTransaction } from '../../server/services/transactions.service';

const describeDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeDatabase('cross-currency transfer persistence', () => {
  let userId = '';
  let currencyId = '';
  let rubAccountId = '';
  let foreignAccountId = '';

  beforeEach(async () => {
    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const currency = await prisma.currency.create({
      data: { currency: `test-${token}`, name: 'Test dollar', iso: `T${token}`.slice(0, 30), rate: 90, symbol: '$' },
    });
    currencyId = currency.id;
    const user = await prisma.user.create({
      data: { email: `transfer-${token}@example.test`, password: 'test-password' },
    });
    userId = user.id;
    const [rubAccount, foreignAccount] = await Promise.all([
      prisma.account.create({
        data: { userId, name: 'RUB', type: 'card', balance: 10_000, currency: 'RUB' },
      }),
      prisma.account.create({
        // Mirrors AccountManager: the normal UI sends currencyId, while the
        // legacy currency column remains at its database default of RUB.
        data: { userId, name: 'Foreign', type: 'card', balance: 0, currencyId },
      }),
    ]);
    rubAccountId = rubAccount.id;
    foreignAccountId = foreignAccount.id;
  });

  afterEach(async () => {
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    if (currencyId) await prisma.currency.delete({ where: { id: currencyId } }).catch(() => undefined);
  });

  async function balances() {
    const accounts = await prisma.account.findMany({ where: { id: { in: [rubAccountId, foreignAccountId] } } });
    return Object.fromEntries(accounts.map(account => [account.id, account.balance]));
  }

  it('uses the directory default, recalculates on update, and restores both balances on delete', async () => {
    const transaction = await createTransaction(userId, {
      accountId: rubAccountId,
      targetAccountId: foreignAccountId,
      amount: 9_000,
      type: 'transfer',
      description: 'buy at default quote',
    });
    expect(transaction.exchangeRate).toBe(90);
    expect(transaction.targetAmount).toBe(100);
    expect(await balances()).toMatchObject({ [rubAccountId]: 1_000, [foreignAccountId]: 100 });

    await updateTransaction(userId, transaction.id, {
      accountId: rubAccountId,
      targetAccountId: foreignAccountId,
      amount: 4_600,
      targetAmount: 50,
      exchangeRate: 92,
      type: 'transfer',
      description: 'manual quote',
    });
    expect(await balances()).toMatchObject({ [rubAccountId]: 5_400, [foreignAccountId]: 50 });

    await deleteTransaction(userId, transaction.id);
    expect(await balances()).toMatchObject({ [rubAccountId]: 10_000, [foreignAccountId]: 0 });
  });

  it('does not apply balance changes twice when the same imported transfer is re-imported', async () => {
    const importedTransaction = {
      id: `import-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      accountId: foreignAccountId,
      targetAccountId: rubAccountId,
      amount: 100,
      targetAmount: 9_200,
      exchangeRate: 92,
      type: 'transfer',
      description: 'sell at manual quote',
    };
    const payload = { transactions: [importedTransaction] };

    await importBatch(userId, payload);
    expect(await balances()).toMatchObject({ [rubAccountId]: 19_200, [foreignAccountId]: -100 });

    await importBatch(userId, payload);
    expect(await balances()).toMatchObject({ [rubAccountId]: 19_200, [foreignAccountId]: -100 });

    await importBatch(userId, {
      transactions: [{ ...importedTransaction, amount: 50, targetAmount: 4_600 }],
    });
    expect(await balances()).toMatchObject({ [rubAccountId]: 14_600, [foreignAccountId]: -50 });

    await importBatch(userId, {
      transactions: [{
        id: `invalid-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        accountId: rubAccountId,
        amount: -500,
        type: 'income',
        description: 'must be ignored',
      }],
    });
    expect(await balances()).toMatchObject({ [rubAccountId]: 14_600, [foreignAccountId]: -50 });
  });
});