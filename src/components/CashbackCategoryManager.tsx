import React, { useState } from 'react';
import { CashbackCategory } from '../types';
import { Plus, Trash2, X, Wand2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface CashbackCategoryManagerProps {
  categories: CashbackCategory[];
  onSave: (categories: CashbackCategory[]) => void;
  onClose: () => void;
}

const DEFAULT_CASHBACK_CATEGORIES = [
  "все покупки", "Оплата NFC или по", "Автоуслуги", "АЗС", "Мед услуги", "Аптеки", 
  "Дом, ремонт.", "Животные", "Маркетплейсы", "Кафе, бары, рестораны", "Фастфуд", 
  "Я маркет до", "Супермаркеты", "Такси", "Транспорт обществ", "ЖД транспорт", 
  "Цветы", "Одежда и обувь", "Спорттовары", "Активный отдых", "Развлечения", 
  "Фитнес", "Комунальные услуг", "Все для НГ", "Строительные инст", "Мебель", 
  "Наушники и колонк", "Театры, кино", "книги и концтовары", "Образование", 
  "Электроника", "цифровые товары", "Музыка", "Ювелирка", "Красота"
].map(name => ({ id: Date.now().toString() + Math.random(), name, color: '#94a3b8' }));

export default function CashbackCategoryManager({ categories, onSave, onClose }: CashbackCategoryManagerProps) {
  const [localCategories, setLocalCategories] = useState(categories);

  const handleAdd = () => {
    setLocalCategories([...localCategories, { id: Date.now().toString(), name: 'Новая категория', color: '#94a3b8' }]);
  };

  const handleGenerate = () => {
    setLocalCategories(DEFAULT_CASHBACK_CATEGORIES);
  };

  const handleUpdate = (id: string, name: string, color: string) => {
    setLocalCategories(localCategories.map(c => c.id === id ? { ...c, name, color } : c));
  };

  const handleDelete = (id: string) => {
    setLocalCategories(localCategories.filter(c => c.id !== id));
  };

  const isGreyTheme = document.body.classList.contains('theme-grey');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[120] flex items-center justify-center">
      <div className="bg-white w-full h-full sm:h-auto sm:max-w-lg sm:rounded-[32px] overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300 relative">
        <div className="p-6 flex items-center justify-between shrink-0 border-b border-theme-base">
          <h3 className="text-xl font-black uppercase text-theme-main drop-shadow-sm">Категории кэшбека</h3>
          <button 
            onClick={onClose} 
            className="p-2.5 bg-theme-main/50 border border-theme-base text-theme-main rounded-xl shadow-md hover:bg-theme-main transition-all cursor-pointer flex items-center justify-center active:scale-95 h-10 w-10"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {localCategories.map(c => (
            <div key={c.id} className="flex items-center gap-2">
              <input type="color" value={c.color} onChange={(e) => handleUpdate(c.id, c.name, e.target.value)} className="w-8 h-8 rounded-lg" />
              <input type="text" value={c.name} onChange={(e) => handleUpdate(c.id, e.target.value, c.color)} className="flex-1 p-2 border border-neutral-200 rounded-xl" />
              <button onClick={() => handleDelete(c.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl"><Trash2 size={18} /></button>
            </div>
          ))}
          <div className="flex gap-2">
            <button onClick={handleAdd} className="flex-1 flex items-center justify-center gap-2 p-2 text-neutral-600 font-bold bg-neutral-100 hover:bg-neutral-200 rounded-xl">
              <Plus size={18} /> Добавить
            </button>
            <button onClick={handleGenerate} className="flex-1 flex items-center justify-center gap-2 p-2 text-neutral-600 font-bold bg-neutral-100 hover:bg-neutral-200 rounded-xl">
              <Wand2 size={18} /> Сгенерировать
            </button>
          </div>
        </div>
        <button 
          onClick={() => onSave(localCategories)} 
          className="w-full py-4 rounded-xl font-black uppercase text-white bg-theme-primary shadow-md hover:shadow-lg transition-all active:scale-95"
        >
          Сохранить
        </button>
      </div>
    </div>
  );
}
