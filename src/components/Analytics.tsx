import { useMemo, useState } from 'react';
import { Transaction, Category, Account, BalanceHistory } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line } from 'recharts';
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths, startOfYear, endOfYear, eachMonthOfInterval, isBefore, isAfter } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar, X, ChevronLeft, ChevronRight, Filter, TrendingUp, TrendingDown } from 'lucide-react';

interface AnalyticsProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  balanceHistory: BalanceHistory[];
  onNavigateToHistory?: (categoryName: string) => void;
}

type DateFilterType = 'month' | 'period' | 'all';

const CHEERFUL_COLORS = [
  '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', 
  '#FF9F40', '#FFCD56', '#C9CBCF', '#7BC225', '#B0E0E6',
  '#FF5733', '#33FF57', '#3357FF', '#F333FF', '#33FFF3'
];

export default function Analytics({ transactions, categories, accounts, balanceHistory, onNavigateToHistory }: AnalyticsProps) {
  const [activeType, setActiveType] = useState<'expense' | 'income'>('expense');
  const [filterType, setFilterType] = useState<DateFilterType>('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  
  const [periodRange, setPeriodRange] = useState({
    start: subMonths(new Date(), 3),
    end: new Date()
  });

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
    if (balanceHistory && balanceHistory.length > 0) {
      return balanceHistory.map(h => ({
        name: format(new Date(h.month + '-01'), 'MMM', { locale: ru }),
        balance: h.totalBalance
      }));
    }

    // Fallback to calculation if no history
    const accountsInTotal = accounts.filter(a => a.showInTotals);
    const start = subMonths(new Date(), 5);
    const end = new Date();
    
    const months = eachMonthOfInterval({ start, end });
    
    return months.map(month => {
      const monthEnd = endOfMonth(month);
      
      let balance = 0;
      
      transactions.forEach(t => {
        if (isBefore(new Date(t.createdAt), monthEnd) || isWithinInterval(new Date(t.createdAt), { start: startOfMonth(month), end: monthEnd })) {
          if (accountsInTotal.some(a => a.id === t.accountId)) {
            if (t.type === 'income') balance += t.amount;
            else if (t.type === 'expense') balance -= t.amount;
          }
        }
      });
      
      return {
        name: format(month, 'MMM', { locale: ru }),
        balance
      };
    });
  }, [transactions, accounts, balanceHistory]);

  const monthlyTrend = useMemo(() => {
    const data: { [key: string]: { name: string, income: number, expense: number, rawDate: Date } } = {};
    
    // Determine range for trend
    let start: Date, end: Date;
    if (filterType === 'month') {
      start = subMonths(selectedMonth, 5);
      end = selectedMonth;
    } else if (filterType === 'period') {
      start = periodRange.start;
      end = periodRange.end;
    } else {
      // For 'all', show last 12 months
      end = new Date();
      start = subMonths(end, 11);
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
    <div className="p-1.5 sm:p-2 lg:p-2 space-y-2">      
    
      {/* Date Filters & Type Toggle */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Type Toggle - Vertical and to the right */}
        <div className="flex flex-col bg-neutral-100 p-1 rounded-2xl">
          <button
            onClick={() => setActiveType('expense')}
            className={cn(
              "px-1 py-1 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2",
              activeType === 'expense' ? "bg-white text-rose-600 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
            )}
          >
            <TrendingDown className="w-3 h-3" />
            Расходы
          </button>
          <button
            onClick={() => setActiveType('income')}
            className={cn(
              "px-1 py-1 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2",
              activeType === 'income' ? "bg-white text-emerald-600 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
            )}
          >
            <TrendingUp className="w-3 h-3" />
            Доходы
          </button>
        </div>
        <div>
          <div className="flex bg-white border border-neutral-100 p-1 rounded-2xl shadow-sm">
            <button
              onClick={() => setFilterType('month')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all",
                filterType === 'month' ? "bg-neutral-900 text-white" : "text-neutral-400 hover:text-neutral-600"
              )}
            >
              Месяц
            </button>
            <button
              onClick={() => setFilterType('period')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all",
                filterType === 'period' ? "bg-neutral-900 text-white" : "text-neutral-400 hover:text-neutral-600"
              )}
            >
              Период
            </button>
            <button
              onClick={() => setFilterType('all')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all",
                filterType === 'all' ? "bg-neutral-900 text-white" : "text-neutral-400 hover:text-neutral-600"
              )}
            >
              Все время
            </button>
          </div>

          {filterType === 'month' && (
            <div className="flex items-center gap-1 bg-white border border-neutral-100 px-3 py-1.5 rounded-2xl shadow-sm">
              <button 
                onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
                className="p-1 hover:bg-neutral-50 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-2 h-4 text-neutral-400" />
              </button>
              <span className="text-xs font-bold capitalize min-w-[80px] text-center">
                {format(selectedMonth, 'LLLL yyyy', { locale: ru })}
              </span>
              <button 
                onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1))}
                className="p-1 hover:bg-neutral-50 rounded-lg transition-colors"
              >
                <ChevronRight className="w-2 h-4 text-neutral-400" />
              </button>
            </div>
          )}

          {filterType === 'period' && (
            <div className="flex items-center gap-1 bg-white border border-neutral-100 px-3 py-1.5 rounded-2xl shadow-sm">
              <div className="flex items-center gap-1">
                <input 
                  type="date" 
                  value={format(periodRange.start, 'yyyy-MM-dd')}
                  onChange={(e) => setPeriodRange(prev => ({ ...prev, start: new Date(e.target.value) }))}
                  className="text-[10px] font-bold bg-transparent border-none focus:ring-0 p-0 w-24"
                />
                <span className="text-neutral-300">—</span>
                <input 
                  type="date" 
                  value={format(periodRange.end, 'yyyy-MM-dd')}
                  onChange={(e) => setPeriodRange(prev => ({ ...prev, end: new Date(e.target.value) }))}
                  className="text-[10px] font-bold bg-transparent border-none focus:ring-0 p-0 w-24"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {/* Pie Chart */}
        <section className="bg-white p-3 rounded-3xl border border-neutral-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg">
              {activeType === 'expense' ? 'Расходы' : 'Доходы'} по категориям
            </h3>
            <div className="text-right">
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Итого</p>
              <p className={cn("text-lg font-bold", activeType === 'income' ? "text-emerald-600" : "text-rose-600")}>
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
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '6px' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                    formatter={(value: number, name: string, props: any) => [
                      `${value.toLocaleString()} ₽`, 
                      props.payload.name
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              {chartData.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-neutral-300 text-sm font-medium">
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
                  className="flex items-center gap-3 group cursor-pointer hover:bg-neutral-50 p-2 rounded-xl transition-colors"
                >
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-neutral-600 truncate flex-1">{item.name}</span>
                  <span className="text-sm font-bold text-neutral-900">{item.value.toLocaleString()} ₽</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bar Chart */}
        <section className="bg-white p-3 rounded-3xl border border-neutral-100 shadow-sm">
          <h3 className="font-bold text-lg mb-6">Динамика</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend}>
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
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
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Доход</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500" />
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Расход</span>
            </div>
          </div>
        </section>
        
        <section className="bg-white p-2 rounded-3xl border border-neutral-100 shadow-sm">
          <h3 className="font-bold text-lg mb-6">Динамика баланса</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyBalanceTrend}>
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  formatter={(value: number) => [`${value.toLocaleString()} ₽`, 'Баланс']}
                />
                <Line type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
