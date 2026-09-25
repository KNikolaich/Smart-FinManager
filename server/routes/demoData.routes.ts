import { Router } from "express";
import { authenticateToken } from "../authMiddleware";
import * as demoDataController from "../controllers/demoData.controller";

const router = Router();

router.post("/api/demo-data/generate", authenticateToken, demoDataController.generate);
router.post("/api/demo-data/calendar", authenticateToken, demoDataController.addCalendarData);

export default router;