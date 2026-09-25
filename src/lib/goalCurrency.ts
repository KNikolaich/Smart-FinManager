export function formatGoalAmount(amount: number, currency?: string): string {
  const code = (currency || "RUB").toUpperCase();
  const symbol = code === "RUB" ? "₽" : code === "USD" ? "$" : code;
  return `${amount.toLocaleString("ru-RU")} ${symbol}`;
}