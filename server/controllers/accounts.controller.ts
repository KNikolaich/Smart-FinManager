import * as accountsService from "../services/accounts.service";
import { notifyUser } from "../socket";

export async function list(req: any, res: any) {
  try {
    const accounts = await accountsService.listAccounts(req.user.userId);
    res.json(accounts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function create(req: any, res: any) {
  try {
    const account = await accountsService.createAccount(req.user.userId, req.body);
    notifyUser(req.user.userId, "data:updated", { type: "accounts" });
    res.json(account);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function update(req: any, res: any) {
  try {
    const account = await accountsService.updateAccount(req.user.userId, req.params.id, req.body);
    notifyUser(req.user.userId, "data:updated", { type: "accounts" });
    res.json(account);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function remove(req: any, res: any) {
  try {
    await accountsService.deleteAccount(req.user.userId, req.params.id);
    notifyUser(req.user.userId, "data:updated", { type: "accounts" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
