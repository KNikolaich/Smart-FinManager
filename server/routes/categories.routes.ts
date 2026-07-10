import { Router } from "express";
import { validateBody, categoryCreateSchema, categoryUpdateSchema } from "../../validation";
import { authenticateToken } from "../authMiddleware";
import * as categoriesController from "../controllers/categories.controller";

const router = Router();

router.get("/api/categories", authenticateToken, categoriesController.list);
router.post("/api/categories", authenticateToken, validateBody(categoryCreateSchema), categoriesController.create);
router.put("/api/categories/:id", authenticateToken, validateBody(categoryUpdateSchema), categoriesController.update);
router.delete("/api/categories/:id", authenticateToken, categoriesController.remove);

export default router;
