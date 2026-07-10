import { Router } from "express";
import { authenticateToken, requireAdmin } from "../authMiddleware";
import * as adminController from "../controllers/admin.controller";

const router = Router();

// --- ADMIN ROUTES ---
router.get("/api/admin/users", authenticateToken, requireAdmin, adminController.listUsers);
router.delete("/api/admin/users/:id", authenticateToken, requireAdmin, adminController.deleteUser);
router.post("/api/admin/users/:id/send-password", authenticateToken, requireAdmin, adminController.sendUserPassword);

export default router;
