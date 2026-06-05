import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { Category, TransactionType } from '../types';
import { X, Plus, Trash2, Tag, Check, AlertTriangle, ChevronDown } from 'lucide-react';

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

interface CategoryManagerProps {
  onClose: () => void;
  onRefresh?: () => void;
}

const COMMON_ICONS = [
  '💰', '🛒', '🍔', '🚗', '🏠', '🏥', '🎁', '🎓', '✈️', '🎮',
  '📱', '👕', '🧼', '🐾', '💡', '🛠️', '📈', '📉', '🏦', '💳',
  '🍕', '☕', '🍿', '🎬', '🎭', '🎨', '🎤', '🎧', '🎸', '🎹',
  '⚽', '🏀', '🎾', '🏐', '🚴', '🏊', '🏋️', '🧘', '🏕️', '🏖️',
  '🍎', '🥦', '🥩', '🥖', '🥛', '🍷', '🍺', '🍹', '🍦', '🍰',
  '🚌', '🚲', '🚕', '🚂', '🚢', '🚀', '⛽', '🅿️', '🚧', '🗺️',
  '💻', '🖥️', '⌨️', '🖱️', '🔋', '🔌', '📡', '🔒', '🔑', '🔨',
  '📚', '✏️', '📎', '✂️', '📏', '📅', '📌', '🔍', '📢', '🔔',
  '❤️', '⭐', '🔥', '✨', '🌈', '☀️', '🌙', '☁️', '🌧️', '❄️'
];

