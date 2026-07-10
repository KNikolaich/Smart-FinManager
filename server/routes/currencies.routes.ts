import { Router } from "express";
import { validateBody, currencyCreateSchema, currencyUpdateSchema } from "../../validation";
import { authenticateToken, requireAdmin } from "../authMiddleware";
import * as currenciesController from "../controllers/currencies.controller";

const router = Router();

router.get("/api/currencies", authenticateToken, currenciesController.list);
router.post("/api/currencies", authenticateToken, requireAdmin, validateBody(currencyCreateSchema), currenciesController.create);
router.put("/api/currencies/:id", authenticateToken, requireAdmin, validateBody(currencyUpdateSchema), currenciesController.update);
router.delete("/api/currencies/:id", authenticateToken, requireAdmin, currenciesController.remove);
router.post("/api/currencies/seed", authenticateToken, requireAdmin, currenciesController.seed);
router.get("/api/currencies/rates/:iso", authenticateToken, currenciesController.rates);

export default router;
