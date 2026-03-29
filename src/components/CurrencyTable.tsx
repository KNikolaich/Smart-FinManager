import React, { useEffect, useState } from 'react';
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
      setCurrencies(data.sort((a, b) => a.curUid.localeCompare(b.curUid)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateRates = async () => {
    setUpdatingRates(true);
    try {
      for (const cur of currencies) {
        if (cur.iso === 'RUB') continue;

        const response = await fetch(`https://v6.exchangerate-api.com/v6/10e51cc83f012c14085c363d/latest/${cur.iso}`);
        const data = await response.json();
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
        <h2 className="text-lg font-semibold text-gray-800">Currency Table</h2>
        <div className="flex gap-2">
          <button 
            onClick={handleUpdateRates}
            disabled={updatingRates}
            className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-xl hover:bg-blue-600 transition-all font-bold text-sm disabled:opacity-50"
          >
            {updatingRates ? 'Обновление...' : 'Обновить курсы'}
          </button>
          <button 
            onClick={() => {
              setEditingCurrency(null);
              setShowFormModal(true);
            }}
            className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-xl hover:bg-emerald-600 transition-all font-bold text-sm"
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
                  <span>CUR_UID</span>
                </div>
              </th>
              <th className="px-4 py-2 text-left font-medium text-gray-600 border-r">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-blue-500">A-Z</span>
                  <span>NAME</span>
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
                  <span>RATE</span>
                </div>
              </th>
              <th className="px-4 py-2 text-center font-medium text-gray-600">
                Действия
              </th>
            </tr>
          </thead>
          <tbody>
            {currencies.map((cur) => (
              <tr key={cur.id} className="border-b last:border-b-0 hover:bg-blue-50/50 transition-colors cursor-pointer" onClick={() => { setEditingCurrency(cur); setShowFormModal(true); }}>
                <td className="px-4 py-2 border-r text-gray-700">{cur.curUid}</td>
                <td className="px-4 py-2 border-r text-gray-700">{cur.name}</td>
                <td className="px-4 py-2 border-r text-gray-700">{cur.iso}</td>
                <td className="px-4 py-2 border-r text-gray-700">{cur.rate?.toFixed(4) || '1.0000'}</td>
                <td className="px-4 py-2 text-center">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(cur.id);
                    }}
                    className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
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
  const [curUid, setCurUid] = useState(currency?.curUid || '');
  const [name, setName] = useState(currency?.name || '');
  const [iso, setIso] = useState(currency?.iso || '');
  const [rate, setRate] = useState(currency?.rate?.toString() || '1.0');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!curUid.trim() || !name.trim() || !iso.trim() || !rate.trim()) return;
    
    setSaving(true);
    try {
      const rateNum = parseFloat(rate);
      if (currency) {
        await currencyService.updateCurrency({ ...currency, curUid, name, iso, rate: rateNum });
      } else {
        await currencyService.addCurrency({ curUid, name, iso, rate: rateNum });
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving currency:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">{currency ? 'Редактировать валюту' : 'Новая валюта'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-500 uppercase">CUR_UID</label>
            <input
              type="text"
              value={curUid}
              onChange={(e) => setCurUid(e.target.value)}
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
              step="0.0001"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="w-full p-3 bg-neutral-50 border border-neutral-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-emerald-500 text-white py-3 rounded-2xl font-bold hover:bg-emerald-600 transition-all disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </form>
      </div>
    </div>
  );
}
