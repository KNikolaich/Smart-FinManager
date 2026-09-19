import * as planGridsService from "../services/planGrids.service";
import * as calendarService from "../services/calendar.service";
import { notifyUser } from "../socket";

export async function list(req: any, res: any) {
  try {
    const userId = req.user.userId;
    const planGrids = await planGridsService.listPlanGrids(userId);
    res.json(planGrids);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getByType(req: any, res: any) {
  try {
    const { type } = req.params;
    const userId = req.user.userId;
    if (type === "calendar") {
      return res.json(await calendarService.listCalendar(userId));
    }
    const data = await planGridsService.getPlanGrid(userId, type);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function setByType(req: any, res: any) {
  try {
    const { type } = req.params;
    const userId = req.user.userId;
    const data = req.body;

    if (type === "calendar") {
      const payments = Array.isArray(data?.payments) ? data.payments : [];
      const result = await calendarService.replaceCalendar(userId, payments);
      notifyUser(userId, "data:updated", { type: "plan-grid", planType: "calendar" });
      return res.json(result);
    }

    const result = await planGridsService.setPlanGrid(userId, type, data);
    notifyUser(userId, "data:updated", { type: "plan-grid", planType: type });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function setCalendarOccurrence(req: any, res: any) {
  try {
    const { planId, date } = req.params;
    const completed = req.body?.completed;
    if (typeof completed !== "boolean") {
      return res.status(400).json({ error: "Поле completed должно быть boolean" });
    }
    const result = await calendarService.setManualCompletion(
      req.user.userId,
      planId,
      date,
      completed,
    );
    notifyUser(req.user.userId, "data:updated", { type: "plan-grid", planType: "calendar" });
    res.json(result);
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
}

export async function setBulk(req: any, res: any) {
  try {
    const userId = req.user.userId;
    const data = req.body;

    await planGridsService.setPlanGridBulk(userId, data);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Bulk Plan Grid Save Error:", error);
    res.status(500).json({ error: error.message });
  }
}
