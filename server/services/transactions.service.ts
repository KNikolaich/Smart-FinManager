import { prisma } from "../prisma";

export function listTransactions(userId: string) {
  return prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });
}

export async function createTransaction(userId: string, body: any) {
  const { accountId, targetAccountId, amount, type, categoryId, subcategoryId, description, createdAt } = body;
  const numAmount = Number(amount);

  if (isNaN(numAmount)) {
    const err: any = new Error("Invalid amount");
    err.status = 400;
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        userId,
        accountId,
        targetAccountId: targetAccountId || null,
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
        amount: numAmount,
        type,
        description: description || '',
        createdAt: createdAt ? new Date(createdAt) : new Date()
      },
    });

    if (type === 'expense') {
      await tx.account.update({
        where: { id: accountId },
        data: { balance: { decrement: numAmount } }
      });
    } else if (type === 'income') {
      await tx.account.update({
        where: { id: accountId },
        data: { balance: { increment: numAmount } }
      });
    } else if (type === 'transfer' && targetAccountId) {
      await tx.account.update({
        where: { id: accountId },
        data: { balance: { decrement: numAmount } }
      });
      await tx.account.update({
        where: { id: targetAccountId },
        data: { balance: { increment: numAmount } }
      });
    }

    return transaction;
  });
}

export async function deleteTransaction(id: string) {
  const transaction = await prisma.transaction.findUnique({ where: { id } });
  if (!transaction) {
    const err: any = new Error("Transaction not found");
    err.status = 404;
    throw err;
  }

  await prisma.$transaction(async (tx) => {
    if (transaction.type === 'expense') {
      await tx.account.update({
        where: { id: transaction.accountId },
        data: { balance: { increment: transaction.amount } }
      });
    } else if (transaction.type === 'income') {
      await tx.account.update({
        where: { id: transaction.accountId },
        data: { balance: { decrement: transaction.amount } }
      });
    } else if (transaction.type === 'transfer' && transaction.targetAccountId) {
      await tx.account.update({
        where: { id: transaction.accountId },
        data: { balance: { increment: transaction.amount } }
      });
      await tx.account.update({
        where: { id: transaction.targetAccountId },
        data: { balance: { decrement: transaction.amount } }
      });
    }

    await tx.transaction.delete({ where: { id } });
  });
}

export async function updateTransaction(id: string, body: any) {
  const { accountId, targetAccountId, amount, type, categoryId, subcategoryId, description, createdAt } = body;
  const numAmount = Number(amount);

  if (isNaN(numAmount)) {
    const err: any = new Error("Invalid amount");
    err.status = 400;
    throw err;
  }

  const oldTransaction = await prisma.transaction.findUnique({ where: { id } });
  if (!oldTransaction) {
    const err: any = new Error("Transaction not found");
    err.status = 404;
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    // 1. Revert old balance changes
    if (oldTransaction.type === 'expense') {
      await tx.account.update({
        where: { id: oldTransaction.accountId },
        data: { balance: { increment: oldTransaction.amount } }
      });
    } else if (oldTransaction.type === 'income') {
      await tx.account.update({
        where: { id: oldTransaction.accountId },
        data: { balance: { decrement: oldTransaction.amount } }
      });
    } else if (oldTransaction.type === 'transfer' && oldTransaction.targetAccountId) {
      await tx.account.update({
        where: { id: oldTransaction.accountId },
        data: { balance: { increment: oldTransaction.amount } }
      });
      await tx.account.update({
        where: { id: oldTransaction.targetAccountId },
        data: { balance: { decrement: oldTransaction.amount } }
      });
    }

    // 2. Update transaction
    const updatedTransaction = await tx.transaction.update({
      where: { id },
      data: {
        accountId,
        targetAccountId: targetAccountId || null,
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
        amount: numAmount,
        type,
        description: description || '',
        createdAt: createdAt ? new Date(createdAt) : new Date()
      },
    });

    // 3. Apply new balance changes
    if (type === 'expense') {
      await tx.account.update({
        where: { id: accountId },
        data: { balance: { decrement: numAmount } }
      });
    } else if (type === 'income') {
      await tx.account.update({
        where: { id: accountId },
        data: { balance: { increment: numAmount } }
      });
    } else if (type === 'transfer' && targetAccountId) {
      await tx.account.update({
        where: { id: accountId },
        data: { balance: { decrement: numAmount } }
      });
      await tx.account.update({
        where: { id: targetAccountId },
        data: { balance: { increment: numAmount } }
      });
    }

    return updatedTransaction;
  });
}
