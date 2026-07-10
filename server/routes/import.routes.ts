import { Router } from "express";
import { validateBody, importBatchSchema } from "../../validation";
import { authenticateToken } from "../authMiddleware";
import * as importController from "../controllers/import.controller";

const router = Router();

// --- IMPORT ROUTES ---
router.post("/api/import/batch", authenticateToken, validateBody(importBatchSchema), importController.batch);

export default router;
