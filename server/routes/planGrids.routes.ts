import { Router } from "express";
import { validateBody, planGridDataSchema, planGridBulkSchema } from "../../validation";
import { authenticateToken } from "../authMiddleware";
import * as planGridsController from "../controllers/planGrids.controller";

const router = Router();

router.get("/api/plan-grids", authenticateToken, planGridsController.list);
router.get("/api/plan-grid/:type", authenticateToken, planGridsController.getByType);
router.post("/api/plan-grid/:type", authenticateToken, validateBody(planGridDataSchema), planGridsController.setByType);
router.post("/api/plan-grid", authenticateToken, validateBody(planGridBulkSchema), planGridsController.setBulk);

export default router;
