import { Router } from "express";
import { authenticateToken } from "../authMiddleware";
import * as aiProxyController from "../controllers/aiProxy.controller";

const router = Router();

// AI Proxy Routes
router.post("/api/ai/openai", authenticateToken, aiProxyController.openai);
router.post("/api/ai/deepseek", authenticateToken, aiProxyController.deepseek);

export default router;
