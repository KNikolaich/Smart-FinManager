import { prisma } from "../prisma";

export async function listChatHistory(userId: string) {
  const history = await prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return history.map((m: any) => ({
    ...m,
    actionData: m.actionData ? JSON.parse(m.actionData) : null
  }));
}

export function createChatMessage(userId: string, body: any) {
  const { role, content, type, actionType, actionData, attachments } = body;
  return prisma.chatMessage.create({
    data: {
      userId,
      role,
      content,
      type,
      actionType,
      actionData: actionData ? JSON.stringify(actionData) : null,
      attachments: attachments || null,
    },
  });
}

export function updateChatMessage(userId: string, id: string, body: any) {
  const { content, type } = body;
  return prisma.chatMessage.update({
    where: { id, userId },
    data: { content, type },
  });
}

export function clearChatHistory(userId: string) {
  return prisma.chatMessage.deleteMany({ where: { userId } });
}

export function deleteChatMessage(userId: string, id: string) {
  return prisma.chatMessage.delete({ where: { id, userId } });
}
