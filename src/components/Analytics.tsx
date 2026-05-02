import { useMemo, useState } from 'react';
import { Transaction, Category, Account, BalanceHistory, Currency } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line } from 'recharts';
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths, startOfYear, endOfYear, eachMonthOfInterval, isBefore, isAfter } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar, X, ChevronLeft, ChevronRight, Filter, TrendingUp, TrendingDown } from 'lucide-react';

interface AnalyticsProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  currencies: Currency[];
  balanceHistory: BalanceHistory[];
  onNavigateToHistory?: (categoryName: string) => void;
  initialType?: 'expense' | 'income';
  initialFilterType?: DateFilterType;
  initialSelectedMonth?: Date;
  initialPeriodRange?: { start: Date; end: Date };
}

type DateFilterType = 'month' | 'period' | 'all';

const CHEERFUL_COLORS = [
  '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', 
  '#FF9F40', '#FFCD56', '#C9CBCF', '#7BC225', '#B0E0E6',
  '#FF5733', '#33FF57', '#3357FF', '#F333FF', '#33FFF3'
];

export default function Analytics({ 
  transactions, 
  categories, 
  accounts, 
  currencies, 
  balanceHistory, 
  onNavigateToHistory,
  initialType = 'expense',
  initialFilterType = 'month',
  initialSelectedMonth = new Date(),
  initialPeriodRange = {
    start: subMonths(new Date(), 3),
    end: new Date()
  }
}: AnalyticsProps) {
  const [activeType, setActiveType] = useState<'expense' | 'income'>(initialType);
  const [filterType, setFilterType] = useState<DateFilterType>(initialFilterType);
  const [selectedMonth, setSelectedMonth] = useState(initialSelectedMonth);
  
  const [periodRange, setPeriodRange] = useState(initialPeriodRange);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (filterType === 'all') return true;
      
      const tDate = new Date(t.createdAt);
      if (filterType === 'month') {
        return isWithinInterval(tDate, {
          start: startOfMonth(selectedMonth),
          end: endOfMonth(selectedMonth)
        });
      }
      
      if (filterType === 'period') {
        return isWithinInterval(tDate, {
          start: periodRange.start,
          end: periodRange.end
        });
      }
      
      return true;
    });
  }, [transactions, filterType, selectedMonth, periodRange]);

  const chartData = useMemo(() => {
    const data: { [key: string]: { name: string, value: number, color: string } } = {};
    
    filteredTransactions
      .filter(t => t.type === activeType)
      .forEach((t) => {
        const cat = categories.find(c => c.id === t.categoryId);
        const parentCat = cat?.parentId ? categories.find(c => c.id === cat.parentId) : cat;
        const name = parentCat?.name || 'Другое';
        
        if (!data[name]) {
          const fallbackColor = CHEERFUL_COLORS[Object.keys(data).length % CHEERFUL_COLORS.length];
          const color = (parentCat?.color && parentCat.color !== '#000000') ? parentCat.color : fallbackColor;
          data[name] = { name, value: 0, color };
        }
        data[name].value += t.amount;
      });
      
    return Object.values(data).sort((a, b) => b.value - a.value);
  }, [filteredTransactions, categories, activeType]);

  const monthlyBalanceTrend = useMemo(() => {
    // Calculate current balance (total in Rubles)
    const currentTotalBalance = accounts
      .filter(a => a.showInTotals && !a.isArchived)
      .reduce((sum, acc) => {
        const rate = acc.currency === '₽' ? 1 : (currencies.find(c => c.symbol === acc.currency)?.rate || 1);
        return sum + (acc.balance * rate);
      }, 0);

    // 1. Get history points and sort them by month ascending
    const historyPoints = [...balanceHistory]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(h => ({
        name: format(new Date(h.month + '-01'), 'MMM', { locale: ru }),
        month: h.month,
        balance: h.totalBalance
      }));

    // 2. Add current state as the last point
    const currentMonthKey = format(new Date(), 'yyyy-MM');
    const currentPoint = {
      name: format(new Date(), 'MMM', { locale: ru }),
      month: currentMonthKey,
      balance: currentTotalBalance
    };

    // If we already have a history point for this month, override it with current balance
    const existingIndex = historyPoints.findIndex(p => p.month === currentMonthKey);
    if (existingIndex !== -1) {
      historyPoints[existingIndex] = currentPoint;
      return historyPoints;
    } else {
      return [...historyPoints, currentPoint].sort((a, b) => a.month.localeCompare(b.month));
    }
  }, [balanceHistory, accounts, currencies]);

  const monthlyTrend = useMemo(() => {
    const data: { [key: string]: { name: string, income: number, expense: number, rawDate: Date } } = {};
    
    // Determine range for trend
    let start: Date, end: Date;
    if (filterType === 'month') {
      start = subMonths(selectedMonth, 5);
      end = selectedMonth;
    } else {
      start = periodRange.start;
      end = periodRange.end;
    }

    // Initialize months
    let current = new Date(start);
    while (current <= end) {
      const m = format(current, 'MMM', { locale: ru });
      const key = format(current, 'yyyy-MM');
      data[key] = { name: m, income: 0, expense: 0, rawDate: new Date(current) };
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }

    transactions.forEach(t => {
      const tDate = new Date(t.createdAt);
      const key = format(tDate, 'yyyy-MM');
      if (data[key]) {
        if (t.type === 'income') data[key].income += t.amount;
        else if (t.type === 'expense') data[key].expense += t.amount;
      }
    });

    return Object.values(data).sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
  }, [transactions, filterType, selectedMonth, periodRange]);

  const totalAmount = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="p-0.5 sm:p-1 lg:p-1 space-y-2">      
      {/* Date Filters & Type Toggle */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
        <div className="bg-theme-surface p-1 sm:p-1.5 rounded-3xl border border-theme-base shadow-sm flex items-stretch gap-1.5 sm:gap-2 overflow-hidden">
          {/* Left column: Type Toggle (Vertical) */}
          <div className="flex flex-col bg-theme-main p-0.5 rounded-2xl w-22 sm:w-26 shrink-0">
            <button
              onClick={() => setActiveType('expense')}
              className={cn(
                "flex-1 px-1 sm:px-2 py-0.5 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 sm:gap-2 p-[10px]",
                activeType === 'expense' ? "bg-theme-surface text-rose-500 shadow-sm" : "text-theme-muted hover:text-theme-main"
              )}
            >
              <TrendingDown className="w-3 h-3" />
              Расход
            </button>
            <button
              onClick={() => setActiveType('income')}
              className={cn(
                "flex-1 px-1 sm:px-2 py-0.5 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 sm:gap-2 p-[10px]",
                activeType === 'income' ? "bg-theme-surface text-emerald-500 shadow-sm" : "text-theme-muted hover:text-theme-main"
              )}
            >
              <TrendingUp className="w-3 h-3" />
              Доход
            </button>
          </div>

          {/* Right column: Filter Type and Specific Selector */}
          <div className="flex flex-col gap-1.5 flex-1 justify-center min-w-0">
            {/* Row 1: Month / Period Toggle */}
            <div className="flex bg-theme-main p-0.5 rounded-xl w-full">
              <button
                onClick={() => setFilterType('month')}
                className={cn(
                  "flex-1 px-1 sm:px-2 py-1 rounded-lg font-bold uppercase tracking-wider transition-all text-[11px]",
                  filterType === 'month' ? "bg-theme-surface text-theme-main shadow-sm" : "text-theme-muted hover:text-theme-main"
                )}
              >
                Месяц
              </button>
              <button
                onClick={() => setFilterType('period')}
                className={cn(
                  "flex-1 px-1 sm:px-2 py-1 rounded-lg font-bold uppercase tracking-wider transition-all text-[11px]",
                  filterType === 'period' ? "bg-theme-surface text-theme-main shadow-sm" : "text-theme-muted hover:text-theme-main"
                )}
              >
                Период
              </button>
            </div>

            {/* Row 2: The actual picker based on selection */}
            <div className="flex items-center w-full min-w-0">
              {filterType === 'month' && (
                <div className="flex items-center justify-between gap-1 bg-theme-main/50 border border-theme-base px-0.5 sm:px-1 py-0.5 rounded-xl shadow-sm w-full">
                  <button 
                    onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
                    className="p-1 hover:bg-theme-surface rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-3 h-3 text-theme-muted" />
                  </button>
                  <span className="text-[10px] font-bold capitalize flex-1 text-center truncate text-theme-main">
                    {format(selectedMonth, 'LLLL yyyy', { locale: ru })}
                  </span>
                  <button 
                    onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1))}
                    className="p-1 hover:bg-theme-surface rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-3 h-3 text-theme-muted" />
                  </button>
                </div>
              )}

              {filterType === 'period' && (
                <div className="flex items-center justify-center gap-1 bg-theme-main/50 border border-theme-base px-0.5 py-1 rounded-xl shadow-sm w-full overflow-hidden">
                  <div className="flex items-center gap-0.5 justify-between w-full px-0.5">
                    <input 
                      type="date" 
                      value={format(periodRange.start, 'yyyy-MM-dd')}
                      onChange={(e) => setPeriodRange(prev => ({ ...prev, start: new Date(e.target.value) }))}
                      className="text-[9px] sm:text-[10px] font-bold bg-transparent border-none focus:ring-0 p-0 w-[45%] text-center text-theme-main"
                    />
                    <span className="text-theme-muted text-[10px] shrink-0">—</span>
                    <input 
                      type="date" 
                      value={format(periodRange.end, 'yyyy-MM-dd')}
                      onChange={(e) => setPeriodRange(prev => ({ ...prev, end: new Date(e.target.value) }))}
                      className="text-[9px] sm:text-[10px] font-bold bg-transparent border-none focus:ring-0 p-0 w-[45%] text-center text-theme-main"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="hidden lg:block" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {/* Pie Chart */}
        <section className="bg-theme-surface p-3 rounded-3xl border border-theme-base shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg text-theme-main">
              {activeType === 'expense' ? 'Расходы' : 'Доходы'} по категориям
            </h3>
            <div className="text-right">
              <p className="text-[10px] font-bold text-theme-muted uppercase tracking-widest">Итого</p>
              <p className={cn("text-lg font-bold", activeType === 'income' ? "text-emerald-500" : "text-rose-500")}>
                {totalAmount.toLocaleString()} ₽
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="h-64 w-full sm:w-1/2 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={800}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: 'var(--theme-surface)', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', padding: '8px' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--theme-main)' }}
                    labelStyle={{ color: 'var(--text-muted)' }}
                    formatter={(value: number, name: string, props: any) => [
                      `${value.toLocaleString()} ₽`, 
                      props.payload.name
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              {chartData.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-theme-muted text-sm font-medium italic">
                  Нет данных
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 w-full sm:w-1/2">
              {chartData.map((item, i) => (
                <div 
                  key={i} 
                  onClick={() => {
                    if (onNavigateToHistory) onNavigateToHistory(item.name);
                  }}
                  className="flex items-center gap-3 group cursor-pointer hover:bg-theme-primary/5 p-2 rounded-xl transition-colors"
                >
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-theme-main truncate flex-1">{item.name}</span>
                  <span className="text-sm font-bold text-theme-main">{item.value.toLocaleString()} ₽</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bar Chart */}
        <section className="bg-theme-surface p-3 rounded-3xl border border-theme-base shadow-sm">
          <h3 className="font-bold text-lg mb-6 text-theme-main">Динамика</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend}>
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 600 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  cursor={{ fill: 'var(--theme-main)', opacity: 0.05 }}
                  contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: 'var(--theme-surface)', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                <Bar dataKey="income" name="Доход" fill="#10b981" radius={[4, 4, 0, 0]} barSize={12} />
                <Bar dataKey="expense" name="Расход" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-2 mt-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-theme-muted uppercase tracking-widest">Доход</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500" />
              <span className="text-[10px] font-bold text-theme-muted uppercase tracking-widest">Расход</span>
            </div>
          </div>
        </section>
        
        <section className="bg-theme-surface p-2 rounded-3xl border border-theme-base shadow-sm">
          <h3 className="font-bold text-lg mb-6 text-theme-main">Динамика баланса</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyBalanceTrend}>
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 600 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: 'var(--theme-surface)', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  formatter={(value: number) => [`${value.toLocaleString()} ₽`, 'Баланс']}
                />
                <Line type="monotone" dataKey="balance" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--primary)' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Bottom Bar Spacer */}
        <div className="h-10 lg:hidden shrink-0" />

      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
