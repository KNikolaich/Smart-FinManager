import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { currencyService, getRateChange, RateHistoryResponse } from '../services/currencyService';
import { Currency, UserProfile } from '../types';
import { Plus, Trash2, X, AlertTriangle, Pencil, ArrowDownRight, ArrowUpRight, Minus, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const PERIODS = [7, 30, 90, 180, 365];
const CRYPTO_ISOS = new Set(['BTC', 'ETH', 'SOL', 'USDT', 'USDC', 'BNB', 'XRP', 'TON', 'DOGE']);
const money = (value?: number, digits = 2) => value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const dateTime = (value?: string) => value ? new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const isCrypto = (currency: Currency) => CRYPTO_ISOS.has(currency.iso.trim().toUpperCase()) || currency.rateSource === 'coingecko';

export const CurrencyTable: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [updatingRates, setUpdatingRates] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [rateUpdateMessage, setRateUpdateMessage] = useState<string | null>(null);

  const fetchCurrencies = async () => {
    setLoadError(false);
    try {
      const data = await currencyService.getCurrencies();
      setCurrencies(data.sort((a, b) => (a.currency || '').localeCompare(b.currency || '')));
    } catch (error) {
      setLoadError(true);
      console.error('Error fetching currencies:', error);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const userData = await api.get<UserProfile>('/auth/me');
        setUser(userData);
        if (userData.role === 'admin') await currencyService.seedDefaultCurrencies();
      } catch (err) { console.error('Error fetching user:', err); }
    };
    init();
    fetchCurrencies();
  }, []);

  const isAdmin = user?.role === 'admin';
  const fiatUpdatedAt = currencies.find(currency => !isCrypto(currency) && currency.rateSource === 'avangard')?.rateUpdatedAt;
  const cryptoUpdatedAt = currencies.find(currency => isCrypto(currency) && currency.rateSource === 'coingecko')?.rateUpdatedAt;
  const handleUpdateRates = async () => {
    setUpdatingRates(true);
    setRateUpdateMessage(null);
    const results = await Promise.allSettled([
      currencyService.refreshBankRates(),
      currencyService.refreshCryptoRates(),
    ]);
    const bankResult = results[0];
    const cryptoResult = results[1];
    if (bankResult.status === 'fulfilled') {
      const byIso = new Map(bankResult.value.rates.map(rate => [rate.iso.toUpperCase(), rate]));
      setCurrencies(current => current.map(currency => {
        const rate = byIso.get(currency.iso.toUpperCase());
        return rate ? { ...currency, rate: rate.midRate, buyRate: rate.buyRate, sellRate: rate.sellRate, rateSource: bankResult.value.source, rateUpdatedAt: bankResult.value.quotedAt } : currency;
      }));
    }
    if (cryptoResult.status === 'fulfilled') {
      const { rates } = cryptoResult.value;
      setCurrencies(current => current.map(currency => {
        const rate = rates[currency.iso.toUpperCase()] ?? rates[currency.iso];
        return rate == null ? currency : { ...currency, rate, buyRate: undefined, sellRate: undefined, rateSource: cryptoResult.value.source, rateUpdatedAt: cryptoResult.value.quotedAt };
      }));
    }
    const failed = results.filter(result => result.status === 'rejected').length;
    if (failed === 2) setRateUpdateMessage('Не удалось обновить ни банковские, ни криптовалютные курсы.');
    else if (failed === 1) setRateUpdateMessage(bankResult.status === 'rejected' ? 'Криптовалютные курсы обновлены. Банковский источник временно недоступен.' : 'Банковские курсы обновлены. Криптовалютный источник временно недоступен.');
    if (failed < 2) {
      try { await fetchCurrencies(); } catch (error) { console.error('Error reloading currencies:', error); }
    }
    setUpdatingRates(false);
  };
  const handleDeleteCurrency = async (id: string) => {
    try { await currencyService.deleteCurrency(id); setDeleteConfirmId(null); await fetchCurrencies(); }
    catch (error) { console.error('Error deleting currency:', error); }
  };

  if (loading) return <div className="p-4 text-theme-muted text-sm animate-pulse">Загрузка валют...</div>;
  if (loadError) return <div className="p-6 text-center text-theme-muted"><p className="text-sm font-bold">Не удалось загрузить валюты</p><button data-testid="button-retry-currencies" onClick={fetchCurrencies} className="mt-3 rounded-lg bg-theme-primary px-4 py-2 text-[10px] font-black uppercase text-theme-on-primary">Повторить</button></div>;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-0 backdrop-blur-xl lg:p-8">
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-theme-main shadow-2xl lg:h-auto lg:max-w-4xl lg:rounded-xl lg:border border-neutral-100">
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 bg-theme-surface/10 px-4 py-4 sm:px-6">
          <div><h3 className="text-sm font-black uppercase text-theme-main">Валюты</h3><p className="mt-1 text-[10px] text-theme-muted">Банковские котировки и крипторынок</p></div>
          <div className="flex items-center gap-2">
            {isAdmin && <><button data-testid="button-refresh-bank-rates" onClick={handleUpdateRates} disabled={updatingRates} className="flex items-center gap-1.5 rounded-lg border border-neutral-100 bg-theme-surface px-3 py-2 text-[8px] font-black uppercase tracking-widest text-theme-muted disabled:opacity-50"><RefreshCw size={12} className={updatingRates ? 'animate-spin' : ''} />{updatingRates ? 'Обновление' : 'Обновить'}</button><button data-testid="button-add-currency" onClick={() => { setEditingCurrency(null); setShowFormModal(true); }} className="flex h-10 w-10 items-center justify-center rounded-lg bg-theme-primary text-theme-on-primary"><Plus size={18} /></button></>}
            {onClose && <button data-testid="button-close-currencies" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-theme-base bg-theme-main/50"><X size={18} /></button>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto bg-theme-main p-3 sm:p-6">
           <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-theme-base bg-theme-surface px-3 py-2 text-[10px] font-bold text-theme-muted"><span>Фиат — <b className="text-theme-main">Авангард, безналичный</b> · {dateTime(fiatUpdatedAt)}</span><span>Крипто — <b className="text-theme-main">CoinGecko, рыночная цена</b> · {dateTime(cryptoUpdatedAt)}</span></div>
           {rateUpdateMessage && <div role="status" className="mb-3 rounded-lg border border-theme-base bg-theme-surface px-3 py-2 text-xs font-bold text-theme-muted">{rateUpdateMessage}</div>}
          {currencies.length === 0 ? <div className="rounded-xl border border-dashed border-theme-base px-5 py-12 text-center"><p className="text-sm font-bold text-theme-main">Валют пока нет</p><p className="mt-1 text-xs text-theme-muted">Добавьте валюту вручную или обновите банковские курсы.</p></div> :
             <div className="overflow-hidden rounded-lg border border-neutral-50 shadow-sm"><table className="w-full table-fixed border-collapse text-left"><thead><tr className="border-b border-neutral-50 bg-theme-surface/50 text-[9px] font-black uppercase tracking-wider text-theme-muted"><th className="w-[42%] px-3 py-3 sm:px-5">Валюта</th><th className="px-2 py-3">Покупка</th><th className="px-2 py-3">Продажа</th><th className="w-9 px-1 py-3"></th></tr></thead><tbody className="divide-y divide-neutral-50 bg-white">
               {currencies.map(cur => <React.Fragment key={cur.id}><tr data-testid={`row-currency-${cur.id}`} onClick={() => setExpandedId(prev => prev === cur.id ? null : cur.id)} className="cursor-pointer transition-colors hover:bg-theme-surface/30"><td className="px-3 py-3 sm:px-5"><div className="truncate text-sm font-bold text-theme-main">{cur.name}</div><div className="truncate font-mono text-[10px] text-theme-muted">{cur.iso} · {cur.symbol || '—'}</div></td>{isCrypto(cur) ? <td colSpan={2} className="px-2 py-3"><div className="font-mono text-xs font-bold text-theme-primary">{money(cur.rate, 2)} ₽</div><div className="text-[9px] font-bold text-theme-muted">CoinGecko · рынок</div></td> : <><td className="px-2 py-3 font-mono text-xs font-bold text-finance-income">{money(cur.buyRate)}</td><td className="px-2 py-3 font-mono text-xs font-bold text-finance-expense">{money(cur.sellRate)}</td></>}<td className="px-1 py-3">{isAdmin && <button data-testid={`button-edit-currency-${cur.id}`} onClick={e => { e.stopPropagation(); setEditingCurrency(cur); setShowFormModal(true); }} className="rounded p-2 text-theme-muted hover:text-theme-primary"><Pencil size={15} /></button>}</td></tr>{expandedId === cur.id && <tr><td colSpan={4} className="bg-theme-surface/20 px-2 py-4 sm:px-4"><RateHistoryChart iso={cur.iso} /></td></tr>}</React.Fragment>)}
            </tbody></table></div>}
        </div>
      </div>
      {showFormModal && <CurrencyForm currency={editingCurrency} onClose={() => setShowFormModal(false)} onSuccess={() => { setShowFormModal(false); fetchCurrencies(); }} />}
      {deleteConfirmId && <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 p-4"><div className="w-full max-w-sm rounded-xl bg-theme-main p-8 text-center"><AlertTriangle size={36} className="mx-auto text-rose-500" /><h3 className="mt-4 text-lg font-black text-theme-main">Удалить валюту?</h3><p className="mt-2 text-xs text-theme-muted">Это действие нельзя будет отменить.</p><button data-testid="button-confirm-delete-currency" onClick={() => handleDeleteCurrency(deleteConfirmId)} className="mt-6 w-full rounded-lg bg-rose-500 py-3 text-[10px] font-black uppercase text-white">Удалить навсегда</button><button data-testid="button-cancel-delete-currency" onClick={() => setDeleteConfirmId(null)} className="mt-2 w-full py-3 text-[10px] font-black uppercase text-theme-muted">Отмена</button></div></div>}
    </div>
  );
};

