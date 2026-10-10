import { Router } from "express";
import { noteImageSchema, validateBody } from "../../validation";
import { authenticateToken } from "../authMiddleware";
import * as noteImagesController from "../controllers/noteImages.controller";

const router = Router();

router.put("/api/note-images/:id", authenticateToken, validateBody(noteImageSchema), noteImagesController.put);
router.get("/api/note-images/:id", authenticateToken, noteImagesController.get);

export default router;
