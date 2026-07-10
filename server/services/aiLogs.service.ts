import { prisma } from "../prisma";

export function listAiLogs(userId: string) {
  return prisma.aiLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function createAiLog(userId: string, body: any) {
  const { request: aiRequest, response: aiResponse, provider } = body;

  const log = await prisma.aiLog.create({
    data: {
      userId,
      request: aiRequest || {},
      response: aiResponse || {},
      provider: provider || "gemini",
    },
  });

  // Cleanup old logs (keep last 100)
  try {
    const count = await prisma.aiLog.count({ where: { userId } });
    if (count > 100) {
      const oldest = await prisma.aiLog.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        take: count - 100,
      });
      await prisma.aiLog.deleteMany({
        where: { id: { in: oldest.map(l => l.id) } },
      });
    }
  } catch (cleanupError) {
    console.error("AI Log Cleanup Error:", cleanupError);
    // Don't fail the request if cleanup fails
  }

  return log;
}
