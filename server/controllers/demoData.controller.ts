import { notifyUser } from "../socket";
import { DemoDataServiceError, generateDemoData } from "../services/demoData.service";

export async function generate(req: any, res: any) {
  try {
    const result = await generateDemoData(req.user.userId);
    for (const type of ["accounts", "categories", "transactions", "goals", "balance-history", "profile"]) {
      notifyUser(req.user.userId, "data:updated", { type });
    }
    notifyUser(req.user.userId, "data:updated", { type: "plan-grid", planType: "cashback" });
    res.json({ success: true, ...result });
  } catch (error: any) {
    if (error instanceof DemoDataServiceError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Demo data generation failed:", error);
    res.status(500).json({ error: "Не удалось создать демо-данные" });
  }
}