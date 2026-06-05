import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { currencyService } from '../services/currencyService';
import { Currency, UserProfile } from '../types';
import { Plus, Trash2, X, Check, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

export const CurrencyTable: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [updatingRates, setUpdatingRates] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);

  const fetchCurrencies = async () => {
    try {
      const data = await currencyService.getCurrencies();
      setCurrencies(data.sort((a, b) => (a.currency || '').localeCompare(b.currency || '')));
    } catch (error) {
      console.error('Error fetching currencies:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchUserAndSeed = async () => {
      try {
        const userData = await api.get<UserProfile>('/auth/me');
        setUser(userData);
        if (userData.role === 'admin') {
          await currencyService.seedDefaultCurrencies();
        }
      } catch (err) {
        console.error('Error fetching user for role check or seeding:', err);
      }
    };
    fetchUserAndSeed();
    fetchCurrencies();
  }, []);

  const isAdmin = user?.role === 'admin';

  const handleUpdateRates = async () => {
    setUpdatingRates(true);
    try {
      // One call to get all RUB rates
      const data = await api.get<any>(`/currencies/rates/RUB`);
      
      if (data.result === 'success' && data.conversion_rates) {
        for (const cur of currencies) {
          if (cur.iso === 'RUB') continue;
          
          const rateToRub = data.conversion_rates[cur.iso];
          if (rateToRub) {
            // If 1 RUB = X USD, then 1 USD = 1/X RUB
            const rate = 1 / rateToRub;
            await currencyService.updateCurrency({ ...cur, rate });
          }
        }
        await fetchCurrencies();
      }
    } catch (error) {
      console.error('Error updating rates:', error);
    } finally {
      setUpdatingRates(false);
    }
  };

  const handleDeleteCurrency = async (id: string) => {
    try {
      await currencyService.deleteCurrency(id);
      setDeleteConfirmId(null);
      await fetchCurrencies();
    } catch (error) {
      console.error('Error deleting currency:', error);
    }
  };

  if (loading) return <div className="p-4 text-gray-500">Loading currencies...</div>;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 lg:p-8 bg-black/80 backdrop-blur-xl">
      <div className="relative w-full h-full lg:h-auto lg:max-w-4xl bg-theme-main lg:rounded-xl lg:border border-neutral-100 shadow-2xl flex flex-col animate-in fade-in zoom-in duration-300 shadow-black/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-theme-surface/10 backdrop-blur-sm shrink-0">
          <h3 className="text-sm font-black uppercase text-theme-main drop-shadow-sm">ВАЛЮТЫ</h3>
          <div className="flex items-center gap-2 relative z-20">
            {isAdmin && (
              <>
                <button 
                  onClick={handleUpdateRates}
                  disabled={updatingRates}
                  className="px-3 py-1 bg-theme-surface border border-neutral-100 text-theme-muted hover:text-theme-main rounded-lg font-black uppercase tracking-widest text-[8px] transition-all disabled:opacity-50"
                >
                  {updatingRates ? '...' : 'Обновить'}
                </button>
                <button 
                  onClick={() => {
                    setEditingCurrency(null);
                    setShowFormModal(true);
                  }}
                  className="w-10 h-10 bg-theme-primary text-theme-on-primary rounded-lg flex items-center justify-center shadow-lg shadow-theme-primary/40 hover:scale-105 active:scale-95 transition-all group"
                  title="Добавить валюту"
                >
                  <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" strokeWidth={3} />
                </button>
              </>
            )}
            {onClose && (
              <button 
                onClick={onClose} 
                className="p-2.5 bg-theme-main/50 border border-theme-base text-theme-main rounded-xl shadow-md hover:bg-theme-main transition-all relative z-20 cursor-pointer flex items-center justify-center active:scale-95 h-10 w-10"
                title="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 lg:p-10 no-scrollbar bg-theme-main">
          <div className="overflow-hidden border border-neutral-50 rounded-lg shadow-sm">
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="bg-theme-surface/50 border-b border-neutral-50 text-[10px] font-black text-theme-muted uppercase tracking-tighter">
                  <th className="px-6 py-3 border-r border-neutral-50/50">Наименование (ISO/Символ)</th>
                  <th className="px-4 py-3">Курс</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50 bg-white">
                {currencies.map((cur) => (
                  <tr 
                    key={cur.id} 
                    className={cn(
                      "transition-colors tabular-nums",
                      isAdmin ? "hover:bg-theme-surface/30 cursor-pointer" : ""
                    )}
                    onClick={() => { 
                      if (isAdmin) {
                        setEditingCurrency(cur); 
                        setShowFormModal(true);
                      }
                    }}
                  >
                    <td className="px-6 py-4 border-r border-neutral-50/50">
                        <div className="font-bold text-sm text-theme-main truncate">{cur.name}</div>
                        <div className="font-mono text-xs text-theme-muted truncate">{cur.iso} • {cur.symbol || '-'}</div>
                    </td>
                    <td className="px-4 py-4 font-black italic text-theme-primary tabular-nums">
                      {cur.rate?.toFixed(2) || '1.00'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Currency Form Modal (Add/Edit) */}
      {showFormModal && (
        <CurrencyForm 
          currency={editingCurrency}
          onClose={() => setShowFormModal(false)}
          onSuccess={() => {
            setShowFormModal(false);
            fetchCurrencies();
          }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-0 lg:p-8 bg-black/80 backdrop-blur-xl">
          <div className="relative w-full h-full lg:h-auto lg:max-w-sm bg-theme-main lg:rounded-xl lg:border border-neutral-100 shadow-2xl flex flex-col animate-in fade-in zoom-in duration-300 shadow-black/50 overflow-hidden">
            <div className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mx-auto shadow-sm">
                <AlertTriangle size={40} />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-widest text-theme-main">Удалить валюту?</h3>
                <p className="text-xs text-theme-muted font-bold mt-2">Это действие нельзя будет отменить.</p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button 
                  onClick={() => handleDeleteCurrency(deleteConfirmId)} 
                  className="w-full py-4 bg-rose-500 text-white rounded-lg font-black uppercase tracking-widest text-[10px] hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20"
                >
                  Удалить навсегда
                </button>
                <button 
                  onClick={() => setDeleteConfirmId(null)} 
                  className="w-full py-4 bg-theme-surface border border-neutral-100 text-theme-muted hover:text-theme-main rounded-lg font-black uppercase tracking-widest text-[10px] transition-all"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface CurrencyFormProps {
  currency: Currency | null;
  onClose: () => void;
  onSuccess: () => void;
}

function CurrencyForm({ currency, onClose, onSuccess }: CurrencyFormProps) {
  const [currencyVal, setCurrencyVal] = useState(currency?.currency || '');
  const [name, setName] = useState(currency?.name || '');
  const [iso, setIso] = useState(currency?.iso || '');
  const [rate, setRate] = useState(currency?.rate?.toFixed(2) || '1.00');
  const [symbol, setSymbol] = useState(currency?.symbol || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currencyVal.trim() || !name.trim() || !iso.trim() || !rate.trim()) return;
    
    setSaving(true);
    try {
      const rateNum = parseFloat(rate);
      if (currency) {
        await currencyService.updateCurrency({ ...currency, currency: currencyVal, name, iso, rate: rateNum, symbol });
      } else {
        await currencyService.addCurrency({ currency: currencyVal, name, iso, rate: rateNum, symbol });
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving currency:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currency) return;
    setSaving(true);
    try {
      await currencyService.deleteCurrency(currency.id);
      onSuccess();
    } catch (error) {
      console.error('Error deleting currency:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 lg:p-8 bg-black/80 backdrop-blur-xl">
      <div className="relative w-full h-full lg:h-auto lg:max-w-md bg-theme-main lg:rounded-xl lg:border border-neutral-100 shadow-2xl flex flex-col animate-in fade-in zoom-in duration-300 shadow-black/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-theme-surface/10 backdrop-blur-sm shrink-0">
          <h3 className="text-sm font-black uppercase tracking-widest text-theme-main">{currency ? 'Редактировать' : 'Новая валюта'}</h3>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-neutral-100/50 rounded-full transition-colors"
          >
            <X size={20} className="text-theme-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 lg:p-10 space-y-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest ml-1">Код (Currency)</label>
            <input
              type="text"
              value={currencyVal}
              onChange={(e) => setCurrencyVal(e.target.value)}
              className="w-full bg-theme-main border border-theme-base rounded-lg px-4 py-3 text-sm font-bold outline-none focus:ring-1 ring-theme-primary/30 transition-all text-theme-main"
              placeholder="e.g. Dollar"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest ml-1">Название</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-theme-main border border-theme-base rounded-lg px-4 py-3 text-sm font-bold outline-none focus:ring-1 ring-theme-primary/30 transition-all text-theme-main"
              placeholder="e.g. Доллар США"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest ml-1">ISO</label>
              <input
                type="text"
                value={iso}
                onChange={(e) => setIso(e.target.value)}
                className="w-full bg-theme-main border border-theme-base rounded-lg px-4 py-3 text-sm font-bold outline-none focus:ring-1 ring-theme-primary/30 transition-all text-theme-main"
                placeholder="USD"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest ml-1">Символ</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full bg-theme-main border border-theme-base rounded-lg px-4 py-3 text-sm font-bold outline-none focus:ring-1 ring-theme-primary/30 transition-all text-theme-main"
                placeholder="$"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest ml-1">Курс (к RUB)</label>
            <input
              type="number"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="w-full bg-theme-main border border-theme-base rounded-lg px-4 py-3 font-black italic text-theme-primary outline-none focus:ring-1 ring-theme-primary/30 transition-all"
              required
            />
          </div>
          <div className="flex gap-3 pt-4">
            {currency && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="p-3 text-theme-muted hover:text-rose-500 transition-colors border border-neutral-50 rounded-lg hover:bg-theme-main"
              >
                <Trash2 size={22} />
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-theme-primary text-theme-on-primary py-3 rounded-lg font-black uppercase tracking-widest text-[11px] hover:bg-theme-primary-dark transition-all shadow-lg shadow-theme-primary/20 disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : (currency ? 'Сохранить изменения' : 'Создать валюту')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
