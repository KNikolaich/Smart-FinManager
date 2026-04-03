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
  const buttonClass = cn(
    "w-full py-3 rounded-2xl font-bold transition-all",
    isGreyTheme ? "bg-neutral-500 text-white hover:bg-neutral-600" : "bg-emerald-500 text-white hover:bg-emerald-600"
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">Категории кэшбека</h3>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full"><X size={20} /></button>
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
        <button onClick={() => onSave(localCategories)} className={buttonClass}>Сохранить</button>
      </div>
    </div>
  );
}
