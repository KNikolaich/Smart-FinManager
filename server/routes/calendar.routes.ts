import { Router } from "express";
import {
  calendarNoteSchema,
  calendarOccurrenceSchema,
  calendarPlanEditSchema,
  calendarPlanSchema,
  validateBody,
} from "../../validation";
import { authenticateToken } from "../authMiddleware";
import * as calendarController from "../controllers/calendar.controller";

// Per-plan calendar API. The legacy full-calendar POST /api/plan-grid/calendar
// is kept only so requests already waiting in offline queues still sync.
const router = Router();

router.get("/api/calendar", authenticateToken, calendarController.list);

router.post("/api/calendar/plans", authenticateToken, validateBody(calendarPlanSchema), calendarController.createPlan);
router.put("/api/calendar/plans/:planId", authenticateToken, validateBody(calendarPlanSchema), calendarController.updatePlan);
router.delete("/api/calendar/plans/:planId", authenticateToken, calendarController.archivePlan);
router.post("/api/calendar/plans/:planId/edit", authenticateToken, validateBody(calendarPlanEditSchema), calendarController.applyPlanEdit);
router.post("/api/calendar/plans/:planId/occurrences/:date", authenticateToken, validateBody(calendarOccurrenceSchema), calendarController.setOccurrence);

router.post("/api/calendar/notes", authenticateToken, validateBody(calendarNoteSchema), calendarController.createNote);
router.put("/api/calendar/notes/:noteId", authenticateToken, validateBody(calendarNoteSchema), calendarController.updateNote);
router.delete("/api/calendar/notes/:noteId", authenticateToken, calendarController.deleteNote);

export default router;
