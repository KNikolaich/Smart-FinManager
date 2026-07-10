import * as transactionsService from "../services/transactions.service";
import { UNPAGINATED_SENTINEL } from "../services/transactions.service";
import { notifyUser } from "../socket";

function parseIdList(value: any): string[] | undefined {
  if (!value) return undefined;
  const raw = Array.isArray(value) ? value.join(",") : String(value);
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return ids.length > 0 ? ids : undefined;
}

export async function list(req: any, res: any) {
  try {
    const q = req.query;
    // No pagination params -> legacy behavior: return the plain array
    // (kept for any callers that haven't migrated, e.g. exports/AI context).
    if (q.page === undefined && q.pageSize === undefined) {
      const result = await transactionsService.listTransactions(req.user.userId, { pageSize: UNPAGINATED_SENTINEL as any });
      return res.json(result.transactions);
    }

    const result = await transactionsService.listTransactions(req.user.userId, {
      page: q.page ? Number(q.page) : undefined,
      pageSize: q.pageSize ? Number(q.pageSize) : undefined,
      startDate: q.startDate,
      endDate: q.endDate,
      type: q.type,
      accountIds: parseIdList(q.accountIds),
      categoryIds: parseIdList(q.categoryIds),
      search: q.search,
      searchCategoryIds: parseIdList(q.searchCategoryIds),
      searchAccountIds: parseIdList(q.searchAccountIds),
    });
    res.json(result);
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
