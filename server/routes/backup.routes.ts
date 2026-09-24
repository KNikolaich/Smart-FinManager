import express, { Router } from "express";
import { backupRestoreSchema, validateBody } from "../../validation";
import { authenticateToken } from "../authMiddleware";
import * as backupController from "../controllers/backup.controller";

const router = Router();

router.get("/api/backup/export", authenticateToken, backupController.exportUser);
router.post(
  "/api/backup/restore",
  authenticateToken,
  express.json({ limit: "100mb" }),
  validateBody(backupRestoreSchema),
  backupController.restoreUser,
);

export default router;