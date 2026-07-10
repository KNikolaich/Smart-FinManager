import { Router } from "express";
import { validateBody, accountCreateSchema, accountUpdateSchema } from "../../validation";
import { authenticateToken } from "../authMiddleware";
import * as accountsController from "../controllers/accounts.controller";

const router = Router();

router.get("/api/accounts", authenticateToken, accountsController.list);
router.post("/api/accounts", authenticateToken, validateBody(accountCreateSchema), accountsController.create);
router.put("/api/accounts/:id", authenticateToken, validateBody(accountUpdateSchema), accountsController.update);
router.delete("/api/accounts/:id", authenticateToken, accountsController.remove);

export default router;
