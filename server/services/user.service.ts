import { prisma } from "../prisma";

export function getProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      photoURL: true,
      role: true,
      settings: true,
      createdAt: true
    }
  });
}

export function deleteAccount(userId: string) {
  // With onDelete: Cascade set up in the schema, deleting the user
  // will automatically wipe all associated data in other tables.
  return prisma.user.delete({ where: { id: userId } });
}

export function clearTransactions(userId: string) {
  return prisma.$transaction([
    prisma.transaction.deleteMany({ where: { userId } }),
    prisma.account.updateMany({
      where: { userId },
      data: { balance: 0 }
    }),
    prisma.aiLog.deleteMany({ where: { userId } }),
    prisma.balanceHistory.deleteMany({ where: { userId } }),
    prisma.chatMessage.deleteMany({ where: { userId } }),
  ]);
}
