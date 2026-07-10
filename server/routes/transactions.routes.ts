import { Router } from "express";
import { validateBody, transactionCreateSchema, transactionUpdateSchema } from "../../validation";
import { authenticateToken } from "../authMiddleware";
import * as transactionsController from "../controllers/transactions.controller";

const router = Router();

router.get("/api/transactions", authenticateToken, transactionsController.list);
router.post("/api/transactions", authenticateToken, validateBody(transactionCreateSchema), transactionsController.create);
router.delete("/api/transactions/:id", authenticateToken, transactionsController.remove);
router.put("/api/transactions/:id", authenticateToken, validateBody(transactionUpdateSchema), transactionsController.update);

export default router;
