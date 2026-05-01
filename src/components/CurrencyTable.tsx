import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { currencyService } from '../services/currencyService';
import { Currency } from '../types';
import { Plus, Trash2, X, Check, AlertTriangle } from 'lucide-react';

export const CurrencyTable: React.FC = () => {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [updatingRates, setUpdatingRates] = useState(false);

  useEffect(() => {
    currencyService.seedDefaultCurrencies();

    const unsubscribe = currencyService.subscribeToCurrencies((data) => {
      setCurrencies(data.sort((a, b) => (a.currency || '').localeCompare(b.currency || '')));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateRates = async () => {
    setUpdatingRates(true);
    try {
      for (const cur of currencies) {
        if (cur.iso === 'RUB') continue;

        const data = await api.get<any>(`/currencies/rates/${cur.iso}`);
        if (data.result === 'success' && data.conversion_rates && data.conversion_rates.RUB) {
          await currencyService.updateCurrency({ ...cur, rate: data.conversion_rates.RUB });
        }
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
      // Refresh will be handled by subscription
    } catch (error) {
      console.error('Error deleting currency:', error);
    }
  };

  if (loading) return <div className="p-4 text-gray-500">Loading currencies...</div>;

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button 
            onClick={handleUpdateRates}
            disabled={updatingRates}
            className="flex items-center gap-2 bg-theme-primary text-white px-4 py-2 rounded-xl hover:bg-theme-primary-dark transition-all font-bold text-sm disabled:opacity-50"
          >
            {updatingRates ? 'Обновление...' : 'Обновить курсы'}
          </button>
          <button 
            onClick={() => {
              setEditingCurrency(null);
              setShowFormModal(true);
            }}
            className="flex items-center gap-2 bg-theme-primary text-white px-4 py-2 rounded-xl hover:bg-theme-primary-dark transition-all font-bold text-sm"
          >
            <Plus size={18} />
            Добавить
          </button>
        </div>
      </div>
      <div className="overflow-hidden border rounded shadow-inner">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="px-4 py-2 text-left font-medium text-gray-600 border-r">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-blue-500">A-Z</span>
                  <span>Наименование</span>
                </div>
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600 border-r">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-blue-500">A-Z</span>
                  <span>ISO</span>
                </div>
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600 border-r">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-blue-500">#</span>
                  <span>Курс</span>
                </div>
              </th>
              <th className="px-4 py-2 text-center font-medium text-gray-600">
                Символ
              </th>
            </tr>
          </thead>
          <tbody>
            {currencies.map((cur) => (
              <tr key={cur.id} className="border-b last:border-b-0 hover:bg-blue-50/50 transition-colors cursor-pointer" onClick={() => { setEditingCurrency(cur); setShowFormModal(true); }}>
                <td className="px-4 py-2 border-r text-gray-700">{cur.name}</td>
                <td className="px-4 py-2 border-r text-gray-700">{cur.iso}</td>
                <td className="px-4 py-2 border-r text-gray-700">{cur.rate?.toFixed(2) || '1.00'}</td>
                <td className="px-4 py-2 text-center text-gray-700">{cur.symbol || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Currency Form Modal (Add/Edit) */}
      {showFormModal && (
        <CurrencyForm 
          currency={editingCurrency}
          onClose={() => setShowFormModal(false)}
          onSuccess={() => {
            setShowFormModal(false);
            // Refresh will be handled by subscription
          }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-3xl shadow-xl max-w-sm w-full text-center">
            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-bold mb-2">Удалить валюту?</h3>
            <p className="text-neutral-500 mb-6 text-sm">Это действие нельзя будет отменить.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteConfirmId(null)} 
                className="flex-1 py-3 rounded-2xl bg-neutral-100 font-bold hover:bg-neutral-200 transition-colors"
              >
                Отмена
              </button>
              <button 
                onClick={() => handleDeleteCurrency(deleteConfirmId)} 
                className="flex-1 py-3 rounded-2xl bg-rose-500 text-white font-bold hover:bg-rose-600 transition-colors shadow-lg shadow-rose-100"
              >
                Удалить
              </button>
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-6 relative">
        <div className="flex items-center justify-between relative z-10">
          <h3 className="text-xl font-bold">{currency ? 'Редактировать валюту' : 'Новая валюта'}</h3>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-neutral-100 rounded-full transition-colors cursor-pointer relative z-20"
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-500 uppercase">CURRENCY</label>
            <input
              type="text"
              value={currencyVal}
              onChange={(e) => setCurrencyVal(e.target.value)}
              className="w-full p-3 bg-neutral-50 border border-neutral-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-500 uppercase">NAME</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 bg-neutral-50 border border-neutral-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-500 uppercase">ISO</label>
            <input
              type="text"
              value={iso}
              onChange={(e) => setIso(e.target.value)}
              className="w-full p-3 bg-neutral-50 border border-neutral-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-500 uppercase">RATE</label>
            <input
              type="number"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="w-full p-3 bg-neutral-50 border border-neutral-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-500 uppercase">SYMBOL</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full p-3 bg-neutral-50 border border-neutral-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex gap-3 pt-2">
            {currency && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="bg-rose-50 text-rose-600 py-3 px-6 rounded-2xl font-bold hover:bg-rose-100 transition-all disabled:opacity-50"
              >
                <Trash2 size={20} />
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-theme-primary text-white py-3 rounded-2xl font-bold hover:bg-theme-primary-dark transition-all disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
