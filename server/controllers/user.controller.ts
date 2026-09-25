import * as userService from "../services/user.service";
import * as authService from "../services/auth.service";
import { notifyUser } from "../socket";

export async function getProfile(req: any, res: any) {
  try {
    const user = await userService.getProfile(req.user.userId);
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteAccount(req: any, res: any) {
  try {
    await userService.deleteAccount(req.user.userId);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Delete Account Error:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function clearTransactions(req: any, res: any) {
  try {
    await userService.clearTransactions(req.user.userId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function clearAllUserData(req: any, res: any) {
  try {
    const userId = req.user.userId;
    const validPassword = await authService.verifyPassword(userId, req.body.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Неверный пароль" });
    }

    const deleted = await userService.clearAllUserData(userId);
    for (const type of [
      "accounts",
      "transactions",
      "goals",
      "balance-history",
      "ai-logs",
      "chat-history",
    ]) {
      notifyUser(userId, "data:updated", { type });
    }
    for (const planType of [
      "calendar",
      "cashback",
      "cashbacks",
      "config",
      "comment",
      "comments",
      "now",
      "credit",
      "budget",
      "goals",
      "all",
    ]) {
      notifyUser(userId, "data:updated", { type: "plan-grid", planType });
    }

    res.json({ success: true, deleted });
  } catch (error: any) {
    console.error("Clear all user data failed:", error);
    res.status(500).json({ error: "Не удалось очистить данные" });
  }
}
