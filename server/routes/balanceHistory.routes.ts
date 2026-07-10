import { Router } from "express";
import { validateBody, balanceHistoryCreateSchema, balanceHistoryUpdateSchema } from "../../validation";
import { authenticateToken } from "../authMiddleware";
import * as balanceHistoryController from "../controllers/balanceHistory.controller";

const router = Router();

router.get("/api/balance-history", authenticateToken, balanceHistoryController.list);
router.post("/api/balance-history", authenticateToken, validateBody(balanceHistoryCreateSchema), balanceHistoryController.create);
router.put("/api/balance-history/:id", authenticateToken, validateBody(balanceHistoryUpdateSchema), balanceHistoryController.update);
router.delete("/api/balance-history/:id", authenticateToken, balanceHistoryController.remove);

export default router;
