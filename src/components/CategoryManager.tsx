import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { Category, TransactionType } from '../types';
import { X, Plus, Trash2, Tag, Check, AlertTriangle } from 'lucide-react';

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

interface CategoryManagerProps {
  user: { id: string; email: string };
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

export default function CategoryManager({ user, onClose, onRefresh }: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, [user.id]);

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
    return roots.map(root => ({
      ...root,
      children: categories.filter(c => c.type === 'expense' && c.parentId === root.id)
    }));
  }, [categories]);

  const groupedIncomeCategories = useMemo(() => {
    const roots = categories.filter(c => c.type === 'income' && !c.parentId);
    return roots.map(root => ({
      ...root,
      children: categories.filter(c => c.type === 'income' && c.parentId === root.id)
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
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-4xl bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="p-2 sm:p-2 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-theme-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-theme-primary-light flex-shrink-0">
              <Tag size={20} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold">Категории</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                setEditingCategory(null);
                setShowFormModal(true);
              }}
              className="flex items-center gap-2 bg-theme-primary text-white p-2 sm:px-4 sm:py-2 rounded-xl hover:bg-theme-primary-dark transition-all font-bold text-sm shadow-lg shadow-theme-primary-light"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Добавить</span>
            </button>
            <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
              <X className="w-6 h-6 text-neutral-400" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-1 bg-neutral-50/50 no-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-theme-primary" />
              <p className="text-neutral-400 font-medium">Загрузка категорий...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Expenses Column */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="font-bold text-rose-500 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                    Расходы
                  </h3>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest bg-white px-2 py-1 rounded-lg">
                    {groupedExpenseCategories.length} категорий
                  </span>
                </div>
                <div className="space-y-4">
                  {groupedExpenseCategories.length === 0 ? (
                    <div className="text-center py-8 text-neutral-400 text-sm italic bg-white rounded-2xl">Нет категорий расходов</div>
                  ) : (
                    groupedExpenseCategories.map(parent => (
                      <div key={parent.id} className="space-y-2">
                        {/* Parent Category */}
                        <div 
                          onClick={() => {
                            setEditingCategory(parent);
                            setShowFormModal(true);
                          }}
                          className="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-sm hover:bg-neutral-50 transition-colors cursor-pointer"
                        >
                          <span className="text-xl">{parent.icon}</span>
                          <span className="font-semibold text-neutral-700">{parent.name}</span>
                        </div>
                        
                        {/* Child Categories Grid */}
                        {parent.children.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 pl-4">
                            {parent.children.map(child => (
                              <div 
                                key={child.id}
                                onClick={() => {
                                  setEditingCategory(child);
                                  setShowFormModal(true);
                                }}
                                className="p-2 bg-white rounded-xl shadow-sm hover:bg-neutral-50 transition-colors cursor-pointer text-xs text-neutral-600 truncate flex items-center gap-2"
                              >
                                <span>{child.icon || parent.icon}</span>
                                {child.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Income Column */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="font-bold text-emerald-500 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    Доходы
                  </h3>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest bg-white px-2 py-1 rounded-lg">
                    {groupedIncomeCategories.length} категорий
                  </span>
                </div>
                <div className="space-y-4">
                  {groupedIncomeCategories.length === 0 ? (
                    <div className="text-center py-8 text-neutral-400 text-sm italic bg-white rounded-2xl">Нет категорий доходов</div>
                  ) : (
                    groupedIncomeCategories.map(parent => (
                      <div key={parent.id} className="space-y-2">
                        {/* Parent Category */}
                        <div 
                          onClick={() => {
                            setEditingCategory(parent);
                            setShowFormModal(true);
                          }}
                          className="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-sm hover:bg-neutral-50 transition-colors cursor-pointer"
                        >
                          <span className="text-xl">{parent.icon}</span>
                          <span className="font-semibold text-neutral-700">{parent.name}</span>
                        </div>
                        
                        {/* Child Categories Grid */}
                        {parent.children.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 pl-4">
                            {parent.children.map(child => (
                              <div 
                                key={child.id}
                                onClick={() => {
                                  setEditingCategory(child);
                                  setShowFormModal(true);
                                }}
                                className="p-2 bg-white rounded-xl shadow-sm hover:bg-neutral-50 transition-colors cursor-pointer text-xs text-neutral-600 truncate flex items-center gap-2"
                              >
                                <span>{child.icon || parent.icon}</span>
                                {child.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
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
          userId={user.id}
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
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-6 sm:p-4 bg-black/50 backdrop-blur-sm">
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
  userId: string;
  category: Category | null;
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
  onDelete: (id: string) => void;
}

function CategoryForm({ userId, category, categories, onClose, onSuccess, onDelete }: CategoryFormProps) {
  const [name, setName] = useState(category?.name || '');
  const [parentId, setParentId] = useState<string | undefined>(category?.parentId);
  const [icon, setIcon] = useState(category?.icon || (category?.parentId ? '' : '💰'));
  const [color, setColor] = useState(category?.color || '#000000');
  const [type, setType] = useState<TransactionType>(category?.type || 'expense');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setSaving(true);
    try {
      if (category) {
        await api.put(`/categories/${category.id}`, {
          name,
          icon,
          type,
          parentId,
          color
        });
      } else {
        await api.post('/categories', {
          name,
          icon,
          type,
          parentId,
          color
        });
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving category:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-6 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-300">
        <div className="p-6 flex items-center justify-between">
          <h3 className="text-xl font-bold">{category ? 'Редактировать' : 'Новая категория'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
            <X className="w-6 h-6 text-neutral-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1 overflow-y-auto no-scrollbar">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowIconPicker(true)}
                className="w-20 h-20 bg-neutral-50 rounded-3xl flex items-center justify-center text-4xl hover:bg-neutral-100 transition-all hover:border-theme-primary group relative"
                style={{ border: color && color !== '#000000' ? `3px solid ${color}` : 'none' }}
              >
                {icon || (parentId ? categories.find(c => c.id === parentId)?.icon : '💰')}
                <div className="absolute inset-0 bg-theme-primary/10 opacity-0 group-hover:opacity-100 rounded-3xl transition-opacity flex items-center justify-center">
                  <Plus className="text-theme-primary-dark w-6 h-6" />
                </div>
              </button>
              {color && color !== '#000000' && (
                <div 
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: color }}
                />
              )}
            </div>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
              {category ? `${category.id} (${type})` : `Новая категория (${type})`}
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-4">Название</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Продукты"
                className="w-full bg-neutral-50 rounded-2xl px-5 py-4 outline-none focus:ring-2 ring-theme-primary/20 font-semibold transition-all"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-4">Цвет</label>
                <div className="flex items-center gap-3 bg-neutral-50 rounded-2xl px-4 py-3.5">
                  <input
                    type="color"
                    value={color === '#000000' ? '#e5e5e5' : color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border-none bg-transparent"
                  />
                  <button 
                    type="button"
                    onClick={() => setColor('#000000')}
                    className={cn(
                      "text-[10px] font-bold px-2 py-1 rounded-lg transition-all",
                      color === '#000000' ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-500 hover:bg-neutral-300"
                    )}
                  >
                    Сброс
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-4">Тип</label>
                <div className={cn(
                  "grid grid-cols-2 gap-1 bg-neutral-50 p-1 rounded-2xl",
                  parentId && "opacity-50 cursor-not-allowed"
                )}>
                  <button
                    type="button"
                    onClick={() => !parentId && setType('expense')}
                    disabled={!!parentId}
                    className={`py-2 rounded-xl font-bold text-[10px] uppercase transition-all ${
                      type === 'expense' 
                        ? 'bg-white text-rose-500 shadow-sm' 
                        : 'text-neutral-400'
                    }`}
                  >
                    Расход
                  </button>
                  <button
                    type="button"
                    onClick={() => !parentId && setType('income')}
                    disabled={!!parentId}
                    className={`py-2 rounded-xl font-bold text-[10px] uppercase transition-all ${
                      type === 'income' 
                        ? 'bg-white text-theme-primary shadow-sm' 
                        : 'text-neutral-400'
                    }`}
                  >
                    Доход
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-4">Родительская категория</label>
              <select
                value={parentId || ''}
                onChange={(e) => {
                  const newParentId = e.target.value || undefined;
                  setParentId(newParentId);
                  if (newParentId) {
                    const parent = categories.find(c => c.id === newParentId);
                    if (parent) setType(parent.type as TransactionType);
                  }
                }}
                className="w-full bg-neutral-50 rounded-2xl px-5 py-4 outline-none focus:ring-2 ring-theme-primary/20 font-semibold transition-all"
              >
                <option value="">Нет (верхний уровень)</option>
                {categories
                  .filter(c => c.id !== category?.id && !c.parentId && c.type === type)
                  .map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </select>
              {parentId && (
                <p className="text-[9px] text-neutral-400 italic ml-4 mt-1">Тип наследуется от родительской категории</p>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            {category && (
              <button
                type="button"
                onClick={() => onDelete(category.id)}
                className="p-4 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-100 transition-colors"
              >
                <Trash2 size={24} />
              </button>
            )}
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 bg-theme-primary text-white py-4 rounded-2xl font-bold hover:bg-theme-primary-dark transition-all shadow-lg shadow-theme-primary-light disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check size={20} />
                  {category ? 'Сохранить изменения' : 'Создать категорию'}
                </>
              )}
            </button>
          </div>
        </form>

        {showIconPicker && (
          <div className="absolute inset-0 bg-white z-20 flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="p-6 flex items-center justify-between">
              <h3 className="font-bold">Выберите иконку</h3>
              <button onClick={() => setShowIconPicker(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-neutral-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
              <div className="mb-6 space-y-2">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Своя иконка (эмодзи)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value.slice(0, 2))}
                    placeholder="Введите эмодзи..."
                    className="flex-1 bg-neutral-50 rounded-2xl px-5 py-4 outline-none focus:ring-2 ring-emerald-500/20 font-semibold transition-all"
                  />
                  <button
                    onClick={() => setShowIconPicker(false)}
                    className="bg-theme-primary text-white px-6 rounded-2xl font-bold hover:bg-theme-primary-dark transition-all shadow-lg shadow-theme-primary-light"
                  >
                    Готово
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-6 gap-4">
                {COMMON_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    setIcon(emoji);
                    setShowIconPicker(false);
                  }}
                  className={`aspect-square flex items-center justify-center text-3xl rounded-2xl transition-all hover:scale-110 ${
                    icon === emoji ? 'bg-theme-primary-light ring-2 ring-theme-primary' : 'bg-neutral-50 hover:bg-neutral-100'
                  }`}
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

