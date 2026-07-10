import * as balanceHistoryService from "../services/balanceHistory.service";

export async function list(req: any, res: any) {
  try {
    const history = await balanceHistoryService.listBalanceHistory(req.user.userId);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function create(req: any, res: any) {
  try {
    const { month, totalBalance } = req.body;
    const history = await balanceHistoryService.upsertBalanceHistory(req.user.userId, month, totalBalance);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function update(req: any, res: any) {
  try {
    const { month, totalBalance } = req.body;
    const history = await balanceHistoryService.updateBalanceHistory(req.user.userId, req.params.id, month, totalBalance);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function remove(req: any, res: any) {
  try {
    await balanceHistoryService.deleteBalanceHistory(req.user.userId, req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
