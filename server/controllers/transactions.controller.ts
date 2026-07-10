import * as transactionsService from "../services/transactions.service";
import { notifyUser } from "../socket";

export async function list(req: any, res: any) {
  try {
    const transactions = await transactionsService.listTransactions(req.user.userId);
    res.json(transactions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function create(req: any, res: any) {
  try {
    const result = await transactionsService.createTransaction(req.user.userId, req.body);
    notifyUser(req.user.userId, "data:updated", { type: "transactions" });
    res.json(result);
  } catch (error: any) {
    console.error("Transaction Error:", error);
    res.status(error.status || 500).json({ error: error.message });
  }
}

export async function remove(req: any, res: any) {
  try {
    await transactionsService.deleteTransaction(req.params.id);
    notifyUser(req.user.userId, "data:updated", { type: "transactions" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
}

export async function update(req: any, res: any) {
  try {
    const result = await transactionsService.updateTransaction(req.params.id, req.body);
    notifyUser(req.user.userId, "data:updated", { type: "transactions" });
    res.json(result);
  } catch (error: any) {
    console.error("Update Transaction Error:", error);
    res.status(error.status || 500).json({ error: error.message });
  }
}
