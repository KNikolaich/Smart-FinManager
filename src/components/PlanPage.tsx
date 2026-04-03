import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { 
  PlanData, 
  PlanRow, 
  PlanSubject, 
  PlanCell, 
  Account, 
  Category,
  PlanConfig,
  CashbackCategory
} from '../types';
import { 
  History, 
  Settings as SettingsIcon, 
  MessageSquare, 
  Calendar, 
  Save, 
  X, 
  Bold, 
  Type, 
  Italic,
  Strikethrough,
  Heading1,
  Palette,
  Plus,
  Trash2,
  Edit3,
  Pencil,
  Check
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';
import CashbackTab from './CashbackTab';

interface PlanPageProps {
  accounts: Account[];
  categories: Category[];
  onRefresh?: () => void;
}

type TabType = 'now' | 'past' | 'config' | 'comment' | 'cashback';

const MONTHS = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'
];

const SHORT_MONTHS = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн', 
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'
];

const INITIAL_CONFIG: PlanConfig = {
  targetAmount: 350,
  totalColumnColor: '#fff2cc',
  headerColor: '#f3f3f3',
  firstColumnColor: '#d9ead3',
  minRowColor: '#fff2cc'
};

const DEFAULT_CASHBACK_CATEGORIES: CashbackCategory[] = [
  { id: '1', name: 'Все покупки', color: '#ff0000' },
  { id: '2', name: 'Оплата NFC или по', color: '#cccccc' },
  { id: '3', name: 'Автоуслуги', color: '#add8e6' },
  { id: '4', name: 'АЗС', color: '#add8e6' },
  { id: '5', name: 'Мед услуги', color: '#008000' },
  { id: '6', name: 'Аптеки', color: '#008000' },
  { id: '7', name: 'Дом, ремонт', color: '#8b4513' },
  { id: '8', name: 'Животные', color: '#ffcc99' },
  { id: '9', name: 'Маркетплейсы', color: '#ffcccc' },
  { id: '10', name: 'Кафе, бары, рестораны', color: '#ff0000' },
  { id: '11', name: 'Фастфуд', color: '#ff0000' },
  { id: '12', name: 'Я маркет до', color: '#ffcc99' },
  { id: '13', name: 'Супермаркеты', color: '#ffcc99' },
  { id: '14', name: 'Такси', color: '#ffff99' },
  { id: '15', name: 'Транспорт общественный', color: '#ffff99' },
  { id: '16', name: 'ЖД транспорт', color: '#ffff99' },
  { id: '17', name: 'Цветы', color: '#ccff99' },
  { id: '18', name: 'Одежда и обувь', color: '#d8bfd8' },
  { id: '19', name: 'Спорттовары', color: '#d8bfd8' },
  { id: '20', name: 'Активный отдых', color: '#cccccc' },
  { id: '21', name: 'Развлечения', color: '#cccccc' },
  { id: '22', name: 'Фитнес', color: '#cccccc' },
  { id: '23', name: 'Комунальные услуги', color: '#ffcccc' },
  { id: '24', name: 'Все для НГ', color: '#ff0000' },
  { id: '25', name: 'Строительные инст', color: '#ff0000' },
  { id: '26', name: 'Мебель', color: '#ff0000' },
  { id: '27', name: 'Наушники и колонки', color: '#ff0000' },
  { id: '28', name: 'Театры, кино', color: '#0000ff' },
  { id: '29', name: 'Книги и концтовары', color: '#ccff99' },
  { id: '30', name: 'Образование', color: '#add8e6' },
  { id: '31', name: 'Электроника', color: '#8b4513' },
  { id: '32', name: 'Цифровые товары', color: '#8b4513' },
  { id: '33', name: 'Музыка', color: '#0000ff' },
  { id: '34', name: 'Ювелирка', color: '#4b0082' },
  { id: '35', name: 'Красота', color: '#4b0082' },
];

