import { Router } from "express";
import { validateBody, planGridDataSchema } from "../../validation";
import { authenticateToken } from "../authMiddleware";
import * as calendarController from "../controllers/calendar.controller";

// Per-plan calendar API. The legacy full-calendar POST /api/plan-grid/calendar
// is kept only so requests already waiting in offline queues still sync.
const router = Router();
const body = validateBody(planGridDataSchema);

router.get("/api/calendar", authenticateToken, calendarController.list);

router.post("/api/calendar/plans", authenticateToken, body, calendarController.createPlan);
router.put("/api/calendar/plans/:planId", authenticateToken, body, calendarController.updatePlan);
router.delete("/api/calendar/plans/:planId", authenticateToken, calendarController.archivePlan);
router.post("/api/calendar/plans/:planId/edit", authenticateToken, body, calendarController.applyPlanEdit);
router.post("/api/calendar/plans/:planId/occurrences/:date", authenticateToken, body, calendarController.setOccurrence);

router.post("/api/calendar/notes", authenticateToken, body, calendarController.createNote);
router.put("/api/calendar/notes/:noteId", authenticateToken, body, calendarController.updateNote);
router.delete("/api/calendar/notes/:noteId", authenticateToken, calendarController.deleteNote);

export default router;
