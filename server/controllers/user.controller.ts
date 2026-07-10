import * as userService from "../services/user.service";

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
