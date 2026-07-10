import { prisma } from "../prisma";

export function listBalanceHistory(userId: string) {
  return prisma.balanceHistory.findMany({
    where: { userId },
    orderBy: { month: 'desc' }
  });
}

export function upsertBalanceHistory(userId: string, month: string, totalBalance: any) {
  return prisma.balanceHistory.upsert({
    where: { userId_month: { userId, month } },
    update: { totalBalance: Number(totalBalance) },
    create: { userId, month, totalBalance: Number(totalBalance) }
  });
}

export function updateBalanceHistory(userId: string, id: string, month: string, totalBalance: any) {
  return prisma.balanceHistory.update({
    where: { id, userId },
    data: { month, totalBalance: Number(totalBalance) }
  });
}

export function deleteBalanceHistory(userId: string, id: string) {
  return prisma.balanceHistory.delete({
    where: { id, userId }
  });
}
