import express, { Router } from "express";
import { validateBody, adminSendPasswordSchema, adminUnlockSchema, backupRestoreSchema } from "../../validation";
import { authenticateToken, requireAdmin } from "../authMiddleware";
import * as adminController from "../controllers/admin.controller";
import * as backupController from "../controllers/backup.controller";

const router = Router();

// --- ADMIN ROUTES ---
router.get("/api/admin/users", authenticateToken, requireAdmin, adminController.listUsers);
router.delete("/api/admin/users/:id", authenticateToken, requireAdmin, adminController.deleteUser);
router.post("/api/admin/users/:id/send-password", authenticateToken, requireAdmin, validateBody(adminSendPasswordSchema), adminController.sendUserPassword);
router.post("/api/admin/users/:id/unlock", authenticateToken, requireAdmin, validateBody(adminUnlockSchema), adminController.unlockUser);
router.post(
  "/api/admin/users/:id/backup/restore",
  authenticateToken,
  requireAdmin,
  express.json({ limit: "100mb" }),
  validateBody(backupRestoreSchema),
  backupController.restoreForAdminTarget,
);
router.get("/api/admin/backup/export", authenticateToken, requireAdmin, backupController.exportAdmin);
router.post(
  "/api/admin/backup/restore",
  authenticateToken,
  requireAdmin,
  express.json({ limit: "100mb" }),
  validateBody(backupRestoreSchema),
  backupController.restoreAdmin,
);

// Database schema sync (runs prisma db push server-side)
router.get("/api/admin/db-status", authenticateToken, requireAdmin, adminController.dbStatus);
router.post("/api/admin/db-migrate", authenticateToken, requireAdmin, adminController.migrateDb);

export default router;
