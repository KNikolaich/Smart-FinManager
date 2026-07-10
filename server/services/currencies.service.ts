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
