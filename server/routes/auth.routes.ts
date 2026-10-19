import { Router } from "express";
import { validateBody, registerSchema, loginSchema, forgotPasswordSchema, verifyPasswordSchema, updateProfileSchema } from "../../validation";
import { authenticateToken } from "../authMiddleware";
import { strictAuthLimiter, registerLimiter, oauthLimiter } from "../rateLimiters";
import * as authController from "../controllers/auth.controller";
import * as oauthController from "../controllers/oauth.controller";

const router = Router();

router.post("/api/auth/register", registerLimiter, validateBody(registerSchema), authController.register);
router.post("/api/auth/login", strictAuthLimiter, validateBody(loginSchema), authController.login);

// --- SIGN-IN THROUGH GOOGLE / YANDEX / MAIL.RU / VK ---
router.get("/api/auth/oauth/providers", oauthController.listProviders);
router.get("/api/auth/oauth/:provider/start", oauthLimiter, oauthController.start);
router.get("/api/auth/oauth/:provider/callback", oauthController.callback);

// --- COMBINED DATA ENDPOINT ---
router.get("/api/initial-data", authenticateToken, authController.getInitialData);

router.get("/api/auth/me", authenticateToken, authController.getMe);
router.put("/api/auth/me", authenticateToken, validateBody(updateProfileSchema), authController.updateMe);
router.post("/api/auth/verify-password", authenticateToken, validateBody(verifyPasswordSchema), authController.verifyPassword);
router.post("/api/auth/forgot-password", strictAuthLimiter, validateBody(forgotPasswordSchema), authController.forgotPassword);

export default router;
