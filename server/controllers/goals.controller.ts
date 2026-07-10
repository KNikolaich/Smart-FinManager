import * as goalsService from "../services/goals.service";
import { notifyUser } from "../socket";

export async function list(req: any, res: any) {
  try {
    const goals = await goalsService.listGoals(req.user.userId);
    res.json(goals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function create(req: any, res: any) {
  try {
    const goal = await goalsService.createGoal(req.user.userId, req.body);
    notifyUser(req.user.userId, "data:updated", { type: "goals" });
    res.json(goal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function update(req: any, res: any) {
  try {
    const goal = await goalsService.updateGoal(req.user.userId, req.params.id, req.body);
    notifyUser(req.user.userId, "data:updated", { type: "goals" });
    res.json(goal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function remove(req: any, res: any) {
  try {
    await goalsService.deleteGoal(req.user.userId, req.params.id);
    notifyUser(req.user.userId, "data:updated", { type: "goals" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
