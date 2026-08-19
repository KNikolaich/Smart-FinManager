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

export async function getRateHistory(iso: string) {
  const code = iso.toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    const err: any = new Error("Invalid currency code");
    err.status = 400;
    throw err;
  }

  const cached = historyCache.get(code);
  if (cached && cached.expiresAt > Date.now()) {
    return { iso: code, days: HISTORY_DAYS, points: cached.points };
  }

  const existing = historyInFlight.get(code);
  const request = existing ?? fetchHistoryFromCbr(code);
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
