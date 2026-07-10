import * as chatHistoryService from "../services/chatHistory.service";

export async function list(req: any, res: any) {
  try {
    const parsedHistory = await chatHistoryService.listChatHistory(req.user.userId);
    res.json(parsedHistory);
  } catch (error: any) {
    console.error("Fetch chat history error:", error);
    // If it's a prisma error about missing table, point that out
    if (error.code === 'P2021' || error.message?.includes('does not exist')) {
      return res.status(500).json({
        error: "Database table 'chat_messages' not found. Please run 'npx prisma db push' on your server."
      });
    }
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
}

export async function create(req: any, res: any) {
  try {
    const message = await chatHistoryService.createChatMessage(req.user.userId, req.body);
    res.json(message);
  } catch (error) {
    console.error("Save chat message error:", error);
    res.status(500).json({ error: "Failed to save message" });
  }
}

export async function update(req: any, res: any) {
  try {
    const message = await chatHistoryService.updateChatMessage(req.user.userId, req.params.id, req.body);
    res.json(message);
  } catch (error) {
    res.status(500).json({ error: "Failed to update message" });
  }
}

export async function clear(req: any, res: any) {
  try {
    await chatHistoryService.clearChatHistory(req.user.userId);
    res.json({ message: "Chat history cleared" });
  } catch (error) {
    res.status(500).json({ error: "Failed to clear chat history" });
  }
}

export async function remove(req: any, res: any) {
  try {
    await chatHistoryService.deleteChatMessage(req.user.userId, req.params.id);
    res.json({ message: "Message deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete message" });
  }
}
