import * as currenciesService from "../services/currencies.service";

export async function list(req: any, res: any) {
  try {
    const currencies = await currenciesService.listCurrencies();
    res.json(currencies);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function create(req: any, res: any) {
  try {
    const currency = await currenciesService.createCurrency(req.body);
    res.json(currency);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function update(req: any, res: any) {
  try {
    const currency = await currenciesService.upsertCurrency(req.params.id, req.body);
    res.json(currency);
  } catch (error: any) {
    console.error("Update Currency Error:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function remove(req: any, res: any) {
  try {
    await currenciesService.deleteCurrency(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function seed(req: any, res: any) {
  try {
    await currenciesService.seedCurrencies();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function rates(req: any, res: any) {
  try {
    const { iso } = req.params;
    const data = await currenciesService.getExchangeRates(iso);
    res.json(data);
  } catch (error: any) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    if (error.response?.status === 429) {
      console.error("Currency API Rate Limit Exceeded");
      return res.status(429).json({ error: "Rate limit exceeded for currency updates. Please try again later." });
    }
    console.error("Error proxying currency rates:", error.message);
    res.status(500).json({ error: "Failed to fetch currency rates" });
  }
}
