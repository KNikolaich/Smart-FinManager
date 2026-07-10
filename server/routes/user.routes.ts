import { Router } from "express";
import { authenticateToken } from "../authMiddleware";
import * as userController from "../controllers/user.controller";

const router = Router();

// Account Deletion
router.get("/api/user/profile", authenticateToken, userController.getProfile);
router.delete("/api/user/delete-account", authenticateToken, userController.deleteAccount);
router.delete("/api/data/clear-transactions", authenticateToken, userController.clearTransactions);

export default router;
