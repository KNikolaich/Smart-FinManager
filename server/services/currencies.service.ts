import axios from "axios";
import { prisma } from "../prisma";

export function listCurrencies() {
  return prisma.currency.findMany();
}

export function createCurrency(data: any) {
  return prisma.currency.create({ data });
}

export function upsertCurrency(id: string, data: any) {
  return prisma.currency.upsert({
    where: { id },
    update: data,
    create: { ...data, id }
  });
}

export function deleteCurrency(id: string) {
  return prisma.currency.delete({ where: { id } });
}

const FIAT_DEFAULTS = [
  { currency: 'рубль', name: 'RUB - Russia (руб)', iso: 'RUB', rate: 1.0, symbol: '₽' },
  { currency: 'доллар', name: 'USD - USA (US$)', iso: 'USD', rate: 1.0, symbol: '$' },
  { currency: 'евро', name: 'EUR - European Union (€)', iso: 'EUR', rate: 1.0, symbol: '€' },
  { currency: 'фунт', name: 'GBP - United Kingdom (£)', iso: 'GBP', rate: 1.0, symbol: '£' },
  { currency: 'иена', name: 'JPY - Japan (¥)', iso: 'JPY', rate: 1.0, symbol: '¥' },
  { currency: 'юань', name: 'CNY - China (¥)', iso: 'CNY', rate: 1.0, symbol: '¥' },
];

const CRYPTO_DEFAULTS = [
  { currency: 'биткоин', name: 'BTC - Bitcoin (₿)', iso: 'BTC', rate: 1.0, symbol: '₿' },
  { currency: 'эфириум', name: 'ETH - Ethereum (Ξ)', iso: 'ETH', rate: 1.0, symbol: 'Ξ' },
  { currency: 'солана', name: 'SOL - Solana', iso: 'SOL', rate: 1.0, symbol: 'SOL' },
  { currency: 'тезер', name: 'USDT - Tether', iso: 'USDT', rate: 1.0, symbol: '₮' },
];

export async function seedCurrencies() {
  const count = await prisma.currency.count();

  // Fiat defaults only apply to a completely empty catalog (existing behavior);
  // crypto defaults are also added to existing catalogs that predate crypto
  // support, matched by ISO so admin-renamed entries are not duplicated.
  const toSeed = count === 0 ? [...FIAT_DEFAULTS, ...CRYPTO_DEFAULTS] : CRYPTO_DEFAULTS;

  const existing = await prisma.currency.findMany({ select: { iso: true } });
  const existingIsos = new Set(existing.map((c) => c.iso.toUpperCase()));

  const missing = toSeed.filter((cur) => !existingIsos.has(cur.iso));
  if (missing.length === 0) return;

  // Best effort: give newly seeded crypto entries a real RUB rate right away
  // instead of the 1.0 placeholder. Seeding must not fail if the source is down.
  let cryptoRates: Record<string, number> = {};
  if (missing.some((cur) => isCryptoCode(cur.iso))) {
    try {
      cryptoRates = (await getCryptoRates()).rates;
    } catch (error: any) {
      console.error("Seed: crypto rates unavailable, using placeholder:", error.message);
    }
  }

  for (const cur of missing) {
    await prisma.currency.upsert({
      where: { currency: cur.currency },
      update: {},
      create: { ...cur, rate: cryptoRates[cur.iso] ?? cur.rate }
    });
  }
}

// ---- Avangard cashless buy/sell rates ----
// Avangard publishes current retail quotes but no public historical API.
// We therefore persist each distinct official quote and build our own history.

type BankRate = {
  iso: string;
  buyRate: number;
  sellRate: number;
};

type BankRateRefreshResult = {
  source: "avangard";
  quoteType: "cashless";
  quotedAt: Date;
  rates: Array<BankRate & { midRate: number }>;
};

const HISTORY_CACHE_TTL_MS = 10 * 60 * 1000;
const AVANGARD_PAGE_URL = "https://www.avangard.ru/rus/private/currency/?city=moskva";
const AVANGARD_READER_URL = `https://r.jina.ai/${AVANGARD_PAGE_URL}`;
const MOSCOW_TIME_ZONE = "Europe/Moscow";
const DAILY_COLLECTION_HOUR = 9;
const DAILY_COLLECTION_STALE_AFTER_MS = 30 * 60 * 1000;
let bankRatesCache: { result: BankRateRefreshResult; expiresAt: number } | null = null;
let bankRatesInFlight: Promise<BankRateRefreshResult> | null = null;

function getMoscowDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MOSCOW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
  };
}

function moscowDateValue(now = new Date()) {
  const { year, month, day } = getMoscowDateParts(now);
  return new Date(Date.UTC(year, month - 1, day));
}

function parseQuoteTimestamp(content: string) {
  const match = content.match(/Действительно на(?:\s|<[^>]+>)*(\d{2}):(\d{2}),\s*(\d{2})\.(\d{2})\.(\d{4})/i);
  if (!match) return new Date();
  const [, hour, minute, day, month, year] = match;
  const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:00+03:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function parseAvangardHtml(content: string): BankRate[] {
  const marker = content.search(/Безналичные курсы валют/i);
  if (marker < 0) return [];
  const section = content.slice(marker, marker + 30_000);
  const rates: BankRate[] = [];
  const rows = section.matchAll(
    /flag-name">\s*([A-Z]{3,5})\s*<\/span>[\s\S]{0,1000}?currency-element-curr-digit">\s*([\d.,]+)\s*<\/div>[\s\S]{0,300}?currency-element-curr-digit">\s*([\d.,]+)\s*<\/div>/g
  );

  for (const row of rows) {
    const buyRate = Number(row[2].replace(",", "."));
    const sellRate = Number(row[3].replace(",", "."));
    if (Number.isFinite(buyRate) && Number.isFinite(sellRate) && buyRate > 0 && sellRate > 0 && sellRate >= buyRate) {
      rates.push({ iso: row[1], buyRate, sellRate });
    }
  }
  return rates;
}

function parseAvangardMarkdown(content: string): BankRate[] {
  const marker = content.search(/Безналичные курсы валют/i);
  if (marker < 0) return [];
  const lines = content
    .slice(marker)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const rates: BankRate[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const code = lines[index].match(/\)([A-Z]{3,5})$/)?.[1] ?? lines[index].match(/^([A-Z]{3,5})$/)?.[1];
    if (!code) continue;
    const numericValues = lines
      .slice(index + 1, index + 7)
      .filter(line => /^\d+(?:[.,]\d+)?$/.test(line))
      .slice(0, 2)
      .map(value => Number(value.replace(",", ".")));
    if (numericValues.length !== 2) continue;
    const [buyRate, sellRate] = numericValues;
    if (buyRate > 0 && sellRate >= buyRate) rates.push({ iso: code, buyRate, sellRate });
  }
  return rates;
}

async function fetchAvangardRates(): Promise<{ quotedAt: Date; rates: BankRate[] }> {
  let content = "";
  try {
    const response = await axios.get(AVANGARD_PAGE_URL, {
      timeout: 8000,
      responseType: "text",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FinanceTracker/1.0)" },
    });
    content = String(response.data);
  } catch (directError: any) {
    console.warn("Direct Avangard rate request failed, using reader transport:", directError.code || directError.message);
    const response = await axios.get(AVANGARD_READER_URL, {
      timeout: 15000,
      responseType: "text",
      headers: {
        Accept: "text/plain",
        "X-No-Cache": "true",
      },
    });
    content = String(response.data);
  }

  const rates = content.includes("currency-element-curr-digit")
    ? parseAvangardHtml(content)
    : parseAvangardMarkdown(content);
  if (rates.length === 0) {
    const error: any = new Error("Avangard returned no supported cashless exchange rates");
    error.status = 502;
    throw error;
  }
  return { quotedAt: parseQuoteTimestamp(content), rates };
}

