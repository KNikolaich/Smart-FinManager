import { prisma } from "../prisma";

export function listCategories(userId: string) {
  return prisma.category.findMany({
    where: { userId },
    include: { children: true }
  });
}

export function createCategory(userId: string, body: any) {
  const { parentId, ...data } = body;
  const createData: any = { ...data, userId };

  if (parentId) {
    createData.parentId = parentId;
  }

  return prisma.category.create({ data: createData });
}

export function updateCategory(userId: string, id: string, body: any) {
  const { parentId, ...data } = body;
  const updateData: any = { ...data };

  if (parentId === null) {
    updateData.parentId = null;
  } else if (parentId) {
    updateData.parentId = parentId;
  }

  return prisma.category.update({ where: { id, userId }, data: updateData });
}

export function deleteCategory(userId: string, id: string) {
  return prisma.category.delete({ where: { id, userId } });
}
