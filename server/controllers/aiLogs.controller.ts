import * as aiLogsService from "../services/aiLogs.service";

export async function list(req: any, res: any) {
  try {
    const logs = await aiLogsService.listAiLogs(req.user.userId);
    res.json(logs);
  } catch (error) {
    console.error("Fetch AI Logs Error:", error);
    res.status(500).json({ error: "Failed to fetch AI logs" });
  }
}

export async function create(req: any, res: any) {
  try {
    const log = await aiLogsService.createAiLog(req.user.userId, req.body);
    res.json(log);
  } catch (error) {
    console.error("AI Log Save Error:", error);
    res.status(500).json({ error: "Failed to save AI log" });
  }
}