export async function refreshBankRates(force = false): Promise<BankRateRefreshResult> {
  if (!force && bankRatesCache && bankRatesCache.expiresAt > Date.now()) return bankRatesCache.result;
  if (bankRatesInFlight) return bankRatesInFlight;

  bankRatesInFlight = (async () => {
    const { quotedAt, rates } = await fetchAvangardRates();
    const enrichedRates = rates.map(rate => ({
      ...rate,
      midRate: Math.round(((rate.buyRate + rate.sellRate) / 2) * 1_000_000) / 1_000_000,
    }));

    await prisma.$transaction(async transaction => {
      for (const rate of enrichedRates) {
        const currency = await transaction.currency.findFirst({
          where: { iso: { equals: rate.iso, mode: "insensitive" } },
          select: { id: true },
        });
        if (currency) {
          await transaction.currency.update({
            where: { id: currency.id },
            data: {
              rate: rate.midRate,
              buyRate: rate.buyRate,
              sellRate: rate.sellRate,
              rateSource: "avangard",
              rateUpdatedAt: quotedAt,
            },
          });
        }
        await transaction.currencyRateSnapshot.upsert({
          where: {
            iso_quotedAt_source_quoteType: {
              iso: rate.iso,
              quotedAt,
              source: "avangard",
              quoteType: "cashless",
            },
          },
          update: {
            buyRate: rate.buyRate,
            sellRate: rate.sellRate,
          },
          create: {
            iso: rate.iso,
            buyRate: rate.buyRate,
            sellRate: rate.sellRate,
            quotedAt,
            source: "avangard",
            quoteType: "cashless",
          },
        });
      }
    });

    const result: BankRateRefreshResult = {
      source: "avangard",
      quoteType: "cashless",
      quotedAt,
      rates: enrichedRates,
    };
    bankRatesCache = { result, expiresAt: Date.now() + HISTORY_CACHE_TTL_MS };
    return result;
  })().finally(() => {
    bankRatesInFlight = null;
  });

  return bankRatesInFlight;
}

/**
 * Ensures that the daily collection has completed after 09:00 Moscow time.
 * The state is stored in PostgreSQL rather than process memory so a restart,
 * sleep/wake cycle, or multiple server instances cannot make us lose the day.
 */
export async function ensureDailyBankRates(): Promise<"not-due" | "already-complete" | "already-running" | "refreshed"> {
  const { hour } = getMoscowDateParts();
  if (hour < DAILY_COLLECTION_HOUR) return "not-due";

  const runDate = moscowDateValue();
  let run = await prisma.currencyRateCollectionRun.findUnique({ where: { runDate } });
  if (run?.status === "success") return "already-complete";

  const staleRunning = run?.status === "running"
    && Date.now() - run.startedAt.getTime() < DAILY_COLLECTION_STALE_AFTER_MS;

  if (staleRunning) return "already-running";

  if (!run) {
    try {
      run = await prisma.currencyRateCollectionRun.create({
        data: {
          runDate,
          source: "avangard",
          status: "running",
        },
      });
    } catch (error: any) {
      // Another process may have claimed this date between findUnique and
      // create. Re-read its claim and let that process do the collection.
      if (error.code !== "P2002") throw error;
      run = await prisma.currencyRateCollectionRun.findUnique({ where: { runDate } });
      if (!run || run.status === "success") return run ? "already-complete" : "already-running";
      if (run.status === "running" && Date.now() - run.startedAt.getTime() < DAILY_COLLECTION_STALE_AFTER_MS) {
        return "already-running";
      }
    }
  }

  if (!run) return "already-running";

  // Claim failed or stale work atomically. If another process won the race,
  // it will either complete the run or keep working on it.
  const claimed = await prisma.currencyRateCollectionRun.updateMany({
    where: {
      id: run.id,
      status: run.status,
      startedAt: run.startedAt,
    },
    data: {
      status: "running",
      startedAt: new Date(),
      completedAt: null,
      error: null,
    },
  });
  if (claimed.count === 0) return "already-running";

  try {
    await refreshBankRates(true);
    await prisma.currencyRateCollectionRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        completedAt: new Date(),
        error: null,
      },
    });
    return "refreshed";
  } catch (error: any) {
    await prisma.currencyRateCollectionRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        error: String(error?.message || error).slice(0, 1000),
      },
    });
    throw error;
  }
}

// ---- Cryptocurrencies (CoinGecko public API, RUB-based) ----
// Supported set is a fixed allowlist: rates must be real, so unknown codes
// return "no data" instead of invented values.

const SUPPORTED_CRYPTO: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  USDT: "tether",
  USDC: "usd-coin",
  BNB: "binancecoin",
  XRP: "ripple",
  TON: "the-open-network",
  DOGE: "dogecoin",
};

export function isCryptoCode(code: string) {
  return Object.prototype.hasOwnProperty.call(SUPPORTED_CRYPTO, code);
}

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

let cryptoRatesCache: { rates: Record<string, number>; expiresAt: number } | null = null;
let cryptoRatesInFlight: Promise<Record<string, number>> | null = null;

