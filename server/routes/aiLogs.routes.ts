import { Router } from "express";
import { validateBody, aiLogCreateSchema } from "../../validation";
import { authenticateToken } from "../authMiddleware";
import * as aiLogsController from "../controllers/aiLogs.controller";

const router = Router();

router.get("/api/ai-logs", authenticateToken, aiLogsController.list);
router.post("/api/ai-logs", authenticateToken, validateBody(aiLogCreateSchema), aiLogsController.create);

export default router;