function RateHistoryChart({ iso }: { iso: string }) {
  const [periodIndex, setPeriodIndex] = useState(1);
  const [history, setHistory] = useState<RateHistoryResponse | null>(null);
  const [error, setError] = useState(false);
  const days = PERIODS[periodIndex];
  useEffect(() => { let cancelled = false; setHistory(null); setError(false); currencyService.getRateHistory(iso, days).then(data => { if (!cancelled) setHistory(data); }).catch(() => { if (!cancelled) setError(true); }); return () => { cancelled = true; }; }, [iso, days]);
  const points = history?.points || [];
  const chartPoints = useMemo(() => points.map(p => ({ ...p, label: new Date(p.timestamp).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) })), [points]);
  const market = history?.quoteType === 'market' || history?.source === 'coingecko';
  const values = points.flatMap(p => market ? [p.rate] : [p.buyRate, p.sellRate]).filter((value): value is number => Number.isFinite(value));
  const min = values.length ? Math.min(...values) : 0; const max = values.length ? Math.max(...values) : 1; const pad = (max - min) * .12 || .01;
  const change = market ? getRateChange(points) : null;
  const currentSpread = points.length ? (points[points.length - 1].spread ?? 0) : null;
  const firstSpread = points.length ? (points[0].spread ?? 0) : null;
  const spreadChange = currentSpread != null && firstSpread != null ? currentSpread - firstSpread : null;
  const spreadChangePercent = spreadChange != null && firstSpread
    ? (spreadChange / firstSpread) * 100
    : null;
  const ChangeIcon = (market ? change?.direction === 'up' ? ArrowUpRight : change?.direction === 'down' ? ArrowDownRight : Minus : spreadChange == null || spreadChange === 0 ? Minus : spreadChange > 0 ? ArrowUpRight : ArrowDownRight);
  if (error) return <div className="py-6 text-center text-xs font-bold text-theme-muted">История пока недоступна. Попробуйте ещё раз позже.</div>;
   return <div><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><div className="text-[10px] font-black uppercase tracking-widest text-theme-muted">{iso} → RUB · {days} дней</div><div className="mt-1 text-[9px] text-theme-muted">{history ? (market ? 'CoinGecko · рыночная цена' : 'Авангард · безналичный курс') : 'Загрузка источника...'}</div></div><div className="flex items-center gap-1"><button aria-label="Увеличить график" data-testid={`button-period-previous-${iso}`} disabled={periodIndex === 0} onClick={() => setPeriodIndex(i => Math.max(0, i - 1))} className="rounded border border-theme-base p-1.5 text-theme-muted disabled:opacity-30"><Plus size={14} /></button><span className="min-w-12 text-center text-[10px] font-black text-theme-main">{days} дн.</span><button aria-label="Уменьшить график" data-testid={`button-period-next-${iso}`} disabled={periodIndex === PERIODS.length - 1} onClick={() => setPeriodIndex(i => Math.min(PERIODS.length - 1, i + 1))} className="rounded border border-theme-base p-1.5 text-theme-muted disabled:opacity-30"><Minus size={14} /></button></div></div>
     {history === null ? <div className="h-48 animate-pulse rounded-lg bg-theme-surface" /> : points.length < 2 ? <div className="rounded-lg border border-dashed border-theme-base px-4 py-10 text-center text-xs text-theme-muted">История накапливается. Для выбранного периода пока недостаточно котировок.</div> : <><div className="mb-2 flex flex-wrap items-center gap-4 text-[10px] font-bold">{market ? <><span className="text-theme-primary">Рыночная цена</span>{change && <span className="ml-auto flex items-center gap-1 text-theme-muted"><ChangeIcon size={13} />{money(change.absolute)} ₽{change.percent == null ? '' : ` · ${change.percent > 0 ? '+' : ''}${change.percent.toFixed(2)}%`}</span>}</> : <><span className="text-finance-income">Покупка</span><span className="text-finance-expense">Продажа</span>{currentSpread != null && <span className="ml-auto flex items-center gap-1 text-theme-muted"><ChangeIcon size={13} />Спред {money(currentSpread)} ₽{spreadChangePercent == null ? '' : ` · ${spreadChangePercent > 0 ? '+' : ''}${spreadChangePercent.toFixed(2)}%`}</span>}</>}</div><div className="h-48 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartPoints} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}><CartesianGrid strokeDasharray="3 3" strokeOpacity={.18} /><XAxis dataKey="label" tick={{ fontSize: 9 }} minTickGap={24} /><YAxis domain={[min - pad, max + pad]} tick={{ fontSize: 9 }} width={52} tickFormatter={v => money(Number(v))} /><Tooltip content={market ? <MarketTooltip /> : <BankTooltip />} />{market ? <Line type="monotone" dataKey="rate" name="Рыночная цена" stroke="#5678c7" strokeWidth={2} dot={false} activeDot={{ r: 4 }} /> : <><Line type="monotone" dataKey="buyRate" name="Покупка" stroke="#169b73" strokeWidth={2} dot={false} activeDot={{ r: 4 }} /><Line type="monotone" dataKey="sellRate" name="Продажа" stroke="#d05b58" strokeWidth={2} dot={false} activeDot={{ r: 4 }} /></>}</LineChart></ResponsiveContainer></div></>}</div>;
}

function MarketTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-lg border border-theme-base bg-theme-main p-3 text-xs shadow-lg"><div className="mb-2 font-bold text-theme-main">{label}</div><div className="flex justify-between gap-6"><span className="text-theme-primary">Рыночная цена</span><b>{money(payload[0].payload.rate)} ₽</b></div></div>;
}

function BankTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return <div className="rounded-lg border border-theme-base bg-theme-main p-3 text-xs shadow-lg"><div className="mb-2 font-bold text-theme-main">{label}</div><div className="flex justify-between gap-6"><span className="text-finance-income">Покупка</span><b>{money(point.buyRate)} ₽</b></div><div className="flex justify-between gap-6"><span className="text-finance-expense">Продажа</span><b>{money(point.sellRate)} ₽</b></div><div className="mt-2 border-t border-theme-base pt-2 text-theme-muted">Спред <b className="text-theme-main">{money(point.spread)} ₽ ({money(point.spreadPercent)}%)</b></div></div>;
}

interface CurrencyFormProps { currency: Currency | null; onClose: () => void; onSuccess: () => void; }
function CurrencyForm({ currency, onClose, onSuccess }: CurrencyFormProps) {
  const [currencyVal, setCurrencyVal] = useState(currency?.currency || ''); const [name, setName] = useState(currency?.name || ''); const [iso, setIso] = useState(currency?.iso || ''); const [rate, setRate] = useState(currency?.rate?.toFixed(2) || '1.00'); const [symbol, setSymbol] = useState(currency?.symbol || ''); const [saving, setSaving] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); if (!currencyVal.trim() || !name.trim() || !iso.trim() || !rate.trim()) return; setSaving(true); try { const data = { currency: currencyVal, name, iso, rate: parseFloat(rate), symbol }; if (currency) await currencyService.updateCurrency({ ...currency, ...data }); else await currencyService.addCurrency(data); onSuccess(); } catch (error) { console.error('Error saving currency:', error); } finally { setSaving(false); } };
  const handleDelete = async () => { if (!currency) return; setSaving(true); try { await currencyService.deleteCurrency(currency.id); onSuccess(); } catch (error) { console.error(error); } finally { setSaving(false); } };
  return <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/80 p-4"><div className="w-full max-w-md rounded-xl bg-theme-main shadow-2xl"><div className="flex items-center justify-between border-b border-theme-base px-6 py-4"><h3 className="text-sm font-black uppercase tracking-widest text-theme-main">{currency ? 'Редактировать' : 'Новая валюта'}</h3><button data-testid="button-close-currency-form" onClick={onClose}><X size={20} className="text-theme-muted" /></button></div><form onSubmit={handleSubmit} className="space-y-5 p-6"><Field label="Код (Currency)" value={currencyVal} onChange={setCurrencyVal} required /><Field label="Название" value={name} onChange={setName} required /><div className="grid grid-cols-2 gap-4"><Field label="ISO" value={iso} onChange={setIso} required /><Field label="Символ" value={symbol} onChange={setSymbol} /></div><Field label="Курс (к RUB)" type="number" value={rate} onChange={setRate} required /><div className="flex gap-3 pt-2">{currency && <button type="button" data-testid="button-delete-currency" onClick={handleDelete} disabled={saving} className="rounded-lg border border-theme-base p-3 text-theme-muted"><Trash2 size={20} /></button>}<button data-testid="button-save-currency" type="submit" disabled={saving} className="flex-1 rounded-lg bg-theme-primary py-3 text-[11px] font-black uppercase text-theme-on-primary">{saving ? 'Сохранение...' : currency ? 'Сохранить изменения' : 'Создать валюту'}</button></div></form></div></div>;
}
function Field({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return <label className="block space-y-1.5"><span className="ml-1 text-[10px] font-black uppercase tracking-widest text-theme-muted">{label}</span><input data-testid={`input-${label}`} type={type} value={value} onChange={e => onChange(e.target.value)} required={required} className="w-full rounded-lg border border-theme-base bg-theme-main px-4 py-3 text-sm font-bold text-theme-main outline-none focus:ring-1 ring-theme-primary/30" /></label>;
}