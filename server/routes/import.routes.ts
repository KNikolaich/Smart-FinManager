import { Router } from "express";
import { authenticateToken } from "../authMiddleware";
import * as importController from "../controllers/import.controller";

const router = Router();

// --- IMPORT ROUTES ---
router.post("/api/import/batch", authenticateToken, importController.batch);

export default router;