/** Current RUB price for every supported crypto, one upstream request, cached. */
export async function getCryptoRates(force = false): Promise<{ rates: Record<string, number> }> {
  if (!force && cryptoRatesCache && cryptoRatesCache.expiresAt > Date.now()) {
    return { rates: cryptoRatesCache.rates };
  }

  if (!cryptoRatesInFlight) {
    cryptoRatesInFlight = axios
      .get(`${COINGECKO_BASE}/simple/price`, {
        timeout: 10000,
        params: {
          ids: Object.values(SUPPORTED_CRYPTO).join(","),
          vs_currencies: "rub",
        },
      })
      .then((response) => {
        const rates: Record<string, number> = {};
        for (const [code, geckoId] of Object.entries(SUPPORTED_CRYPTO)) {
          const value = response.data?.[geckoId]?.rub;
          if (typeof value === "number" && Number.isFinite(value) && value > 0) {
            rates[code] = value;
          }
        }
        cryptoRatesCache = { rates, expiresAt: Date.now() + HISTORY_CACHE_TTL_MS };
        return rates;
      })
      .finally(() => {
        cryptoRatesInFlight = null;
      });
  }

  return { rates: await cryptoRatesInFlight };
}

export async function refreshCryptoRates() {
  const quotedAt = new Date();
  const { rates } = await getCryptoRates(true);

  await prisma.$transaction(async transaction => {
    for (const [iso, rate] of Object.entries(rates)) {
      await transaction.currency.updateMany({
        where: { iso: { equals: iso, mode: "insensitive" } },
        data: {
          rate,
          buyRate: null,
          sellRate: null,
          rateSource: "coingecko",
          rateUpdatedAt: quotedAt,
        },
      });
    }
  });

  return {
    source: "coingecko" as const,
    quoteType: "market" as const,
    quotedAt,
    rates,
  };
}

async function fetchCryptoHistory(code: string, days: number) {
  const geckoId = SUPPORTED_CRYPTO[code];
  if (!geckoId) return [];

  const response = await axios.get(`${COINGECKO_BASE}/coins/${geckoId}/market_chart`, {
    timeout: 10000,
    params: {
      vs_currency: "rub",
      days,
      interval: "daily",
    },
  });
  const prices = response.data?.prices;
  if (!Array.isArray(prices)) return [];

  const byDate = new Map<string, { timestamp: string; rate: number }>();
  for (const entry of prices) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const [timestamp, rate] = entry;
    if (typeof timestamp !== "number" || typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) continue;
    const instant = new Date(timestamp);
    if (Number.isNaN(instant.getTime())) continue;
    byDate.set(instant.toISOString().slice(0, 10), {
      timestamp: instant.toISOString(),
      rate,
    });
  }

  return Array.from(byDate.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export async function getRateHistory(iso: string, days: number) {
  const code = iso.trim().toUpperCase();
  if (!/^[A-Z]{3,5}$/.test(code)) {
    const err: any = new Error("Invalid currency code");
    err.status = 400;
    throw err;
  }

  const allowedDays = [7, 30, 90, 180, 365];
  if (!allowedDays.includes(days)) {
    const err: any = new Error("Invalid history range");
    err.status = 400;
    throw err;
  }

  if (isCryptoCode(code)) {
    return {
      iso: code,
      days,
      source: "coingecko",
      quoteType: "market",
      points: await fetchCryptoHistory(code, days),
    };
  }

  try {
    await refreshBankRates(false);
  } catch (error: any) {
    // Existing snapshots remain useful when the upstream site is temporarily
    // unavailable. An empty result below still gives the UI an honest state.
    console.warn("Could not refresh Avangard rates before history query:", error.message);
  }

  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const snapshots = await prisma.currencyRateSnapshot.findMany({
    where: {
      iso: code,
      source: "avangard",
      quoteType: "cashless",
      quotedAt: { gte: from },
    },
    orderBy: { quotedAt: "asc" },
  });

  return {
    iso: code,
    days,
    source: "avangard",
    quoteType: "cashless",
    points: snapshots.map(point => {
      const spread = point.sellRate - point.buyRate;
      return {
        timestamp: point.quotedAt.toISOString(),
        buyRate: point.buyRate,
        sellRate: point.sellRate,
        spread,
        spreadPercent: point.buyRate > 0 ? (spread / point.buyRate) * 100 : null,
      };
    }),
  };
}

export async function getExchangeRates(iso: string) {
  const apiKey = process.env.EXCHANGERATE_API_KEY;

  if (!apiKey) {
    console.error("EXCHANGERATE_API_KEY is missing in server environment");
    const err: any = new Error("Exchange rate API key is not configured on the server.");
    err.status = 500;
    throw err;
  }

  const response = await axios.get(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/${iso}`);
  return response.data;
}