export default function CategoryManager({ onClose, onRefresh }: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const fetchedCategories = await api.get<Category[]>('/categories');
      // Sort alphabetically by name
      fetchedCategories.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setCategories(fetchedCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupedExpenseCategories = useMemo(() => {
    const roots = categories.filter(c => c.type === 'expense' && !c.parentId);
    // Sort by sortOrder (nulls last), then name
    roots.sort((a, b) => {
      const aOrder = a.sortOrder ?? Infinity;
      const bOrder = b.sortOrder ?? Infinity;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.name || '').localeCompare(b.name || '');
    });
    return roots.map(root => ({
      ...root,
      children: categories.filter(c => c.type === 'expense' && c.parentId === root.id).sort((a, b) => {
        const aOrder = a.sortOrder ?? Infinity;
        const bOrder = b.sortOrder ?? Infinity;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (a.name || '').localeCompare(b.name || '');
      })
    }));
  }, [categories]);

  const groupedIncomeCategories = useMemo(() => {
    const roots = categories.filter(c => c.type === 'income' && !c.parentId);
    // Sort by sortOrder (nulls last), then name
    roots.sort((a, b) => {
      const aOrder = a.sortOrder ?? Infinity;
      const bOrder = b.sortOrder ?? Infinity;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.name || '').localeCompare(b.name || '');
    });
    return roots.map(root => ({
      ...root,
      children: categories.filter(c => c.type === 'income' && c.parentId === root.id).sort((a, b) => {
        const aOrder = a.sortOrder ?? Infinity;
        const bOrder = b.sortOrder ?? Infinity;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (a.name || '').localeCompare(b.name || '');
      })
    }));
  }, [categories]);

  const handleDeleteCategory = async (id: string) => {
    try {
      await api.delete(`/categories/${id}`);
      setDeleteConfirmId(null);
      setShowFormModal(false);
      fetchCategories();
      onRefresh?.();
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 lg:p-8 bg-black/80 backdrop-blur-xl">
      <div className="relative w-full h-full lg:max-h-full lg:max-w-3xl bg-theme-main lg:rounded-xl lg:border border-neutral-100 shadow-2xl flex flex-col animate-in fade-in zoom-in duration-300 shadow-black/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-theme-surface/10 backdrop-blur-sm shrink-0">
          <h3 className="text-sm font-black uppercase text-theme-main drop-shadow-sm">КАТЕГОРИИ</h3>
          <div className="flex items-center gap-2 relative z-20">
            <button 
              onClick={() => {
                setEditingCategory(null);
                setShowFormModal(true);
              }}
              className="p-2.5 bg-sky-500 text-white rounded-xl shadow-md hover:bg-sky-600 transition-all active:scale-95 cursor-pointer flex items-center justify-center h-10 w-10"
              title="Добавить категорию"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button 
              onClick={onClose} 
              className="p-2.5 bg-theme-main/50 border border-theme-base text-theme-main rounded-xl shadow-md hover:bg-theme-main transition-all relative z-20 cursor-pointer flex items-center justify-center active:scale-95 h-10 w-10"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2 lg:p-6 bg-theme-main no-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-theme-primary" />
              <p className="text-neutral-400 font-medium">Загрузка категорий...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Expenses Column */}
              <div className="space-y-1">
                <div className="flex items-center justify-between px-2">
                  <h3 className="font-bold text-rose-500 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                    Расходы
                  </h3>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest bg-white px-2 py-1 rounded-lg">
                    {groupedExpenseCategories.length} категорий
                  </span>
                </div>
                <div className="space-y-1">
                  {groupedExpenseCategories.length === 0 ? (
                    <div className="text-center py-8 text-neutral-400 text-sm italic bg-white rounded-2xl">Нет категорий расходов</div>
                  ) : (
                    <table className="w-full bg-white rounded-2xl shadow-sm overflow-hidden">
                      <tbody>
                        {groupedExpenseCategories.map(parent => (
                          <React.Fragment key={parent.id}>
                            <tr 
                              onClick={() => {
                                setEditingCategory(parent);
                                setShowFormModal(true);
                              }}
                              className="cursor-pointer hover:bg-neutral-100 transition-colors border-b border-neutral-100 bg-neutral-100/50"
                            >
                              <td className="p-1.5 text-lg w-10">{parent.icon}</td>
                              <td className="p-1.5 font-semibold text-neutral-700 text-sm">{parent.name}</td>
                              <td className="p-1.5 text-right text-neutral-400 text-xs font-medium pr-3">
                                {parent.sortOrder ?? ''}
                              </td>
                            </tr>
                            {parent.children.map(child => (
                              <tr 
                                key={child.id}
                                onClick={() => {
                                  setEditingCategory(child);
                                  setShowFormModal(true);
                                }}
                                className="cursor-pointer hover:bg-neutral-50 transition-colors border-b border-neutral-100"
                              >
                                <td className="p-1.5 text-lg w-10 pl-6">{child.icon || parent.icon}</td>
                                <td className="p-1.5 text-xs text-neutral-600">{child.name}</td>
                                <td className="p-1.5 text-right text-neutral-400 text-xs font-medium pr-3">
                                  {child.sortOrder ?? ''}
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Income Column */}
              <div className="space-y-1">
                <div className="flex items-center justify-between px-2">
                  <h3 className="font-bold text-emerald-500 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    Доходы
                  </h3>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest bg-white px-2 py-1 rounded-lg">
                    {groupedIncomeCategories.length} категорий
                  </span>
                </div>
                <div className="space-y-1">
                  {groupedIncomeCategories.length === 0 ? (
                    <div className="text-center py-8 text-neutral-400 text-sm italic bg-white rounded-2xl">Нет категорий доходов</div>
                  ) : (
                    <table className="w-full bg-white rounded-2xl shadow-sm overflow-hidden">
                      <tbody>
                        {groupedIncomeCategories.map(parent => (
                          <React.Fragment key={parent.id}>
                            <tr 
                              onClick={() => {
                                setEditingCategory(parent);
                                setShowFormModal(true);
                              }}
                              className="cursor-pointer hover:bg-neutral-100 transition-colors border-b border-neutral-100 bg-neutral-100/50"
                            >
                              <td className="p-1.5 text-lg w-10">{parent.icon}</td>
                              <td className="p-1.5 font-semibold text-neutral-700 text-sm">{parent.name}</td>
                              <td className="p-1.5 text-right text-neutral-400 text-xs font-medium pr-3">
                                {parent.sortOrder ?? ''}
                              </td>
                            </tr>
                            {parent.children.map(child => (
                              <tr 
                                key={child.id}
                                onClick={() => {
                                  setEditingCategory(child);
                                  setShowFormModal(true);
                                }}
                                className="cursor-pointer hover:bg-neutral-50 transition-colors border-b border-neutral-100"
                              >
                                <td className="p-1.5 text-lg w-10 pl-6">{child.icon || parent.icon}</td>
                                <td className="p-1.5 text-xs text-neutral-600">{child.name}</td>
                                <td className="p-1.5 text-right text-neutral-400 text-xs font-medium pr-3">
                                  {child.sortOrder ?? ''}
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Category Form Modal (Add/Edit) */}
      {showFormModal && (
        <CategoryForm 
          category={editingCategory}
          categories={categories}
          onClose={() => setShowFormModal(false)}
          onSuccess={() => {
            setShowFormModal(false);
            fetchCategories();
            onRefresh?.();
          }}
          onDelete={(id) => setDeleteConfirmId(id)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-3xl shadow-xl max-w-sm w-full text-center animate-in zoom-in duration-200">
            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-bold mb-2">Удалить категорию?</h3>
            <p className="text-neutral-500 mb-6 text-sm">Это действие нельзя будет отменить. Все транзакции в этой категории останутся, но без привязки к категории.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteConfirmId(null)} 
                className="flex-1 py-3 rounded-2xl bg-neutral-100 font-bold hover:bg-neutral-200 transition-colors"
              >
                Отмена
              </button>
              <button 
                onClick={() => handleDeleteCategory(deleteConfirmId)} 
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
}

interface CategoryFormProps {
  category: Category | null;
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
  onDelete: (id: string) => void;
}

function CategoryForm({ category, categories, onClose, onSuccess, onDelete }: CategoryFormProps) {
  const [name, setName] = useState(category?.name || '');
  const [parentId, setParentId] = useState<string | undefined>(category?.parentId);
  const [icon, setIcon] = useState(category?.icon || (category?.parentId ? '' : '💰'));
  const [color, setColor] = useState(category?.color || '#000000');
  const [type, setType] = useState<TransactionType>(category?.type || 'expense');
  const [sortOrder, setSortOrder] = useState<number | undefined>(category?.sortOrder);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Введите название категории');
      return;
    }
    
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        icon: icon || (parentId ? categories.find(c => c.id === parentId)?.icon : '💰') || '💰',
        type,
        parentId: parentId || null,
        color,
        sortOrder
      };
      if (category) {
        await api.put(`/categories/${category.id}`, payload);
      } else {
        await api.post('/categories', payload);
      }
      onSuccess();
    } catch (err: any) {
      console.error('Error saving category:', err);
      setError(err.message || 'Ошибка при сохранении категории');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 lg:p-8 bg-black/80 backdrop-blur-xl">
      <div className="relative w-full h-full lg:max-h-full lg:max-w-4xl bg-theme-main lg:rounded-xl lg:border border-neutral-100 shadow-2xl flex flex-col animate-in fade-in zoom-in duration-300 shadow-black/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-theme-surface/10 backdrop-blur-sm shrink-0">
          <h3 className="text-sm font-black uppercase tracking-widest text-theme-main drop-shadow-sm">{category ? 'Изменить' : 'Новая'}</h3>
          <button 
            onClick={onClose} 
            className="p-2.5 bg-theme-main/50 border border-theme-base text-theme-main rounded-xl shadow-md hover:bg-theme-main transition-all cursor-pointer flex items-center justify-center active:scale-95 h-10 w-10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 lg:p-10 space-y-8 flex-1 overflow-y-auto no-scrollbar">
            {error && (
              <div className="bg-rose-50 text-rose-500 p-4 rounded-xl text-xs font-bold flex items-center gap-3 animate-in fade-in duration-200">
                <AlertTriangle size={16} />
                {error}
              </div>
            )}
            <div className="flex flex-row items-center justify-center gap-8">
              <div className="flex flex-col items-center gap-1.5">
                <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">Иконка</label>
                <button
                  type="button"
                  onClick={() => setShowIconPicker(true)}
                  className="w-16 h-16 bg-theme-surface border border-neutral-100 rounded-lg flex items-center justify-center text-4xl hover:bg-theme-surface/50 transition-all hover:border-theme-primary group relative shadow-sm"
                >
                  {icon || (parentId ? categories.find(c => c.id === parentId)?.icon : '💰')}
                  <div className="absolute inset-0 bg-theme-primary/10 opacity-0 group-hover:opacity-100 rounded-lg transition-opacity flex items-center justify-center">
                    <Plus className="text-theme-primary w-8 h-8" strokeWidth={3} />
                  </div>
                </button>
              </div>

              <div className="space-y-1.5 flex flex-col items-center">
                <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest">Тип категории</label>
                <div className={cn(
                  "grid grid-cols-2 gap-1 bg-theme-surface border border-neutral-100 p-1 rounded-lg h-16 w-48",
                  parentId && "opacity-50 cursor-not-allowed"
                )}>
                  <button
                    type="button"
                    onClick={() => !parentId && setType('expense')}
                    disabled={!!parentId}
                    className={`rounded font-black text-[10px] uppercase tracking-widest transition-all ${
                      type === 'expense' 
                        ? 'bg-rose-500 text-white shadow-sm' 
                        : 'text-theme-muted hover:text-rose-500'
                    }`}
                  >
                    Расход
                  </button>
                  <button
                    type="button"
                    onClick={() => !parentId && setType('income')}
                    disabled={!!parentId}
                    className={`rounded font-black text-[10px] uppercase tracking-widest transition-all ${
                      type === 'income' 
                        ? 'bg-emerald-500 text-white shadow-sm' 
                        : 'text-theme-muted hover:text-emerald-500'
                    }`}
                  >
                    Доход
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest ml-1">Название</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Например: Продукты"
                  className="w-full bg-theme-main border border-theme-base rounded-lg px-4 py-3 text-sm font-bold outline-none focus:ring-1 ring-theme-primary/30 transition-all text-theme-main"
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest ml-1">Порядок</label>
                  <input
                    type="number"
                    value={sortOrder ?? ''}
                    onChange={(e) => setSortOrder(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="0"
                    className="w-full bg-theme-main border border-theme-base rounded-lg px-4 py-3 text-sm font-bold outline-none focus:ring-1 ring-theme-primary/30 transition-all text-theme-main"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest ml-1">Цвет</label>
                  <div className="flex items-center gap-3 bg-theme-surface border border-neutral-100 rounded-lg px-4 py-[11px]">
                    <div 
                      className="w-5 h-5 rounded-full border border-neutral-200 shadow-sm"
                      style={{ backgroundColor: color === '#000000' ? '#e5e5e5' : color }}
                    />
                    <input
                      type="color"
                      value={color === '#000000' ? '#e5e5e5' : color}
                      onChange={(e) => setColor(e.target.value)}
                      className="flex-1 h-6 cursor-pointer border-none bg-transparent"
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest ml-1">Принадлежит группе</label>
                <div className="relative">
                  <select
                    value={parentId || ''}
                    onChange={(e) => {
                      const newParentId = e.target.value || undefined;
                      setParentId(newParentId);
                      if (newParentId) {
                        const parent = categories.find(c => c.id === newParentId);
                        if (parent) {
                          setType(parent.type as TransactionType);
                          if (icon === '💰' || !icon) {
                            setIcon(parent.icon);
                          }
                          if (color === '#000000' || color === '#e5e5e5') {
                            setColor(parent.color);
                          }
                        }
                      }
                    }}
                    className="w-full bg-theme-main border border-theme-base rounded-lg px-4 py-3 text-sm font-bold outline-none focus:ring-1 ring-theme-primary/30 transition-all text-theme-main appearance-none"
                  >
                    <option value="">Нет (верхний уровень)</option>
                    {categories
                      .filter(c => c.id !== category?.id && !c.parentId && c.type === type)
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-theme-muted pointer-events-none" />
                </div>
                {parentId && (
                  <p className="text-[9px] text-theme-primary font-bold italic ml-1 mt-1 uppercase tracking-tighter opacity-70">Тип наследуется от родительской категории</p>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-neutral-100 flex gap-3 bg-theme-surface/5">
            {category && (
              <button
                type="button"
                onClick={() => onDelete(category.id)}
                className="p-3 text-theme-muted hover:text-rose-500 transition-colors border border-neutral-50 rounded-lg hover:bg-theme-main"
              >
                <Trash2 size={20} />
              </button>
            )}
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 bg-theme-primary text-theme-on-primary py-3 rounded-lg font-black uppercase tracking-widest text-[11px] hover:bg-theme-primary-dark transition-all shadow-lg shadow-theme-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-theme-on-primary/30 border-t-theme-on-primary rounded-full animate-spin" />
              ) : (
                <>
                  <Check size={18} strokeWidth={3} />
                  {category ? 'Сохранить' : 'Создать'}
                </>
              )}
            </button>
          </div>
        </form>

        {showIconPicker && (
          <div className="absolute inset-0 bg-theme-main z-20 flex flex-col animate-in fade-in duration-300">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-theme-surface/10 backdrop-blur-sm">
              <h3 className="text-sm font-black uppercase tracking-widest text-theme-main">Выберите иконку</h3>
              <button onClick={() => setShowIconPicker(false)} className="p-2 hover:bg-neutral-100/50 rounded-full transition-colors">
                <X className="w-5 h-5 text-theme-muted" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 lg:p-10 no-scrollbar">
              <div className="mb-10 space-y-2 max-w-md mx-auto">
                <label className="text-[10px] font-black text-theme-muted uppercase tracking-widest ml-1">Своя иконка (эмодзи)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value.slice(0, 2))}
                    placeholder="Введите эмодзи..."
                    className="flex-1 bg-theme-main border border-theme-base rounded-lg px-4 py-3 text-sm font-bold outline-none focus:ring-1 ring-theme-primary/30 text-theme-main"
                  />
                  <button
                    onClick={() => setShowIconPicker(false)}
                    className="px-6 bg-theme-primary text-theme-on-primary rounded-lg font-black uppercase tracking-widest text-[10px]"
                  >
                    ОК
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-10 gap-3">
                {COMMON_ICONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setIcon(emoji);
                      setShowIconPicker(false);
                    }}
                    className={cn(
                      "aspect-square flex items-center justify-center text-3xl rounded-xl transition-all hover:scale-110 border border-transparent shadow-sm",
                      icon === emoji 
                        ? 'bg-theme-primary text-theme-on-primary ring-2 ring-theme-primary ring-offset-2' 
                        : 'bg-theme-surface hover:bg-theme-surface/50 border-neutral-100'
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

