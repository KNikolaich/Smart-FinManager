import { prisma } from "../prisma";

export function listGoals(userId: string) {
  return prisma.goal.findMany({ where: { userId } });
}

export function createGoal(userId: string, body: any) {
  const { targetAmount, currentAmount, deadline, ...rest } = body;
  return prisma.goal.create({
    data: {
      ...rest,
      targetAmount: Number(targetAmount),
      currentAmount: Number(currentAmount || 0),
      deadline: deadline ? new Date(deadline) : null,
      userId
    },
  });
}

export function updateGoal(userId: string, id: string, body: any) {
  const { targetAmount, currentAmount, deadline, ...rest } = body;
  const updateData: any = { ...rest };
  if (targetAmount !== undefined) updateData.targetAmount = Number(targetAmount);
  if (currentAmount !== undefined) updateData.currentAmount = Number(currentAmount);
  if (deadline !== undefined) updateData.deadline = deadline ? new Date(deadline) : null;

  return prisma.goal.update({
    where: { id, userId },
    data: updateData,
  });
}

export function deleteGoal(userId: string, id: string) {
  return prisma.goal.delete({ where: { id, userId } });
}
