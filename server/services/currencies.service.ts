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

// ---- Historical rates (30 days, RUB-based) ----
// The Central Bank's dynamic endpoint returns the complete period for one
// currency in a single response. The previous archive implementation fetched
// one file per day, making a cold chart wait for up to 30 network requests.

type RateHistoryPoint = { date: string; rate: number };

const HISTORY_DAYS = 30;
const HISTORY_CACHE_TTL_MS = 10 * 60 * 1000;
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000; // Europe/Moscow is fixed UTC+3 (no DST)

// These are the currencies seeded by the app. They avoid an extra lookup for
// every ordinary chart; custom CBR-supported currencies use the fallback below.
const KNOWN_CBR_IDS: Record<string, string> = {
  USD: "R01235",
  EUR: "R01239",
  GBP: "R01035",
  JPY: "R01820",
  CNY: "R01375",
};

const historyCache = new Map<string, { points: RateHistoryPoint[]; expiresAt: number }>();
const historyInFlight = new Map<string, Promise<RateHistoryPoint[]>>();
let cbrIdsCache: { ids: Record<string, string>; expiresAt: number } | null = null;
let cbrIdsInFlight: Promise<Record<string, string>> | null = null;

function mskDate(ts: number) {
  const d = new Date(ts + MSK_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function cbrRequestDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function parseCbrDynamicXml(xml: string): RateHistoryPoint[] {
  const points: RateHistoryPoint[] = [];
  const records = xml.matchAll(/<Record\b[^>]*Date="(\d{2})\.(\d{2})\.(\d{4})"[^>]*>([\s\S]*?)<\/Record>/g);

  for (const record of records) {
    const [, day, month, year, body] = record;
    const nominal = Number(body.match(/<Nominal>([^<]+)<\/Nominal>/)?.[1]?.replace(",", "."));
    const value = Number(body.match(/<Value>([^<]+)<\/Value>/)?.[1]?.replace(",", "."));
    if (Number.isFinite(value) && Number.isFinite(nominal) && nominal > 0) {
      points.push({ date: `${year}-${month}-${day}`, rate: value / nominal });
    }
  }

  return points;
}

async function getCbrIds(): Promise<Record<string, string>> {
  if (cbrIdsCache && cbrIdsCache.expiresAt > Date.now()) return cbrIdsCache.ids;
  if (cbrIdsInFlight) return cbrIdsInFlight;

  cbrIdsInFlight = axios
    .get("https://www.cbr-xml-daily.ru/daily_json.js", { timeout: 8000 })
    .then((response) => {
      const ids: Record<string, string> = { ...KNOWN_CBR_IDS };
      const valute = response.data?.Valute;
      if (valute && typeof valute === "object") {
        for (const [code, value] of Object.entries(valute as Record<string, any>)) {
          if (typeof value?.ID === "string") ids[code] = value.ID;
        }
      }
      cbrIdsCache = { ids, expiresAt: Date.now() + HISTORY_CACHE_TTL_MS };
      return ids;
    })
    .finally(() => {
      cbrIdsInFlight = null;
    });

  return cbrIdsInFlight;
}

async function getCbrId(iso: string) {
  return KNOWN_CBR_IDS[iso] ?? (await getCbrIds())[iso];
}

async function fetchHistoryFromCbr(iso: string): Promise<RateHistoryPoint[]> {
  if (iso === "RUB") {
    const now = Date.now();
    return Array.from({ length: HISTORY_DAYS }, (_, index) => ({
      date: mskDate(now - (HISTORY_DAYS - 1 - index) * 24 * 60 * 60 * 1000),
      rate: 1,
    }));
  }

  const cbrId = await getCbrId(iso);
  if (!cbrId) return [];

  const now = Date.now();
  const from = mskDate(now - (HISTORY_DAYS - 1) * 24 * 60 * 60 * 1000);
  const to = mskDate(now);
  const response = await axios.get("https://www.cbr.ru/scripts/XML_dynamic.asp", {
    timeout: 8000,
    params: {
      date_req1: cbrRequestDate(from),
      date_req2: cbrRequestDate(to),
      VAL_NM_RQ: cbrId,
    },
    responseType: "text",
  });

  return parseCbrDynamicXml(response.data);
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
export async function getCryptoRates(): Promise<{ rates: Record<string, number> }> {
  if (cryptoRatesCache && cryptoRatesCache.expiresAt > Date.now()) {
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

async function fetchCryptoHistory(code: string): Promise<RateHistoryPoint[]> {
  const geckoId = SUPPORTED_CRYPTO[code];
  if (!geckoId) return [];

  const response = await axios.get(`${COINGECKO_BASE}/coins/${geckoId}/market_chart`, {
    timeout: 10000,
    params: { vs_currency: "rub", days: HISTORY_DAYS, interval: "daily" },
  });

  const prices = response.data?.prices;
  if (!Array.isArray(prices)) return [];

  // CoinGecko returns [timestampMs, price] pairs at daily 00:00 UTC plus a
  // final in-progress point for "now"; keep one point per date (the last one).
  const byDate = new Map<string, number>();
  for (const entry of prices) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const [ts, price] = entry;
    if (typeof ts !== "number" || typeof price !== "number" || !Number.isFinite(price) || price <= 0) continue;
    byDate.set(mskDate(ts), price);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, rate]) => ({ date, rate }));
}

export async function getRateHistory(iso: string) {
  const code = iso.toUpperCase();
  if (!/^[A-Z]{3,5}$/.test(code)) {
    const err: any = new Error("Invalid currency code");
    err.status = 400;
    throw err;
  }

  const cached = historyCache.get(code);
  if (cached && cached.expiresAt > Date.now()) {
    return { iso: code, days: HISTORY_DAYS, points: cached.points };
  }

  const existing = historyInFlight.get(code);
  const request = existing ?? (isCryptoCode(code) ? fetchCryptoHistory(code) : fetchHistoryFromCbr(code));
  if (!existing) historyInFlight.set(code, request);

  try {
    const points = await request;
    historyCache.set(code, { points, expiresAt: Date.now() + HISTORY_CACHE_TTL_MS });
    return { iso: code, days: HISTORY_DAYS, points };
  } finally {
    if (!existing) historyInFlight.delete(code);
  }
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
