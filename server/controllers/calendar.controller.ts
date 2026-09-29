import * as calendarService from "../services/calendar.service";
import { notifyUser } from "../socket";

type Handler = (req: any) => Promise<unknown>;

/**
 * Runs one calendar mutation, answers with its result and tells the user's
 * other sessions to refresh the calendar (same event as the plan-grid API).
 */
function mutation(handler: Handler, successStatus = 200) {
  return async (req: any, res: any) => {
    try {
      const result = await handler(req);
      notifyUser(req.user.userId, "data:updated", { type: "plan-grid", planType: "calendar" });
      res.status(successStatus).json(result);
    } catch (error: any) {
      const status = error.status || 500;
      if (status >= 500) console.error("Calendar request failed:", error);
      res.status(status).json({ error: error.message });
    }
  };
}

export async function list(req: any, res: any) {
  try {
    res.json(await calendarService.listCalendar(req.user.userId));
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
}

export const createPlan = mutation(
  req => calendarService.createPlan(req.user.userId, req.body),
  201,
);

export const updatePlan = mutation(
  req => calendarService.updatePlan(req.user.userId, req.params.planId, req.body),
);

export const archivePlan = mutation(
  req => calendarService.archivePlan(req.user.userId, req.params.planId),
);

export const applyPlanEdit = mutation(
  req => calendarService.applyPlanEdit(req.user.userId, req.params.planId, req.body || {}),
);

export const setOccurrence = mutation(async req => {
  const completed = req.body?.completed;
  if (typeof completed !== "boolean") {
    const error: any = new Error("Поле completed должно быть boolean");
    error.status = 400;
    throw error;
  }
  return calendarService.setManualCompletion(req.user.userId, req.params.planId, req.params.date, completed);
});

export const createNote = mutation(
  req => calendarService.createNote(req.user.userId, req.body),
  201,
);

export const updateNote = mutation(
  req => calendarService.updateNote(req.user.userId, req.params.noteId, req.body),
);

export const deleteNote = mutation(
  req => calendarService.deleteNote(req.user.userId, req.params.noteId),
);
