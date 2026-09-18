import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../../validation";
import { authenticateToken } from "../authMiddleware";
import * as todoistController from "../controllers/todoist.controller";

const todoistTaskSchema = z.object({
  content: z.string().trim().min(1).max(500),
  dueString: z.string().trim().min(1).max(120),
}).strict();

const router = Router();

router.get("/api/todoist/tasks", authenticateToken, todoistController.listTasks);
router.post(
  "/api/todoist/tasks",
  authenticateToken,
  validateBody(todoistTaskSchema),
  todoistController.createTask,
);
router.put(
  "/api/todoist/tasks/:id",
  authenticateToken,
  validateBody(todoistTaskSchema),
  todoistController.updateTask,
);

export default router;