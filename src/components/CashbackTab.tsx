import React, { useState, useMemo } from 'react';
import { PlanData, CashbackEntry, CashbackCategory, Account } from '../types';
import { Pencil, Plus, Trash2, Check, X } from 'lucide-react';
import { cn } from '../lib/utils';
import CashbackCategoryManager from './CashbackCategoryManager';

interface CashbackTabProps {
  planData: PlanData;
  accounts: Account[];
  onSave: (newData: PlanData) => void;
}

export default function CashbackTab({ planData, accounts, onSave }: CashbackTabProps) {
  const [isEditorMode, setIsEditorMode] = useState(false);
  const [activeMonth, setActiveMonth] = useState<'past' | 'current' | 'future'>('current');
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showAssetSelector, setShowAssetSelector] = useState(false);

  const cashbackData = planData.cashback || { categories: [], entries: [] };

  const months = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const getMonthName = (date: Date) => date.toLocaleString('ru-RU', { month: 'long' });

    const past = new Date(currentYear, currentMonth - 1);
    const current = new Date(currentYear, currentMonth);
    const future = new Date(currentYear, currentMonth + 1);

    return {
      past: getMonthName(past),
      current: getMonthName(current),
      future: getMonthName(future),
    };
  }, []);

  const isGreyTheme = document.body.classList.contains('theme-grey');
  const activeMonthClass = (m: 'past' | 'current' | 'future') => cn(
    "px-4 py-2 rounded-xl text-sm font-bold transition-all capitalize",
    activeMonth === m 
      ? (isGreyTheme ? "bg-neutral-600 text-white" : "bg-purple-500 text-white")
      : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
  );
  const editorButtonClass = cn(
    "p-2 rounded-xl transition-all",
    isEditorMode 
      ? (isGreyTheme ? "bg-neutral-600 text-white" : "bg-purple-500 text-white shadow-lg shadow-purple-100")
      : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
  );
  const addAssetButtonClass = cn(
    "font-bold flex items-center justify-center gap-2 w-full",
    isGreyTheme ? "text-neutral-600" : "text-emerald-600"
  );

  const groupedEntries = useMemo(() => {
    return cashbackData.entries.reduce((acc, entry) => {
      if (!acc[entry.assetId]) acc[entry.assetId] = [];
      acc[entry.assetId].push(entry);
      return acc;
    }, {} as Record<string, CashbackEntry[]>);
  }, [cashbackData.entries]);

  const handleSaveCategories = (categories: CashbackCategory[]) => {
    onSave({ ...planData, cashback: { ...cashbackData, categories } });
    setShowCategoryManager(false);
  };

  const handleAddAsset = (assetId: string) => {
    onSave({
      ...planData,
      cashback: {
        ...cashbackData,
        entries: [...cashbackData.entries, { id: Date.now().toString(), assetId, categoryId: cashbackData.categories[0]?.id || '', percent: 0 }]
      }
    });
    setShowAssetSelector(false);
  };

  const handleAddEntry = (assetId: string) => {
    onSave({
      ...planData,
      cashback: {
        ...cashbackData,
        entries: [...cashbackData.entries, { id: Date.now().toString(), assetId, categoryId: cashbackData.categories[0]?.id || '', percent: 0 }]
      }
    });
  };

  const handleUpdateEntry = (id: string, field: keyof CashbackEntry, value: any) => {
    onSave({
      ...planData,
      cashback: {
        ...cashbackData,
        entries: cashbackData.entries.map(e => e.id === id ? { ...e, [field]: value } : e)
      }
    });
  };

  const handleDeleteEntry = (id: string) => {
    onSave({
      ...planData,
      cashback: {
        ...cashbackData,
        entries: cashbackData.entries.filter(e => e.id !== id)
      }
    });
  };

  return (
    <div className="flex h-full w-full">
      {/* Vertical Month Tabs and Toolbar */}
      <div className="flex flex-col border-r border-neutral-200 shrink-0">
        {(['past', 'current', 'future'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setActiveMonth(m)}
            className={cn(
              "px-3 py-1 text-sm font-bold transition-all capitalize [writing-mode:vertical-rl] rotate-180 whitespace-nowrap",
              activeMonth === m 
                ? (isGreyTheme ? "bg-neutral-200 text-neutral-900" : "bg-purple-100 text-purple-900")
                : "bg-neutral-50 text-neutral-500 hover:bg-neutral-100"
            )}
          >
            {months[m]}
          </button>
        ))}
        
        {/* Toolbar moved here */}
        <div className="flex flex-col items-center p-2 gap-2 mt-auto border-t border-neutral-200">
          {isEditorMode && (
            <button
              onClick={() => setShowCategoryManager(true)}
              className="p-2 bg-neutral-100 text-neutral-500 rounded-xl hover:bg-neutral-200"
              title="Управление категориями"
            >
              <Plus size={18} />
            </button>
          )}
          <button
            onClick={() => setIsEditorMode(!isEditorMode)}
            className={editorButtonClass}
            title={isEditorMode ? "Просмотр" : "Редактировать"}
          >
            <Pencil size={18} />
          </button>
        </div>
      </div>

      {/* Cashback Table Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Table */}
        <div className="flex-1 overflow-auto no-scrollbar p-0">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-white z-10">
              <tr>
                <th className="p-1 border border-neutral-200 text-xs font-bold text-neutral-500">Активы</th>
                <th className="p-1 border border-neutral-200 text-xs font-bold text-neutral-500">Процент</th>
                <th className="p-1 border border-neutral-200 text-xs font-bold text-neutral-500">Комментарий</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedEntries).map(([assetId, entries]) => (
                <React.Fragment key={assetId}>
                  <tr className="bg-neutral-100">
                    <td colSpan={3} className="px-3 font-bold text-sm flex justify-between items-center">
                      {assetId}
                      {isEditorMode && (
                        <button onClick={() => handleAddEntry(assetId)} className="py-1 text-emerald-600"><Plus size={16} /></button>
                      )}
                    </td>
                  </tr>
                  {entries.map(entry => {
                    const category = cashbackData.categories.find(c => c.id === entry.categoryId);
                    return (
                      <tr key={entry.id}>
                        <td className="py-0 border border-neutral-200 text-sm">
                          {isEditorMode ? (
                            <select value={entry.categoryId} onChange={(e) => handleUpdateEntry(entry.id, 'categoryId', e.target.value)} className="w-full p-1 border rounded">
                              {cashbackData.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          ) : (category?.name || 'Неизвестно')}
                        </td>
                        <td className="py-0 border border-neutral-200 text-sm text-center">
                          {isEditorMode ? (
                            <input type="number" value={entry.percent} onChange={(e) => handleUpdateEntry(entry.id, 'percent', parseFloat(e.target.value))} className="w-16 p-1 border rounded text-center" />
                          ) : `${entry.percent}%`}
                        </td>
                        <td className="py-0 border border-neutral-200 text-sm flex items-center gap-2">
                          {isEditorMode ? (
                            <>
                              <input type="text" value={entry.comment || ''} onChange={(e) => handleUpdateEntry(entry.id, 'comment', e.target.value)} className="flex-1 p-1 border rounded" />
                              <button onClick={() => handleDeleteEntry(entry.id)} className="text-rose-500"><Trash2 size={16} /></button>
                            </>
                          ) : entry.comment}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
              {isEditorMode && (
                <tr>
                  <td colSpan={3} className="p-3 text-center">
                    <button onClick={() => setShowAssetSelector(true)} className={addAssetButtonClass}>
                      <Plus size={18} /> Добавить актив
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAssetSelector && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-xl font-bold">Выберите актив</h3>
            <div className="space-y-2">
              {accounts.map(acc => (
                <button key={acc.id} onClick={() => handleAddAsset(acc.name)} className="w-full p-3 text-left border border-neutral-200 rounded-xl hover:bg-neutral-50">
                  {acc.name}
                </button>
              ))}
            </div>
            <button onClick={() => setShowAssetSelector(false)} className="w-full p-3 text-neutral-500">Отмена</button>
          </div>
        </div>
      )}

      {showCategoryManager && (
        <CashbackCategoryManager
          categories={cashbackData.categories}
          onSave={handleSaveCategories}
          onClose={() => setShowCategoryManager(false)}
        />
      )}
    </div>
  );
}
