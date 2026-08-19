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

export async function seedCurrencies() {
  const count = await prisma.currency.count();
  if (count > 0) {
    return;
  }

  const defaults = [
    { currency: 'рубль', name: 'RUB - Russia (руб)', iso: 'RUB', rate: 1.0, symbol: '₽' },
    { currency: 'доллар', name: 'USD - USA (US$)', iso: 'USD', rate: 1.0, symbol: '$' },
    { currency: 'евро', name: 'EUR - European Union (€)', iso: 'EUR', rate: 1.0, symbol: '€' },
    { currency: 'фунт', name: 'GBP - United Kingdom (£)', iso: 'GBP', rate: 1.0, symbol: '£' },
    { currency: 'иена', name: 'JPY - Japan (¥)', iso: 'JPY', rate: 1.0, symbol: '¥' },
    { currency: 'юань', name: 'CNY - China (¥)', iso: 'CNY', rate: 1.0, symbol: '¥' },
  ];

  for (const cur of defaults) {
    await prisma.currency.upsert({
      where: { currency: cur.currency },
      update: {},
      create: cur
    });
  }
}

// ---- Historical rates (30 days, RUB-based) ----
// Source: Central Bank of Russia daily archives via cbr-xml-daily.ru (no API key).
// Each archive file contains all currencies for one date, so we cache per-date.

type DailyRates = Record<string, number>; // ISO -> rate to RUB (per 1 unit)

const HISTORY_DAYS = 30;
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000; // Europe/Moscow is fixed UTC+3 (no DST)
const MISS_TTL_MS = 10 * 60 * 1000; // re-check unpublished dates every 10 minutes

// Positive results are cached forever (archives are immutable).
const historyCache = new Map<string, DailyRates>(); // key: YYYY/MM/DD
// Misses (404 / no data yet) are cached with a short TTL so today's publication can appear.
const missCache = new Map<string, number>(); // key -> expiry timestamp
// Global in-flight dedup: concurrent requests for the same date share one fetch.
const inFlight = new Map<string, Promise<DailyRates | null>>();

// Module-level semaphore bounding total concurrent outbound archive fetches.
const GLOBAL_CONCURRENCY = 4;
let activeFetches = 0;
const fetchWaiters: (() => void)[] = [];
async function acquireSlot() {
  if (activeFetches < GLOBAL_CONCURRENCY) {
    activeFetches++;
    return;
  }
  await new Promise<void>(resolve => fetchWaiters.push(resolve));
  activeFetches++;
}
function releaseSlot() {
  activeFetches--;
  const next = fetchWaiters.shift();
  if (next) next();
}

// Format a Moscow-calendar date (input: UTC ms timestamp).
function mskParts(ts: number) {
  const d = new Date(ts + MSK_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return { key: `${y}/${m}/${day}`, iso: `${y}-${m}-${day}` };
}

async function doFetchDailyRates(key: string, attempt = 0): Promise<DailyRates | null> {
  try {
    const resp = await axios.get(`https://www.cbr-xml-daily.ru/archive/${key}/daily_json.js`, { timeout: 10000 });
    const valute = resp.data?.Valute;
    if (!valute || typeof valute !== "object") {
      missCache.set(key, Date.now() + MISS_TTL_MS);
      return null;
    }
    const rates: DailyRates = { RUB: 1 };
    for (const code of Object.keys(valute)) {
      const v = valute[code];
      if (v && typeof v.Value === "number" && typeof v.Nominal === "number" && v.Nominal > 0) {
        rates[code] = v.Value / v.Nominal;
      }
    }
    historyCache.set(key, rates);
    missCache.delete(key);
    return rates;
  } catch (e: any) {
    // 404 = no publication for that date (weekend/holiday, or not published yet).
    // Cache the miss with a short TTL so later publications can still appear.
    if (e?.response?.status === 404) {
      missCache.set(key, Date.now() + MISS_TTL_MS);
      return null;
    }
    // Transient error: retry a couple of times with backoff, then skip this date.
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
      return doFetchDailyRates(key, attempt + 1);
    }
    return null;
  }
}

async function fetchDailyRates(key: string): Promise<DailyRates | null> {
  const cached = historyCache.get(key);
  if (cached) return cached;
  const missUntil = missCache.get(key);
  if (missUntil && missUntil > Date.now()) return null;

  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    await acquireSlot();
    try {
      return await doFetchDailyRates(key);
    } finally {
      releaseSlot();
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, promise);
  return promise;
}

export async function getRateHistory(iso: string) {
  const code = iso.toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    const err: any = new Error("Invalid currency code");
    err.status = 400;
    throw err;
  }

  const now = Date.now();
  const dates: { key: string; iso: string }[] = [];
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    dates.push(mskParts(now - i * 24 * 60 * 60 * 1000));
  }

  const results = await Promise.all(dates.map(d => fetchDailyRates(d.key)));

  const points: { date: string; rate: number }[] = [];
  for (let i = 0; i < dates.length; i++) {
    const day = results[i];
    if (!day) continue;
    const rate = code === "RUB" ? 1 : day[code];
    if (typeof rate === "number" && isFinite(rate)) {
      points.push({ date: dates[i].iso, rate });
    }
  }

  return { iso: code, days: HISTORY_DAYS, points };
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
