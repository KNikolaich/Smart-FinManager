import React, { useState, useMemo, useEffect } from 'react';
import { PlanData, CashbackEntry, CashbackCategory, Account, CashbackMonth } from '../types';
import { Pencil, Plus, Trash2, Check, X, Copy } from 'lucide-react';
import { cn } from '../lib/utils';
import CashbackCategoryManager from './CashbackCategoryManager';

interface CashbackTabProps {
  planData: PlanData;
  accounts: Account[];
  onSave: (newData: PlanData) => void;
}

export default function CashbackTab({ planData, accounts, onSave }: CashbackTabProps) {
  const [isEditorMode, setIsEditorMode] = useState(false);
  const [activeMonthId, setActiveMonthId] = useState<string>('');
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showAssetSelector, setShowAssetSelector] = useState(false);
  const [monthToDelete, setMonthToDelete] = useState<string | null>(null);

  const cashbackData = useMemo(() => {
    const data = planData.cashback || { categories: [], months: [] };
    
    // Migration logic
    if (!data.months || data.months.length === 0) {
      const now = new Date();
      const months: CashbackMonth[] = [];
      
      for (let i = -1; i <= 1; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i);
        const id = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleString('ru-RU', { month: 'long' });
        months.push({
          id,
          label,
          entries: i === 0 ? (data.entries || []) : []
        });
      }
      return { ...data, months };
    }
    return data;
  }, [planData.cashback]);

  useEffect(() => {
    if (!activeMonthId && cashbackData.months.length > 0) {
      const now = new Date();
      const currentId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const found = cashbackData.months.find(m => m.id === currentId);
      setActiveMonthId(found ? found.id : cashbackData.months[0].id);
    }
  }, [cashbackData.months, activeMonthId]);

  const activeMonth = useMemo(() => {
    return cashbackData.months.find(m => m.id === activeMonthId) || cashbackData.months[0];
  }, [cashbackData.months, activeMonthId]);

  const sortedMonths = useMemo(() => {
    return [...cashbackData.months].sort((a, b) => a.id.localeCompare(b.id));
  }, [cashbackData.months]);

  const groupedEntries = useMemo(() => {
    if (!activeMonth) return {};
    return activeMonth.entries.reduce((acc, entry) => {
      if (!acc[entry.assetId]) acc[entry.assetId] = [];
      acc[entry.assetId].push(entry);
      return acc;
    }, {} as Record<string, CashbackEntry[]>);
  }, [activeMonth]);

  const isGreyTheme = document.body.classList.contains('theme-grey');
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

  const handleSaveData = (data: any) => {
    onSave({ ...planData, cashback: data });
  };

  const handleSaveCategories = (categories: CashbackCategory[]) => {
    handleSaveData({ ...cashbackData, categories });
    setShowCategoryManager(false);
  };

  const handleAddAsset = (assetId: string) => {
    if (!activeMonthId) return;
    const newMonths = cashbackData.months.map(m => {
      if (m.id === activeMonthId) {
        return {
          ...m,
          entries: [...m.entries, { id: Date.now().toString(), assetId, categoryId: cashbackData.categories[0]?.id || '', percent: 0 }]
        };
      }
      return m;
    });
    handleSaveData({ ...cashbackData, months: newMonths });
    setShowAssetSelector(false);
  };

  const handleAddEntry = (assetId: string) => {
    if (!activeMonthId) return;
    const newMonths = cashbackData.months.map(m => {
      if (m.id === activeMonthId) {
        return {
          ...m,
          entries: [...m.entries, { id: Date.now().toString(), assetId, categoryId: cashbackData.categories[0]?.id || '', percent: 0 }]
        };
      }
      return m;
    });
    handleSaveData({ ...cashbackData, months: newMonths });
  };

  const handleUpdateEntry = (id: string, field: keyof CashbackEntry, value: any) => {
    if (!activeMonthId) return;
    const newMonths = cashbackData.months.map(m => {
      if (m.id === activeMonthId) {
        return {
          ...m,
          entries: m.entries.map(e => e.id === id ? { ...e, [field]: value } : e)
        };
      }
      return m;
    });
    handleSaveData({ ...cashbackData, months: newMonths });
  };

  const handleDeleteEntry = (id: string) => {
    if (!activeMonthId) return;
    const newMonths = cashbackData.months.map(m => {
      if (m.id === activeMonthId) {
        return {
          ...m,
          entries: m.entries.filter(e => e.id !== id)
        };
      }
      return m;
    });
    handleSaveData({ ...cashbackData, months: newMonths });
  };

  const handleAddMonth = () => {
    const lastMonthId = sortedMonths[sortedMonths.length - 1]?.id;
    let nextDate: Date;
    if (lastMonthId) {
      const [y, m] = lastMonthId.split('-').map(Number);
      nextDate = new Date(y, m); // Month is 1-indexed in ID, Date uses 0-indexed for month so this gives next month
    } else {
      nextDate = new Date();
    }
    
    const id = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    const label = nextDate.toLocaleString('ru-RU', { month: 'long' });
    
    if (cashbackData.months.some(m => m.id === id)) return;

    const newMonth: CashbackMonth = { id, label, entries: [] };
    handleSaveData({ ...cashbackData, months: [...cashbackData.months, newMonth] });
    setActiveMonthId(id);
  };

  const handleCopyFromPrevious = () => {
    if (!activeMonthId) return;
    const currentIndex = sortedMonths.findIndex(m => m.id === activeMonthId);
    if (currentIndex <= 0) return;
    
    const previousMonth = sortedMonths[currentIndex - 1];
    const newMonths = cashbackData.months.map(m => {
      if (m.id === activeMonthId) {
        return {
          ...m,
          entries: previousMonth.entries.map(e => ({ ...e, id: Math.random().toString(36).substr(2, 9) }))
        };
      }
      return m;
    });
    handleSaveData({ ...cashbackData, months: newMonths });
  };

  const handleDeleteMonth = (id: string) => {
    const newMonths = cashbackData.months.filter(m => m.id !== id);
    handleSaveData({ ...cashbackData, months: newMonths });
    if (activeMonthId === id) {
      const remaining = [...newMonths].sort((a, b) => a.id.localeCompare(b.id));
      setActiveMonthId(remaining[remaining.length - 1]?.id || '');
    }
    setMonthToDelete(null);
  };

  const nowId = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  return (
    <div className="flex h-full w-full">
      {/* Vertical Month Tabs and Toolbar */}
      <div className="flex flex-col border-r border-neutral-200 shrink-0 bg-neutral-50 overflow-y-auto no-scrollbar">
        <div className="flex flex-col">
          {sortedMonths.map((m) => {
            const isPast = m.id < nowId;
            return (
              <div key={m.id} className="relative group">
                <button
                  onClick={() => setActiveMonthId(m.id)}
                  className={cn(
                    "px-3 py-4 text-[10px] font-bold transition-all capitalize [writing-mode:vertical-rl] rotate-180 whitespace-nowrap border-b border-neutral-200 w-10",
                    activeMonthId === m.id 
                      ? (isGreyTheme ? "bg-neutral-200 text-neutral-900 shadow-inner" : "bg-purple-100 text-purple-900 shadow-inner")
                      : "bg-neutral-50 text-neutral-500 hover:bg-neutral-100"
                  )}
                >
                  {m.label} {m.id.split('-')[0].slice(2)}
                </button>
                {isPast && isEditorMode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setMonthToDelete(m.id);
                    }}
                    className="absolute bottom-1 right-1 p-1 bg-white/80 text-rose-500 rounded-md opacity-0 group-hover:opacity-100 shadow-sm transition-all z-10"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            );
          })}
          
          <button
            onClick={handleAddMonth}
            className="p-3 text-emerald-500 hover:bg-emerald-50 transition-colors border-b border-neutral-200 flex items-center justify-center"
            title="Добавить месяц"
          >
            <Plus size={16} />
          </button>
        </div>
        
        {/* Toolbar */}
        <div className="flex flex-col items-center p-2 gap-2 mt-auto border-t border-neutral-200 sticky bottom-0 bg-neutral-50">
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
        {/* Header with Copy Action */}
        <div className="px-4 py-2 bg-white border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-neutral-900 capitalize">{activeMonth?.label}</h2>
            <span className="text-[10px] font-mono text-neutral-400">{activeMonth?.id}</span>
          </div>
          {isEditorMode && activeMonth && activeMonth.entries.length === 0 && (
            <button 
              onClick={handleCopyFromPrevious}
              className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              <Copy size={12} />
              Скопировать с предыдущего
            </button>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto no-scrollbar p-0">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-white z-10 shadow-sm">
              <tr>
                <th className="p-2 border border-neutral-200 text-[10px] font-bold text-neutral-400 uppercase tracking-wider text-left">Активы</th>
                <th className="p-2 border border-neutral-200 text-[10px] font-bold text-neutral-400 uppercase tracking-wider text-center w-20">Процент</th>
                <th className="p-2 border border-neutral-200 text-[10px] font-bold text-neutral-400 uppercase tracking-wider text-left">Комментарий</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedEntries).length === 0 && !isEditorMode && (
                <tr>
                  <td colSpan={3} className="p-12 text-center text-neutral-400 italic text-sm">
                    Нет данных о кэшбеке на этот месяц
                  </td>
                </tr>
              )}
              {Object.entries(groupedEntries).map(([assetId, entries]) => (
                <React.Fragment key={assetId}>
                  <tr className="bg-neutral-50/50">
                    <td colSpan={3} className="px-3 py-2 font-bold text-xs flex justify-between items-center border border-neutral-200">
                      <span className="text-neutral-700">{assetId}</span>
                      {isEditorMode && (
                        <button onClick={() => handleAddEntry(assetId)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md"><Plus size={14} /></button>
                      )}
                    </td>
                  </tr>
                  {entries.map(entry => {
                    const category = cashbackData.categories.find(c => c.id === entry.categoryId);
                    return (
                      <tr key={entry.id} className="hover:bg-neutral-50/30 transition-colors">
                        <td className="p-1 border border-neutral-200 text-sm">
                          {isEditorMode ? (
                            <select 
                              value={entry.categoryId} 
                              onChange={(e) => handleUpdateEntry(entry.id, 'categoryId', e.target.value)} 
                              className="w-full p-1 bg-white border border-neutral-100 rounded text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                            >
                              {cashbackData.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category?.color }} />
                              <span className="text-xs">{category?.name || 'Неизвестно'}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-1 border border-neutral-200 text-sm text-center">
                          {isEditorMode ? (
                            <div className="flex items-center">
                              <input 
                                type="number" 
                                value={entry.percent} 
                                onChange={(e) => handleUpdateEntry(entry.id, 'percent', parseFloat(e.target.value))} 
                                className="w-full p-1 bg-white border border-neutral-100 rounded text-xs text-center focus:ring-1 focus:ring-purple-500 focus:outline-none"
                              />
                              <span className="text-[10px] ml-1 text-neutral-400">%</span>
                            </div>
                          ) : (
                            <span className="text-xs font-mono font-bold text-neutral-700">{entry.percent}%</span>
                          )}
                        </td>
                        <td className="p-1 border border-neutral-200 text-sm">
                          <div className="flex items-center gap-2">
                            {isEditorMode ? (
                              <>
                                <input 
                                  type="text" 
                                  value={entry.comment || ''} 
                                  onChange={(e) => handleUpdateEntry(entry.id, 'comment', e.target.value)} 
                                  className="flex-1 p-1 bg-white border border-neutral-100 rounded text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none" 
                                  placeholder="Прим."
                                />
                                <button onClick={() => handleDeleteEntry(entry.id)} className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"><Trash2 size={14} /></button>
                              </>
                            ) : (
                              <span className="text-xs text-neutral-500 line-clamp-1">{entry.comment}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
              {isEditorMode && (
                <tr>
                  <td colSpan={3} className="p-3 border border-neutral-200">
                    <button onClick={() => setShowAssetSelector(true)} className={addAssetButtonClass}>
                      <Plus size={16} /> <span className="text-xs">Добавить актив</span>
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAssetSelector && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Выберите актив</h3>
              <button onClick={() => setShowAssetSelector(false)} className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-1.5 overflow-y-auto no-scrollbar pr-1">
              {accounts.map(acc => (
                <button 
                  key={acc.id} 
                  onClick={() => handleAddAsset(acc.name)} 
                  className="w-full p-4 text-left bg-neutral-50 hover:bg-neutral-100 border border-neutral-100 rounded-2xl transition-all font-bold text-sm text-neutral-700 flex items-center justify-between group"
                >
                  {acc.name}
                  <Plus size={16} className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
            <button 
              onClick={() => setShowAssetSelector(false)} 
              className="mt-6 w-full p-4 bg-neutral-100 text-neutral-500 rounded-2xl font-bold text-sm hover:bg-neutral-200 transition-colors"
            >
              Отмена
            </button>
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

      {/* Month Delete Confirmation Modal */}
      {monthToDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-500 mb-4">
              <Trash2 size={24} />
              <h4 className="font-bold text-lg">Удалить месяц?</h4>
            </div>
            <p className="text-neutral-500 text-sm mb-6">
              Вы хотите удалить данные за {cashbackData.months.find(m => m.id === monthToDelete)?.label}. Это действие нельзя отменить.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setMonthToDelete(null)}
                className="flex-1 px-4 py-2 bg-neutral-100 text-neutral-500 rounded-xl font-bold text-sm hover:bg-neutral-200 transition-colors"
                type="button"
              >
                Отмена
              </button>
              <button 
                onClick={() => handleDeleteMonth(monthToDelete)}
                className="flex-1 px-4 py-2 bg-rose-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-rose-200 hover:bg-rose-600 transition-colors"
                type="button"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
