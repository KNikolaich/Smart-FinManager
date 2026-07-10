import { prisma } from "../prisma";

export function listAccounts(userId: string) {
  return prisma.account.findMany({ where: { userId } });
}

export function createAccount(userId: string, data: any) {
  return prisma.account.create({ data: { ...data, userId } });
}

export function updateAccount(userId: string, id: string, data: any) {
  return prisma.account.update({ where: { id, userId }, data });
}

export function deleteAccount(userId: string, id: string) {
  return prisma.account.delete({ where: { id, userId } });
}
