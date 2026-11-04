import { useEffect, useMemo, useState } from 'react';
import { Transaction, Category, Account, BalanceHistory, Currency, PlannedPayment } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line, AreaChart, Area, ReferenceLine } from 'recharts';
import { api } from '../lib/api';
import { buildPlanForecast, totalRubleBalance, PLAN_FORECAST_MONTHS, PlanForecastPoint } from '../lib/planForecast';
import { parseDateKey } from '../lib/plannedPaymentOccurrences';
import { formatSignedAmount } from '../lib/planTotals';
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths, startOfYear, endOfYear, eachMonthOfInterval, isBefore, isAfter } from 'date-fns';
import { ru } from 'date-fns/locale';
import { groupSmallCategories } from '../lib/categoryGrouping';
import { Calendar, X, ChevronLeft, ChevronRight, Filter, TrendingUp, TrendingDown } from 'lucide-react';

interface AnalyticsProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  currencies: Currency[];
  balanceHistory: BalanceHistory[];
  onNavigateToHistory?: (
    categoryName: string, 
    dateFilter?: {
      startDate?: string;
      endDate?: string;
      selectedMonth?: Date;
    }
  ) => void;
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
  const [plannedPayments, setPlannedPayments] = useState<PlannedPayment[] | null>(null);
  const [plansError, setPlansError] = useState(false);

  useEffect(() => {
    let active = true;
    api.get<{ payments?: PlannedPayment[] }>('/plan-grid/calendar')
      .then(data => {
        if (!active) return;
        setPlannedPayments(Array.isArray(data?.payments) ? data.payments : []);
        setPlansError(false);
      })
      .catch(() => {
        if (active) setPlansError(true);
      });
    return () => { active = false; };
  }, []);

  const planForecast = useMemo(
    () => buildPlanForecast(plannedPayments || [], accounts, currencies),
    [plannedPayments, accounts, currencies]
  );

  const handleCategoryClick = (categoryName: string) => {
    if (!onNavigateToHistory) return;
    
    if (filterType === 'month') {
      onNavigateToHistory(categoryName, {
        selectedMonth,
        startDate: '',
        endDate: ''
      });
    } else if (filterType === 'period') {
      onNavigateToHistory(categoryName, {
        startDate: format(periodRange.start, 'yyyy-MM-dd'),
        endDate: format(periodRange.end, 'yyyy-MM-dd')
      });
    } else {
      onNavigateToHistory(categoryName);
    }
  };

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
      
    return groupSmallCategories(Object.values(data));
  }, [filteredTransactions, categories, activeType]);

  const monthlyBalanceTrend = useMemo(() => {
    // Current total in rubles, counted exactly like the balance card and the plan forecast.
    const currentTotalBalance = totalRubleBalance(accounts, currencies);

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
          <style>{`
            .recharts-sector, 
            .recharts-pie-sector, 
            .recharts-sector:focus, 
            .recharts-pie-sector:focus,
            path.recharts-sector {
              outline: none !important;
              -webkit-tap-highlight-color: transparent;
            }
            
            .recharts-pie-sector {
              transition: stroke 0.15s ease, stroke-width 0.15s ease, opacity 0.15s ease;
              cursor: pointer;
            }
            
            .recharts-pie-sector:hover {
               stroke: var(--color-action) !important;
              stroke-width: 3px !important;
              opacity: 0.92;
            }

            .recharts-pie-sector:active {
              opacity: 0.8;
            }
          `}</style>
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
                    onClick={(data) => {
                      if (data && data.name && !data.payload?.isOther) {
                        handleCategoryClick(data.name);
                      }
                    }}
                  >
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color} 
                        stroke="none" 
                        className={cn("hover:opacity-80 transition-opacity focus:outline-none outline-none", !entry.isOther && "cursor-pointer")}
                        style={{ outline: 'none' }}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: 'var(--radius-card)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-card)', boxShadow: 'var(--shadow-elegant)', padding: '8px' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-primary)' }}
                    labelStyle={{ color: 'var(--text-muted)' }}
                    formatter={(value: number, name: string, props: any) => [
                      `${value.toLocaleString()} ₽`, 
                      props.payload.isOther
                        ? `${props.payload.name}: ${props.payload.members.join(', ')}`
                        : props.payload.name
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
                  onClick={item.isOther ? undefined : () => handleCategoryClick(item.name)}
                  title={item.isOther ? item.members?.join(', ') : undefined}
                  className={cn(
                    "flex items-center gap-3 group p-2 rounded-xl transition-colors",
                    !item.isOther && "cursor-pointer hover:bg-theme-primary/5"
                  )}
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
                  cursor={{ fill: 'var(--border-subtle)', fillOpacity: 0.25 }}
                  contentStyle={{ borderRadius: 'var(--radius-card)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-card)', boxShadow: 'var(--shadow-elegant)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-primary)' }}
                  labelStyle={{ color: 'var(--text-muted)' }}
                />
                <Bar dataKey="income" name="Доход" fill="var(--color-income)" radius={[4, 4, 0, 0]} barSize={12} />
                <Bar dataKey="expense" name="Расход" fill="var(--color-expense)" radius={[4, 4, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-2 mt-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--color-income)' }} />
              <span className="text-[10px] font-bold text-theme-muted uppercase tracking-widest">Доход</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--color-expense)' }} />
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
                  contentStyle={{ borderRadius: 'var(--radius-card)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-card)', boxShadow: 'var(--shadow-elegant)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-primary)' }}
                  labelStyle={{ color: 'var(--text-muted)' }}
                  formatter={(value: number) => [`${value.toLocaleString()} ₽`, 'Баланс']}
                />
                <Line type="monotone" dataKey="balance" stroke="var(--color-action)" strokeWidth={3} dot={{ r: 4, fill: 'var(--color-action)' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-theme-surface p-2 rounded-3xl border border-theme-base shadow-sm" data-testid="plan-forecast-chart">
          <div className="flex items-start justify-between gap-2 mb-4">
            <div className="min-w-0">
              <h3 className="font-bold text-lg text-theme-main">Прогноз по планам</h3>
              <p className="text-[10px] font-bold text-theme-muted uppercase tracking-widest">
                На {PLAN_FORECAST_MONTHS} месяца от текущего баланса
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] font-bold text-theme-muted uppercase tracking-widest">
                К {format(parseDateKey(planForecast.points.at(-1)?.date || format(new Date(), 'yyyy-MM-dd')), 'd MMM', { locale: ru })}
              </p>
              <p className={cn("text-lg font-bold", planForecast.endBalance < 0 ? "text-rose-500" : "text-theme-main")} data-testid="plan-forecast-end">
                {formatRub(planForecast.endBalance)}
              </p>
            </div>
          </div>
          <div className="h-64 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={planForecast.points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="planForecastFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-action)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--color-action)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                  tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 600 }}
                  tickFormatter={(value: string) => format(parseDateKey(value), 'd MMM', { locale: ru })}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  domain={['auto', 'auto']}
                />
                {planForecast.minBalance < 0 && (
                  <ReferenceLine y={0} stroke="var(--color-expense)" strokeDasharray="4 4" />
                )}
                <Tooltip
                  cursor={{ stroke: 'var(--border-subtle)' }}
                  content={<PlanForecastTooltip />}
                />
                <Area
                  type="stepAfter"
                  dataKey="balance"
                  stroke="var(--color-action)"
                  strokeWidth={3}
                  fill="url(#planForecastFill)"
                  dot={false}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
            {(plansError || (plannedPayments !== null && planForecast.income === 0 && planForecast.expense === 0)) && (
              <div className="absolute inset-0 flex items-center justify-center text-theme-muted text-sm font-medium italic pointer-events-none">
                {plansError ? 'Не удалось загрузить планы' : 'Нет планов на ближайшие 2 месяца'}
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1 mt-3 text-center">
            <div>
              <p className="text-[10px] font-bold text-theme-muted uppercase tracking-widest">Доходы</p>
              <p className="text-sm font-bold text-emerald-500">{formatSignedAmount(planForecast.income)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-theme-muted uppercase tracking-widest">Расходы</p>
              <p className="text-sm font-bold text-rose-500">{formatSignedAmount(-planForecast.expense)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-theme-muted uppercase tracking-widest">Минимум</p>
              <p className={cn("text-sm font-bold", planForecast.minBalance < 0 ? "text-rose-500" : "text-theme-main")} data-testid="plan-forecast-min">
                {formatRub(planForecast.minBalance)}
              </p>
              <p className="text-[10px] text-theme-muted">{format(parseDateKey(planForecast.minDate), 'd MMM', { locale: ru })}</p>
            </div>
          </div>
        </section>

        {/* Bottom Bar Spacer */}
        <div className="h-10 lg:hidden shrink-0" />

      </div>
    </div>
  );
}

const rubFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

function formatRub(value: number) {
  const rounded = Math.round(value);
  return `${rounded < 0 ? '−' : ''}${rubFormatter.format(Math.abs(rounded))} ₽`;
}

function PlanForecastTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: PlanForecastPoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const shown = point.operations.slice(0, 5);
  return (
    <div
      className="max-w-[240px]"
      style={{ borderRadius: 'var(--radius-card)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-card)', boxShadow: 'var(--shadow-elegant)', padding: '8px 10px' }}
    >
      <p className="text-[11px] text-theme-muted">
        {point.isStart ? 'Сейчас' : format(parseDateKey(point.date), 'd MMMM, EEEEEE', { locale: ru })}
      </p>
      <p className="text-sm font-bold text-theme-main">{formatRub(point.balance)}</p>
      {shown.map((operation, index) => (
        <div key={index} className="flex justify-between gap-2 text-[11px] mt-0.5">
          <span className="truncate text-theme-main">{operation.title}</span>
          <span className={cn("font-bold shrink-0", operation.delta > 0 ? "text-emerald-500" : operation.delta < 0 ? "text-rose-500" : "text-theme-muted")}>
            {formatSignedAmount(operation.delta)}
          </span>
        </div>
      ))}
      {point.operations.length > shown.length && (
        <p className="text-[10px] text-theme-muted mt-0.5">и ещё {point.operations.length - shown.length}</p>
      )}
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
