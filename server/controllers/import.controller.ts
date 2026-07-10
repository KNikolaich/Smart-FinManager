import * as importService from "../services/import.service";

export async function batch(req: any, res: any) {
  try {
    await importService.importBatch(req.user.userId, req.body);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Batch Import Error:", error);
    res.status(500).json({ error: error.message });
  }
}