export default function PlanPage({ accounts, categories, onRefresh }: PlanPageProps) {
  const [activeTab, setActiveTab] = useState<TabType>('now');
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string, subjectId: string } | null>(null);
  const [cellEditValue, setCellEditValue] = useState<PlanCell | null>(null);
  const [editingSubject, setEditingSubject] = useState<PlanSubject | null>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<string | null>(null);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [isEditingComment, setIsEditingComment] = useState(false);

  // Cashback Data
  const handleSaveCashback = (newData: PlanData) => {
    savePlanData(newData);
  };

  // Load data from API
  useEffect(() => {
    const loadData = async (retries = 3) => {
      console.log('Loading plan grid...');
      try {
        const data = await api.get<PlanData | null>('/plan-grid');
        console.log('Plan grid data loaded:', !!data);
        if (data) {
          setPlanData(data);
        } else {
          // Check localStorage for migration
          const saved = localStorage.getItem('planData');
          if (saved) {
            const parsed = JSON.parse(saved);
            setPlanData(parsed);
            // Save to server immediately
            await api.post('/plan-grid', parsed);
          } else {
            // Initialize with empty plan data
            const initialData: PlanData = {
              id: 'default',
              userId: 'user',
              subjects: [],
              rows: [],
              config: INITIAL_CONFIG,
              cashback: { categories: DEFAULT_CASHBACK_CATEGORIES, entries: [] },
              comment: '',
              updatedAt: new Date().toISOString()
            };
            setPlanData(initialData);
            await api.post('/plan-grid', initialData);
          }
        }
      } catch (error) {
        console.error('Error loading plan grid:', error);
        if (retries > 0) {
          console.log(`Retrying... (${retries} retries left)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          await loadData(retries - 1);
        } else {
          // Alert user if it's a network error
          if (error instanceof TypeError && error.message === 'Failed to fetch') {
            console.error('Network error - check if server is running');
          }
        }
      }
    };
    loadData();
  }, []);

  const savePlanData = async (newData: PlanData) => {
    setPlanData(newData);
    try {
      await api.post('/plan-grid', newData);
    } catch (error) {
      console.error('Error saving plan grid:', error);
    }
  };

  const parseValue = (val: string): number => {
    if (!val) return 0;
    const normalized = val.replace(',', '.').replace(/[^\d.]/g, '');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  };

  const calculateRowTotal = (row: PlanRow) => {
    return Object.values(row.cells).reduce((sum, cell) => sum + parseValue(cell.value), 0);
  };

  const getQuarterlyVisibility = (rowId: string) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Parse row info
    const parts = rowId.split('-');
    const rowYear = parseInt(parts[0]);
    const rowMonth = parts.length > 1 ? parseInt(parts[parts.length - 1]) : null;

    if (isNaN(rowYear)) return true; // Fallback

    // Logic for "Past" vs "Current"
    // In March (2): Before Dec (inclusive) -> Past
    // In July (6): Before Apr (inclusive) -> Past
    // In November (10): Before Aug (inclusive) -> Past

    let pastThresholdYear = currentYear;
    let pastThresholdMonth = -1;

    if (currentMonth >= 2 && currentMonth < 6) { // March to June
      pastThresholdYear = currentYear - 1;
      pastThresholdMonth = 11; // Dec of prev year
    } else if (currentMonth >= 6 && currentMonth < 10) { // July to Oct
      pastThresholdYear = currentYear;
      pastThresholdMonth = 3; // April
    } else if (currentMonth >= 10) { // Nov to Dec
      pastThresholdYear = currentYear;
      pastThresholdMonth = 7; // August
    } else { // Jan to Feb
      pastThresholdYear = currentYear - 1;
      pastThresholdMonth = 7; // August of prev year (assuming previous threshold)
    }

    const isPast = rowYear < pastThresholdYear || (rowYear === pastThresholdYear && rowMonth !== null && rowMonth <= pastThresholdMonth);
    
    return isPast;
  };

  const filteredRows = useMemo(() => {
    if (!planData) return [];
    return planData.rows.filter(row => {
      const isPast = getQuarterlyVisibility(row.id);
      return activeTab === 'past' ? isPast : !isPast;
    });
  }, [planData, activeTab]);

  const visibleSubjects = useMemo(() => {
    if (!planData) return [];
    if (activeTab === 'now') return planData.subjects.filter(s => !s.isArchived);
    if (activeTab === 'past') return planData.subjects;
    return planData.subjects;
  }, [planData, activeTab]);

  const handleCellClick = (rowId: string, subjectId: string) => {
    if (activeTab === 'past') return;
    const row = planData?.rows.find(r => r.id === rowId);
    const cell = row?.cells[subjectId] || { value: '' };
    setEditingCell({ rowId, subjectId });
    setCellEditValue({ ...cell });
  };

  const handleSaveCell = () => {
    if (!planData || !editingCell || !cellEditValue) return;
    
    const newRows = planData.rows.map(row => {
      if (row.id === editingCell.rowId) {
        return {
          ...row,
          cells: {
            ...row.cells,
            [editingCell.subjectId]: cellEditValue
          }
        };
      }
      return row;
    });

    savePlanData({
      ...planData,
      rows: newRows,
      updatedAt: new Date().toISOString()
    });
    setEditingCell(null);
  };

  const handleAddSubject = () => {
    if (!planData || !newSubjectName) return;
    const newSubject: PlanSubject = {
      id: Date.now().toString(),
      name: newSubjectName,
      color: '#f3f3f3',
      textColor: '#000000',
      isArchived: false
    };
    savePlanData({
      ...planData,
      subjects: [...planData.subjects, newSubject]
    });
    setNewSubjectName('');
    setShowAddSubject(false);
  };

  const handleSaveSubject = () => {
    if (!planData || !editingSubject) return;
    savePlanData({
      ...planData,
      subjects: planData.subjects.map(s => s.id === editingSubject.id ? editingSubject : s)
    });
    setEditingSubject(null);
  };

  const handleDeleteSubject = (id: string) => {
    if (!planData) return;
    savePlanData({
      ...planData,
      subjects: planData.subjects.filter(s => s.id !== id)
    });
    setSubjectToDelete(null);
  };

  if (!planData) return null;

  return (
    <div className="p-0 sm:p-0 space-y-0 max-w-[100vw] overflow-hidden h-full flex flex-col">
      {/* Custom Minimalist Tabs */}
      <div className="flex items-end space-x-1 border-b border-neutral-200 px-1 pt-1.5 shrink-0">
        <button
          onClick={() => setActiveTab('now')}
          className={cn(
            "px-2 py-1 rounded-t-xl text-xs font-bold transition-all border-t border-l border-r",
            activeTab === 'now' 
              ? "bg-emerald-500 text-white border-emerald-500 translate-y-[1px]" 
              : "bg-neutral-50 text-neutral-400 border-neutral-200 hover:bg-neutral-100"
          )}
        >
          Сейчас
        </button>
        
        <button
          onClick={() => setActiveTab('cashback')}
          className={cn(
            "px-2 py-1 rounded-t-xl text-xs font-bold transition-all border-t border-l border-r",
            activeTab === 'cashback' 
              ? "bg-purple-500 text-white border-purple-500 translate-y-[1px]" 
              : "bg-neutral-50 text-neutral-400 border-neutral-200 hover:bg-neutral-100"
          )}
        >
          Кэшбек
        </button>
        <button
          onClick={() => setActiveTab('comment')}
          className={cn(
            "px-2 py-1 rounded-t-xl text-xs font-bold transition-all border-t border-l border-r",
            activeTab === 'comment' 
              ? "bg-purple-500 text-white border-purple-500 translate-y-[1px]" 
              : "bg-neutral-50 text-neutral-400 border-neutral-200 hover:bg-neutral-100"
          )}
        >
          Комментарий
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={cn(
            "px-2 py-1 rounded-t-xl text-xs font-bold transition-all border-t border-l border-r",
            activeTab === 'config' 
              ? "bg-blue-500 text-white border-blue-500 translate-y-[1px]" 
              : "bg-neutral-50 text-neutral-400 border-neutral-200 hover:bg-neutral-100"
          )}
        >
          Конфиг
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={cn(
            "px-2 py-1 rounded-t-xl text-xs font-bold transition-all border-t border-l border-r",
            activeTab === 'past' 
              ? "bg-amber-500 text-white border-amber-500 translate-y-[1px]" 
              : "bg-neutral-50 text-neutral-400 border-neutral-200 hover:bg-neutral-100"
          )}
        >
          Прошлое
        </button>
      </div>

      <div className="bg-white p-0 border-none shadow-none overflow-hidden flex-1 flex flex-col">
        {activeTab === 'cashback' ? (
          <CashbackTab planData={planData} accounts={accounts} onSave={handleSaveCashback} />
        ) : activeTab === 'now' || activeTab === 'past' ? (
          <div className="w-full flex-1 overflow-y-auto overflow-x-auto no-scrollbar">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-20">
                <tr>
                  <th 
                    className="p-1 border border-neutral-200 text-[10px] font-bold text-neutral-400 uppercase text-center w-10 sticky left-0 top-0 z-30"
                    style={{ backgroundColor: planData.config.headerColor }}
                  >
                    <div className="rotate-180 [writing-mode:vertical-lr] mx-auto h-24">план в тыс ₽</div>
                  </th>
                  {visibleSubjects.map(subject => (
                    <th 
                      key={subject.id}
                      onClick={() => setEditingSubject({ ...subject })}
                      className="p-1 border border-neutral-200 text-[10px] font-bold vertical-text h-32 relative group cursor-pointer hover:brightness-95 transition-all sticky top-0 z-20 min-w-[44px]"
                      style={{ 
                        backgroundColor: subject.color || planData.config.headerColor,
                        color: subject.textColor || '#000000'
                      }}
                    >
                      <div className="rotate-180 [writing-mode:vertical-lr] mx-auto">
                        {subject.name}
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSubjectToDelete(subject.id);
                        }}
                        className="absolute top-1 right-1 p-1 bg-rose-50 text-rose-500 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={10} />
                      </button>
                    </th>
                  ))}
                  <th 
                    className="p-1 border border-neutral-200 text-[10px] font-bold text-neutral-900 sticky top-0 z-20 min-w-[64px]"
                    style={{ backgroundColor: planData.config.totalColumnColor }}
                  >
                    <div className="rotate-180 [writing-mode:vertical-lr] mx-auto">Итого</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(row => {
                  const total = calculateRowTotal(row);
                  const isOverTarget = total > planData.config.targetAmount;
                  
                  return (
                    <tr 
                      key={row.id}
                      style={{ 
                        backgroundColor: row.type === 'min' ? planData.config.minRowColor : 'transparent'
                      }}
                    >
                      <td 
                        className={cn(
                          "p-1 border border-neutral-200 text-sm font-bold text-neutral-700 text-center w-10 overflow-visible sticky left-0 z-10",
                          row.type === 'year' && "bg-neutral-100"
                        )}
                        style={{ backgroundColor: row.type === 'month' ? planData.config.firstColumnColor : (row.type === 'year' ? '#f5f5f5' : (row.type === 'min' ? planData.config.minRowColor : '#ffffff')) }}
                      >
                        <div className="rotate-[-45deg] whitespace-nowrap inline-block origin-center">
                          {row.label}
                        </div>
                      </td>
                      {visibleSubjects.map(subject => {
                        const cell = row.cells[subject.id];
                        return (
                          <td 
                            key={subject.id}
                            onClick={() => handleCellClick(row.id, subject.id)}
                            className={cn(
                              "p-1 border border-neutral-200 text-[10px] text-center cursor-pointer hover:bg-neutral-50 transition-colors relative group min-w-[44px]",
                              cell?.isBold && "font-bold"
                            )}
                            style={{ color: cell?.color }}
                          >
                            {cell?.value || '-'}
                            {cell?.comment && (
                              <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-blue-400 rounded-bl-full" title={cell.comment} />
                            )}
                          </td>
                        );
                      })}
                      <td 
                        className={cn(
                          "p-1 border border-neutral-200 text-[10px] font-bold text-center min-w-[64px]",
                          isOverTarget && row.type !== 'min' ? "text-rose-500" : "text-neutral-900"
                        )}
                        style={{ backgroundColor: planData.config.totalColumnColor }}
                      >
                        {total > 0 ? total.toLocaleString() : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {activeTab === 'now' && (
              <div className="mt-8 px-6 pb-6 flex items-center gap-4">
                {showAddSubject ? (
                  <div className="flex items-center gap-2">
                    <input 
                      type="text"
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                      placeholder="Название графы"
                      className="text-xs p-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      autoFocus
                    />
                    <button 
                      onClick={handleAddSubject}
                      className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors"
                    >
                      <Check size={14} />
                    </button>
                    <button 
                      onClick={() => setShowAddSubject(false)}
                      className="p-2 bg-neutral-100 text-neutral-500 rounded-xl hover:bg-neutral-200 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowAddSubject(true)}
                    className="flex items-center gap-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                  >
                    <Plus size={14} />
                    Добавить графу расходов
                  </button>
                )}
                
                <div className="text-[10px] text-neutral-400 italic">
                  * Нажмите на ячейку для редактирования. Нажмите на заголовок для настройки графы.
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'config' ? (
          <div className="space-y-6 max-w-md p-6">
            <h3 className="text-lg font-bold">Настройки таблицы</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase">Сумма к которой стремимся</label>
                <input 
                  type="number"
                  value={planData.config.targetAmount}
                  onChange={(e) => savePlanData({
                    ...planData,
                    config: { ...planData.config, targetAmount: parseInt(e.target.value) || 0 }
                  })}
                  className="w-full p-3 bg-neutral-50 border border-neutral-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Цвет итогов</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color"
                      value={planData.config.totalColumnColor}
                      onChange={(e) => savePlanData({
                        ...planData,
                        config: { ...planData.config, totalColumnColor: e.target.value }
                      })}
                      className="w-8 h-8 rounded-lg cursor-pointer border-none"
                    />
                    <span className="text-xs font-mono">{planData.config.totalColumnColor}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Цвет заголовка</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color"
                      value={planData.config.headerColor}
                      onChange={(e) => savePlanData({
                        ...planData,
                        config: { ...planData.config, headerColor: e.target.value }
                      })}
                      className="w-8 h-8 rounded-lg cursor-pointer border-none"
                    />
                    <span className="text-xs font-mono">{planData.config.headerColor}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Цвет 1-й колонки</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color"
                      value={planData.config.firstColumnColor}
                      onChange={(e) => savePlanData({
                        ...planData,
                        config: { ...planData.config, firstColumnColor: e.target.value }
                      })}
                      className="w-8 h-8 rounded-lg cursor-pointer border-none"
                    />
                    <span className="text-xs font-mono">{planData.config.firstColumnColor}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Цвет строки MIN</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color"
                      value={planData.config.minRowColor}
                      onChange={(e) => savePlanData({
                        ...planData,
                        config: { ...planData.config, minRowColor: e.target.value }
                      })}
                      className="w-8 h-8 rounded-lg cursor-pointer border-none"
                    />
                    <span className="text-xs font-mono">{planData.config.minRowColor}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between p-6 pb-2 shrink-0">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold">Заметки</h3>
                <button 
                  onClick={() => setIsEditingComment(!isEditingComment)}
                  className={cn(
                    "p-2 rounded-xl transition-all",
                    isEditingComment ? "bg-purple-500 text-white shadow-lg shadow-purple-100" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                  )}
                  title={isEditingComment ? "Просмотр" : "Редактировать"}
                >
                  <Pencil size={18} />
                </button>
              </div>
              
              {isEditingComment && (
                <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl">
                  <button 
                    onClick={() => {
                      const textarea = document.getElementById('comment-editor') as HTMLTextAreaElement;
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const text = textarea.value;
                      const before = text.substring(0, start);
                      const after = text.substring(end);
                      const selected = text.substring(start, end);
                      savePlanData({ ...planData, comment: before + `**${selected}**` + after });
                    }}
                    className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all"
                    title="Жирный"
                  >
                    <Bold size={16} />
                  </button>
                  <button 
                    onClick={() => {
                      const textarea = document.getElementById('comment-editor') as HTMLTextAreaElement;
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const text = textarea.value;
                      const before = text.substring(0, start);
                      const after = text.substring(end);
                      const selected = text.substring(start, end);
                      savePlanData({ ...planData, comment: before + `*${selected}*` + after });
                    }}
                    className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all"
                    title="Курсив"
                  >
                    <Italic size={16} />
                  </button>
                  <button 
                    onClick={() => {
                      const textarea = document.getElementById('comment-editor') as HTMLTextAreaElement;
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const text = textarea.value;
                      const before = text.substring(0, start);
                      const after = text.substring(end);
                      const selected = text.substring(start, end);
                      savePlanData({ ...planData, comment: before + `~~${selected}~~` + after });
                    }}
                    className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all"
                    title="Зачеркнутый"
                  >
                    <Strikethrough size={16} />
                  </button>
                  <button 
                    onClick={() => {
                      const textarea = document.getElementById('comment-editor') as HTMLTextAreaElement;
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const text = textarea.value;
                      const before = text.substring(0, start);
                      const after = text.substring(end);
                      const selected = text.substring(start, end);
                      savePlanData({ ...planData, comment: before + `\n# ${selected}` + after });
                    }}
                    className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all"
                    title="Заголовок"
                  >
                    <Heading1 size={16} />
                  </button>
                </div>
              )}
            </div>
            
            <div className="flex-1 p-6 pt-2 overflow-hidden">
              {isEditingComment ? (
                <textarea 
                  id="comment-editor"
                  value={planData.comment}
                  onChange={(e) => savePlanData({ ...planData, comment: e.target.value })}
                  className="w-full h-full p-6 bg-neutral-50 border border-neutral-100 rounded-[32px] focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm resize-none shadow-inner no-scrollbar"
                  placeholder="Введите текст в формате Markdown..."
                  autoFocus
                />
              ) : (
                <div className="w-full h-full p-8 bg-white border border-neutral-100 rounded-[32px] overflow-auto prose prose-sm max-w-none shadow-sm no-scrollbar">
                  <ReactMarkdown>{planData.comment}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cell Edit Modal */}
      {editingCell && cellEditValue && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6 sm:p-4">
          <div className="bg-white rounded-[32px] p-6 w-full max-w-md shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">Редактирование ячейки</h3>
              <button onClick={() => setEditingCell(null)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase">Значение (в тыс ₽)</label>
                <input 
                  type="text"
                  value={cellEditValue.value}
                  onChange={(e) => setCellEditValue({ ...cellEditValue, value: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveCell();
                    }
                  }}
                  className="w-full p-3 bg-neutral-50 border border-neutral-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Напр. 22,5 или 😊"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Стиль</label>
                  <button 
                    onClick={() => setCellEditValue({ ...cellEditValue, isBold: !cellEditValue.isBold })}
                    className={cn(
                      "p-3 rounded-xl border transition-all flex items-center gap-2",
                      cellEditValue.isBold ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-neutral-400 border-neutral-200"
                    )}
                  >
                    <Bold size={16} />
                    Жирный
                  </button>
                </div>
                <div className="space-y-2 flex-1">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Цвет текста</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color"
                      value={cellEditValue.color || '#000000'}
                      onChange={(e) => setCellEditValue({ ...cellEditValue, color: e.target.value })}
                      className="w-10 h-10 rounded-lg cursor-pointer border-none"
                    />
                    <button 
                      onClick={() => setCellEditValue({ ...cellEditValue, color: undefined })}
                      className="text-[10px] text-neutral-400 underline"
                    >
                      Сбросить
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase">Комментарий</label>
                <textarea 
                  value={cellEditValue.comment || ''}
                  onChange={(e) => setCellEditValue({ ...cellEditValue, comment: e.target.value })}
                  className="w-full p-3 bg-neutral-50 border border-neutral-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 h-24"
                  placeholder="Добавьте заметку к этой ячейке..."
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button 
                onClick={handleSaveCell}
                className="flex-1 bg-emerald-500 text-white py-3 rounded-2xl font-bold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
              >
                <Save size={18} />
                Сохранить
              </button>
              <button 
                onClick={() => setEditingCell(null)}
                className="flex-1 bg-neutral-100 text-neutral-600 py-3 rounded-2xl font-bold hover:bg-neutral-200 transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subject (Column) Edit Modal */}
      {editingSubject && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6 sm:p-4">
          <div className="bg-white rounded-[32px] p-6 w-full max-w-md shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">Настройка графы</h3>
              <button onClick={() => setEditingSubject(null)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase">Название</label>
                <input 
                  type="text"
                  value={editingSubject.name}
                  onChange={(e) => setEditingSubject({ ...editingSubject, name: e.target.value })}
                  className="w-full p-3 bg-neutral-50 border border-neutral-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Цвет фона</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color"
                      value={editingSubject.color || '#f3f3f3'}
                      onChange={(e) => setEditingSubject({ ...editingSubject, color: e.target.value })}
                      className="w-10 h-10 rounded-lg cursor-pointer border-none"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase">Цвет текста</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color"
                      value={editingSubject.textColor || '#000000'}
                      onChange={(e) => setEditingSubject({ ...editingSubject, textColor: e.target.value })}
                      className="w-10 h-10 rounded-lg cursor-pointer border-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-neutral-50 rounded-2xl border border-neutral-100">
                <input 
                  type="checkbox"
                  id="archive-subject"
                  checked={editingSubject.isArchived}
                  onChange={(e) => setEditingSubject({ ...editingSubject, isArchived: e.target.checked })}
                  className="w-4 h-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="archive-subject" className="text-sm font-medium text-neutral-700 cursor-pointer">
                  В архив (скрыть из текущих)
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button 
                onClick={handleSaveSubject}
                className="flex-1 bg-emerald-500 text-white py-3 rounded-2xl font-bold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
              >
                <Save size={18} />
                Сохранить
              </button>
              <button 
                onClick={() => setEditingSubject(null)}
                className="flex-1 bg-neutral-100 text-neutral-600 py-3 rounded-2xl font-bold hover:bg-neutral-200 transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {subjectToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6 sm:p-4">
          <div className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto">
              <Trash2 size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Удалить графу?</h3>
              <p className="text-sm text-neutral-500">
                Вы уверены, что хотите удалить эту графу расходов? Все данные в этой колонке будут потеряны.
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => handleDeleteSubject(subjectToDelete)}
                className="flex-1 bg-rose-500 text-white py-3 rounded-2xl font-bold hover:bg-rose-600 transition-colors"
              >
                Удалить
              </button>
              <button 
                onClick={() => setSubjectToDelete(null)}
                className="flex-1 bg-neutral-100 text-neutral-600 py-3 rounded-2xl font-bold hover:bg-neutral-200 transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .vertical-text {
          white-space: nowrap;
        }
        .prose h1, .prose h2, .prose h3 {
          margin-top: 1em;
          margin-bottom: 0.5em;
          font-weight: bold;
        }
        .prose p {
          margin-bottom: 1em;
        }
        .prose ul {
          list-style-type: disc;
          padding-left: 1.5em;
          margin-bottom: 1em;
        }
      `}</style>
    </div>
  );
}
