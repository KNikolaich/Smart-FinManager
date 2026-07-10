import { Router } from "express";
import { validateBody, chatMessageCreateSchema, chatMessageUpdateSchema } from "../../validation";
import { authenticateToken } from "../authMiddleware";
import * as chatHistoryController from "../controllers/chatHistory.controller";

const router = Router();

router.get("/api/chat-history", authenticateToken, chatHistoryController.list);
router.post("/api/chat-history", authenticateToken, validateBody(chatMessageCreateSchema), chatHistoryController.create);
router.put("/api/chat-history/:id", authenticateToken, validateBody(chatMessageUpdateSchema), chatHistoryController.update);
router.delete("/api/chat-history", authenticateToken, chatHistoryController.clear);
router.delete("/api/chat-history/:id", authenticateToken, chatHistoryController.remove);

export default router;
