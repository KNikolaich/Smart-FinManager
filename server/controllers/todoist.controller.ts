import * as todoistService from "../services/todoist.service";

export async function listTasks(_req: any, res: any) {
  try {
    const result = await todoistService.listTodoistTasks();
    res.json(result);
  } catch (error: any) {
    console.error("Todoist list tasks error:", error);
    res.status(error.status === 401 ? 401 : 502).json({
      error: error.status === 401
        ? "Todoist authorization is required"
        : "Не удалось получить задачи из Todoist",
    });
  }
}

export async function createTask(req: any, res: any) {
  try {
    const task = await todoistService.createTodoistTask(req.body);
    res.status(201).json(task);
  } catch (error: any) {
    console.error("Todoist create task error:", error);
    res.status(error.status === 401 ? 401 : 502).json({
      error: error.status === 401
        ? "Todoist authorization is required"
        : "Не удалось создать задачу в Todoist",
    });
  }
}

export async function updateTask(req: any, res: any) {
  try {
    const task = await todoistService.updateTodoistTask(req.params.id, req.body);
    res.json(task);
  } catch (error: any) {
    console.error("Todoist update task error:", error);
    res.status(error.status === 401 ? 401 : 502).json({
      error: error.status === 401
        ? "Todoist authorization is required"
        : "Не удалось обновить задачу в Todoist",
    });
  }
}