import { Router } from "express";
import { validateBody, adminSendPasswordSchema, adminUnlockSchema } from "../../validation";
import { authenticateToken, requireAdmin } from "../authMiddleware";
import * as adminController from "../controllers/admin.controller";

const router = Router();

// --- ADMIN ROUTES ---
router.get("/api/admin/users", authenticateToken, requireAdmin, adminController.listUsers);
router.delete("/api/admin/users/:id", authenticateToken, requireAdmin, adminController.deleteUser);
router.post("/api/admin/users/:id/send-password", authenticateToken, requireAdmin, validateBody(adminSendPasswordSchema), adminController.sendUserPassword);
router.post("/api/admin/users/:id/unlock", authenticateToken, requireAdmin, validateBody(adminUnlockSchema), adminController.unlockUser);

export default router;
