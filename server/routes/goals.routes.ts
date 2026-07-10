import { Router } from "express";
import { validateBody, goalCreateSchema, goalUpdateSchema } from "../../validation";
import { authenticateToken } from "../authMiddleware";
import * as goalsController from "../controllers/goals.controller";

const router = Router();

router.get("/api/goals", authenticateToken, goalsController.list);
router.post("/api/goals", authenticateToken, validateBody(goalCreateSchema), goalsController.create);
router.put("/api/goals/:id", authenticateToken, validateBody(goalUpdateSchema), goalsController.update);
router.delete("/api/goals/:id", authenticateToken, goalsController.remove);

export default router;
