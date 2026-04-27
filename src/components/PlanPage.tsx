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
  Heading2,
  Heading3,
  ListChecks,
  Palette,
  Plus,
  Trash2,
  Edit3,
  Pencil,
  Check
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  const [loadedTabs, setLoadedTabs] = useState<Set<TabType>>(new Set(['config']));
  const [editingCell, setEditingCell] = useState<{ rowId: string, subjectId: string } | null>(null);
  const [cellEditValue, setCellEditValue] = useState<PlanCell | null>(null);
  const [editingSubject, setEditingSubject] = useState<PlanSubject | null>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<string | null>(null);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [isEditingComment, setIsEditingComment] = useState(false);
  
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, rowId: string | null }>({ x: 0, y: 0, rowId: null });
  const [rowEditor, setRowEditor] = useState<{ mode: 'addBefore' | 'addAfter' | null, rowId: string | null, label: string, type: 'month' | 'min' | 'year' | 'past' }>({ mode: null, rowId: null, label: '', type: 'month' });
  const [rowToDelete, setRowToDelete] = useState<string | null>(null);

  const handleSaveCashback = (newData: PlanData) => {
    savePlanData(newData, 'cashback');
  };

  // Load data from API
  useEffect(() => {
    const loadData = async (type: TabType, retries = 3) => {
      try {
        const data = await api.get<any>(`/plan-grid/${type}`);
        
        if (data) {
          setPlanData(prev => {
            const newData: PlanData = prev ? { ...prev } : {
              id: 'default',
              userId: 'user',
              subjects: [],
              rows: [
                { id: '2026-01', label: 'Янв', cells: {}, type: 'month' },
                { id: '2026-02', label: 'Фев', cells: {}, type: 'month' },
                { id: '2026-03', label: 'Мар', cells: {}, type: 'month' },
                { id: '2026-04', label: 'Апр', cells: {}, type: 'month' },
                { id: '2026-min-4', label: 'min', cells: {}, type: 'min' },
                { id: '2026-05', label: 'Май', cells: {}, type: 'month' },
                { id: '2026-06', label: 'Июн', cells: {}, type: 'month' },
                { id: '2026-07', label: 'Июл', cells: {}, type: 'month' },
                { id: '2026-08', label: 'Авг', cells: {}, type: 'month' },
                { id: '2026-min-8', label: 'min', cells: {}, type: 'min' },
                { id: '2026-09', label: 'Сен', cells: {}, type: 'month' },
                { id: '2026-10', label: 'Окт', cells: {}, type: 'month' },
                { id: '2026-11', label: 'Ноя', cells: {}, type: 'month' },
                { id: '2026-12', label: 'Дек', cells: {}, type: 'month' },
                { id: '2026-min-12', label: 'min', cells: {}, type: 'min' }
              ],
              config: INITIAL_CONFIG,
              cashback: { categories: DEFAULT_CASHBACK_CATEGORIES, entries: [], months: [] },
              comment: '',
              updatedAt: new Date().toISOString()
            };
            
            if (type === 'now' || type === 'past') {
              newData.subjects = data.subjects || [];
              newData.rows = data.rows || newData.rows;
              newData.pastRows = data.pastRows || [];
            } else if (type === 'config') {
              newData.config = data;
            } else if (type === 'cashback') {
              newData.cashback = data;
            } else if (type === 'comment') {
              newData.comment = typeof data === 'string' ? data : (data.comment || '');
            }
            return newData;
          });
          setLoadedTabs(prev => new Set(prev).add(type));
        } else {
          // Initialize with default if no data found
          setPlanData(prev => prev || {
            id: 'default',
            userId: 'user',
            subjects: [],
            rows: [
              { id: '2026-01', label: 'Янв', cells: {}, type: 'month' },
              { id: '2026-02', label: 'Фев', cells: {}, type: 'month' },
              { id: '2026-03', label: 'Мар', cells: {}, type: 'month' },
              { id: '2026-04', label: 'Апр', cells: {}, type: 'month' },
              { id: '2026-min-4', label: 'min', cells: {}, type: 'min' },
              { id: '2026-05', label: 'Май', cells: {}, type: 'month' },
              { id: '2026-06', label: 'Июн', cells: {}, type: 'month' },
              { id: '2026-07', label: 'Июл', cells: {}, type: 'month' },
              { id: '2026-08', label: 'Авг', cells: {}, type: 'month' },
              { id: '2026-min-8', label: 'min', cells: {}, type: 'min' },
              { id: '2026-09', label: 'Сен', cells: {}, type: 'month' },
              { id: '2026-10', label: 'Окт', cells: {}, type: 'month' },
              { id: '2026-11', label: 'Ноя', cells: {}, type: 'month' },
              { id: '2026-12', label: 'Дек', cells: {}, type: 'month' },
              { id: '2026-min-12', label: 'min', cells: {}, type: 'min' }
            ],
            config: INITIAL_CONFIG,
            cashback: { categories: DEFAULT_CASHBACK_CATEGORIES, entries: [], months: [] },
            comment: '',
            updatedAt: new Date().toISOString()
          });
          setLoadedTabs(prev => new Set(prev).add(type));
        }
      } catch (error) {
        console.error(`Error loading plan grid type ${type}:`, error);
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          await loadData(type, retries - 1);
        }
      }
    };

    // Always load config
    if (!loadedTabs.has('config')) {
      loadData('config');
    }
    
    // Load active tab if not loaded
    if (!loadedTabs.has(activeTab)) {
      loadData(activeTab);
    }
  }, [activeTab, loadedTabs]);

  const savePlanData = async (newData: PlanData, type: TabType) => {
    setPlanData(newData);
    try {
      let dataToSave: any;
      if (type === 'now' || type === 'past') dataToSave = { subjects: newData.subjects, rows: newData.rows, pastRows: newData.pastRows };
      else if (type === 'config') dataToSave = newData.config;
      else if (type === 'cashback') dataToSave = newData.cashback;
      else if (type === 'comment') dataToSave = { comment: newData.comment };
      
      await api.post(`/plan-grid/${type}`, dataToSave);
    } catch (error) {
      console.error(`Error saving plan grid type ${type}:`, error);
    }
  };

  const parseValue = (val: string): number => {
    if (!val) return 0;
    const normalized = val.replace(',', '.').replace(/[^\d.]/g, '');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  };

  const calculateRowTotal = (row: PlanRow) => {
    const subjectIdsToSum = activeTab === 'now' 
      ? planData!.subjects.filter(s => !s.isArchived).map(s => s.id)
      : planData!.subjects.map(s => s.id);
      
    return Object.entries(row.cells).reduce((sum, [subjectId, cell]) => {
      if (!subjectIdsToSum.includes(subjectId)) return sum;
      
      const val = cell.value;
      if (val === undefined || val === null || val === '') return sum;
      
      const parsed = parseValue(val);
      return sum + parsed;
    }, 0);
  };

  const filteredRows = useMemo(() => {
    if (!planData) return [];
    if (activeTab === 'past') {
      return planData.pastRows || [];
    }
    return planData.rows.filter(row => row.type !== 'past');
  }, [planData, activeTab]);

  const visibleSubjects = useMemo(() => {
    if (!planData) return [];
    if (planData.subjects.length === 0) {
      return [{
        id: 'default-expense',
        name: 'Расход',
        color: '#f3f3f3',
        textColor: '#000000',
        isArchived: false
      }];
    }
    if (activeTab === 'now') return planData.subjects.filter(s => !s.isArchived);
    if (activeTab === 'past') return planData.subjects;
    return planData.subjects;
  }, [planData, activeTab]);

  const handleContextMenu = (e: React.MouseEvent, rowId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, rowId });
  };

  const handleCellClick = (rowId: string, subjectId: string) => {
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
    }, activeTab);
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
    }, activeTab);
    setNewSubjectName('');
    setShowAddSubject(false);
  };

  const handleSaveSubject = () => {
    if (!planData || !editingSubject) return;
    savePlanData({
      ...planData,
      subjects: planData.subjects.map(s => s.id === editingSubject.id ? editingSubject : s)
    }, activeTab);
    setEditingSubject(null);
  };

  const handleDeleteSubject = (id: string) => {
    if (!planData) return;
    const newRows = planData.rows.map(row => {
      const newCells = { ...row.cells };
      delete newCells[id];
      return { ...row, cells: newCells };
    });
    savePlanData({
      ...planData,
      subjects: planData.subjects.filter(s => s.id !== id),
      rows: newRows
    }, activeTab);
    setSubjectToDelete(null);
  };

  const handleArchiveRow = async (rowId: string) => {
    if (!planData) return;
    const rowToArchive = planData.rows.find(r => r.id === rowId);
    if (!rowToArchive) return;

    const newRows = planData.rows.filter(r => r.id !== rowId);
    // Mark as past and ensure it's in the pastRows array
    const archivedRow = { ...rowToArchive, type: 'past' as 'past' };
    const newPastRows = [...(planData.pastRows || []), archivedRow];

    const newData = {
      ...planData,
      rows: newRows,
      pastRows: newPastRows
    };

    await savePlanData(newData, 'now');
    await savePlanData(newData, 'past');
  };

  const handleAddRow = () => {
    if (!planData || !rowEditor.rowId) return;
    
    const newRow: PlanRow = {
      id: Date.now().toString(),
      label: rowEditor.label,
      type: rowEditor.type as 'month' | 'min' | 'year' | 'past',
      cells: {}
    };

    const rowIndex = planData.rows.findIndex(r => r.id === rowEditor.rowId);
    const newRows = [...planData.rows];
    
    if (rowEditor.mode === 'addBefore') {
      newRows.splice(rowIndex, 0, newRow);
    } else {
      newRows.splice(rowIndex + 1, 0, newRow);
    }

    savePlanData({ ...planData, rows: newRows }, 'now');
    setRowEditor({ mode: null, rowId: null, label: '', type: 'month' });
  };

  if (!planData) return null;

  return (
    <div className="p-0 sm:p-0 space-y-0 max-w-[100vw] overflow-hidden h-full flex flex-col">
      {/* Custom Minimalist Tabs */}
      <div className="flex items-end space-x-1 border-b border-neutral-200 px-1 pt-1 shrink-0">
        <button
          onClick={() => setActiveTab('now')}
          className={cn(
            "px-2 py-0.5 rounded-t-xl text-xs font-bold transition-all border-t border-l border-r",
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
            "px-2 py-0.5 rounded-t-xl text-xs font-bold transition-all border-t border-l border-r",
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
            "px-2 py-0.5 rounded-t-xl text-xs font-bold transition-all border-t border-l border-r",
            activeTab === 'comment' 
              ? "bg-blue-500 text-white border-purple-500 translate-y-[1px]" 
              : "bg-neutral-50 text-neutral-400 border-neutral-200 hover:bg-neutral-100"
          )}
        >
          Заметки
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={cn(
            "px-2 py-0.5 rounded-t-xl text-xs font-bold transition-all border-t border-l border-r",
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
                      onContextMenu={(e) => handleContextMenu(e, row.id)}
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
            
            {/* Bottom Bar Spacer */}
            {activeTab === 'now' && (
              <div className="mt-0 px-4 pb-0 flex flex-col gap-6">
                <div className="flex items-center gap-4">
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
                </div>

                {/* Config Section embedded at the bottom of NOW tab */}
                <div className="border-t border-neutral-100 pt-6 pb-12 space-y-4 max-w-xl">
                  <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Настройки таблицы</h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase">Сумма к которой стремимся</label>
                      <input 
                        type="number"
                        value={planData.config.targetAmount}
                        onChange={(e) => savePlanData({
                          ...planData,
                          config: { ...planData.config, targetAmount: parseInt(e.target.value) || 0 }
                        }, 'config')}
                        className="w-full p-2 bg-neutral-50 border border-neutral-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase">Цвет итогов</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="color"
                            value={planData.config.totalColumnColor}
                            onChange={(e) => savePlanData({
                              ...planData,
                              config: { ...planData.config, totalColumnColor: e.target.value }
                            }, 'config')}
                            className="w-6 h-6 rounded cursor-pointer border-none p-0 bg-transparent"
                          />
                          <span className="text-[10px] font-mono text-neutral-400">{planData.config.totalColumnColor}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase">Цвет заголовка</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="color"
                            value={planData.config.headerColor}
                            onChange={(e) => savePlanData({
                              ...planData,
                              config: { ...planData.config, headerColor: e.target.value }
                            }, 'config')}
                            className="w-6 h-6 rounded cursor-pointer border-none p-0 bg-transparent"
                          />
                          <span className="text-[10px] font-mono text-neutral-400">{planData.config.headerColor}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase">Цвет 1-й колонки</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="color"
                            value={planData.config.firstColumnColor}
                            onChange={(e) => savePlanData({
                              ...planData,
                              config: { ...planData.config, firstColumnColor: e.target.value }
                            }, 'config')}
                            className="w-6 h-6 rounded cursor-pointer border-none p-0 bg-transparent"
                          />
                          <span className="text-[10px] font-mono text-neutral-400">{planData.config.firstColumnColor}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase">Цвет строки MIN</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="color"
                            value={planData.config.minRowColor}
                            onChange={(e) => savePlanData({
                              ...planData,
                              config: { ...planData.config, minRowColor: e.target.value }
                            }, 'config')}
                            className="w-6 h-6 rounded cursor-pointer border-none p-0 bg-transparent"
                          />
                          <span className="text-[10px] font-mono text-neutral-400">{planData.config.minRowColor}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between p-1 pb-2 shrink-0">
              <div className="flex items-center gap-3">
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
                      savePlanData({ ...planData, comment: before + `**${selected}**` + after }, 'comment');
                    }}
                    className="p-1 hover:bg-white hover:shadow-sm rounded-lg transition-all"
                    title="Жирный"
                  >
                    <Bold size={14} />
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
                      savePlanData({ ...planData, comment: before + `*${selected}*` + after }, 'comment');
                    }}
                    className="p-1 hover:bg-white hover:shadow-sm rounded-lg transition-all"
                    title="Курсив"
                  >
                    <Italic size={14} />
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
                      savePlanData({ ...planData, comment: before + `~~${selected}~~` + after }, 'comment');
                    }}
                    className="p-1 hover:bg-white hover:shadow-sm rounded-lg transition-all"
                    title="Зачеркнутый"
                  >
                    <Strikethrough size={14} />
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
                      savePlanData({ ...planData, comment: before + `\n# ${selected}` + after }, 'comment');
                    }}
                    className="p-1 hover:bg-white hover:shadow-sm rounded-lg transition-all"
                    title="Заголовок"
                  >
                    <Heading1 size={14} />
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
                      savePlanData({ ...planData, comment: before + `\n## ${selected}` + after }, 'comment');
                    }}
                    className="p-1 hover:bg-white hover:shadow-sm rounded-lg transition-all"
                    title="Заголок 2"
                  >
                    <Heading2 size={14} />
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
                      savePlanData({ ...planData, comment: before + `\n### ${selected}` + after }, 'comment');
                    }}
                    className="p-1 hover:bg-white hover:shadow-sm rounded-lg transition-all"
                    title="Заголок 3"
                  >
                    <Heading3 size={14} />
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
                      savePlanData({ ...planData, comment: before + `\n- [ ] ${selected}` + after }, 'comment');
                    }}
                    className="p-1 hover:bg-white hover:shadow-sm rounded-lg transition-all"
                    title="Список задач"
                  >
                    <ListChecks size={14} />
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
                      // PlainText - just inserted as is if wrapped, or maybe just inserted
                      savePlanData({ ...planData, comment: before + selected + after }, 'comment');
                    }}
                    className="p-1 hover:bg-white hover:shadow-sm rounded-lg transition-all"
                    title="Обычный текст"
                  >
                    <Type size={14} />
                  </button>
                </div>
              )}
            </div>
            
            <div className="flex-1 p-1 pt-2 overflow-hidden">
              {isEditingComment ? (
                <textarea 
                  id="comment-editor"
                  value={planData.comment}
                  onChange={(e) => savePlanData({ ...planData, comment: e.target.value }, 'comment')}
                  className="w-full h-full p-6 bg-neutral-50 border border-neutral-100 rounded-[32px] focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm resize-none shadow-inner no-scrollbar"
                  placeholder="Введите текст в формате Markdown..."
                  autoFocus
                />
              ) : (
                <div className="w-full h-full p-8 bg-white border border-neutral-100 rounded-[32px] overflow-auto markdown-body shadow-sm no-scrollbar">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{planData.comment}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cell Edit Modal */}
      {editingCell && cellEditValue && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-2">
          <div className="bg-white rounded-[32px] p-3 w-full max-w-md shadow-2xl space-y-6">
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

      {contextMenu.rowId && (
        <div 
          className="fixed bg-white shadow-lg border border-neutral-200 rounded-lg z-50 py-1 min-w-[150px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={() => setContextMenu({ x: 0, y: 0, rowId: null })}
        >
          <button className="block w-full text-left px-4 py-2 text-xs hover:bg-neutral-100" onClick={() => setRowEditor({ mode: 'addBefore', rowId: contextMenu.rowId, label: '', type: 'month' })}>Добавить до</button>
          <button className="block w-full text-left px-4 py-2 text-xs hover:bg-neutral-100" onClick={() => setRowEditor({ mode: 'addAfter', rowId: contextMenu.rowId, label: '', type: 'month' })}>Добавить после</button>
          <button className="block w-full text-left px-4 py-2 text-xs hover:bg-neutral-100 text-neutral-500" onClick={() => handleArchiveRow(contextMenu.rowId!)}>В архив</button>
          <button className="block w-full text-left px-4 py-2 text-xs hover:bg-rose-50 text-rose-500" onClick={() => setRowToDelete(contextMenu.rowId)}>Удалить</button>
        </div>
      )}

      {/* Row Editor Modal */}
      {rowEditor.mode && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6 sm:p-4">
          <div className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl space-y-6">
            <h3 className="text-xl font-bold text-center">Добавить строку</h3>
            <div className="space-y-4">
              <input 
                type="text"
                placeholder="Текст"
                value={rowEditor.label}
                onChange={(e) => setRowEditor({ ...rowEditor, label: e.target.value })}
                className="w-full p-3 border border-neutral-200 rounded-2xl"
              />
              <select 
                value={rowEditor.type}
                onChange={(e) => setRowEditor({ ...rowEditor, type: e.target.value as any })}
                className="w-full p-3 border border-neutral-200 rounded-2xl"
              >
                <option value="month">Месяц</option>
                <option value="min">Минимум</option>
                <option value="year">Год</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={handleAddRow}
                className="flex-1 bg-emerald-500 text-white py-3 rounded-2xl font-bold hover:bg-emerald-600 transition-colors"
              >
                Добавить
              </button>
              <button 
                onClick={() => setRowEditor({ mode: null, rowId: null, label: '', type: 'month' })}
                className="flex-1 bg-neutral-100 text-neutral-600 py-3 rounded-2xl font-bold hover:bg-neutral-200 transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Row Confirmation Modal */}
      {rowToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6 sm:p-4">
          <div className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto">
              <Trash2 size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Удалить строку?</h3>
              <p className="text-sm text-neutral-500">
                Вы уверены, что хотите удалить эту строку? Это действие нельзя отменить.
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  if (!planData) return;
                  const newRows = planData.rows.filter(r => r.id !== rowToDelete);
                  savePlanData({ ...planData, rows: newRows }, 'now');
                  setRowToDelete(null);
                }}
                className="flex-1 bg-rose-500 text-white py-3 rounded-2xl font-bold hover:bg-rose-600 transition-colors"
              >
                Удалить
              </button>
              <button 
                onClick={() => setRowToDelete(null)}
                className="flex-1 bg-neutral-100 text-neutral-600 py-3 rounded-2xl font-bold hover:bg-neutral-200 transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Subject Confirmation Modal */}
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
