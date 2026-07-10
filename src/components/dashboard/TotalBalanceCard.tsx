import { motion, AnimatePresence } from 'motion/react';
import { subMonths } from 'date-fns';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { cn } from '../../lib/utils';

interface TotalBalanceCardProps {
  visible: boolean;
  totalBalance: number;
  monthlyRollingBalance: number;
  monthlyStats: { income: number; expense: number };
  balanceTrend: { name: string; month: string; balance: number }[];
  onNavigateToAnalytics?: (options?: any) => void;
  onOpenTransactionHistory?: (filterProps?: any) => void;
}

export function TotalBalanceCard({
  visible,
  totalBalance,
  monthlyRollingBalance,
  monthlyStats,
  balanceTrend,
  onNavigateToAnalytics,
  onOpenTransactionHistory
}: TotalBalanceCardProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0.3, marginBottom: 0 }}
          animate={{ height: 'auto', opacity: 0.7, marginBottom: 24 }}
          exit={{ height: 0, opacity: 0.3, marginBottom: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <div
            onClick={() => onNavigateToAnalytics?.({
              filterType: 'period',
              periodRange: { start: subMonths(new Date(), 1), end: new Date() }
            })}
            className="bg-theme-surface rounded-2xl p-2 text-theme-main border border-theme-base shadow-soft cursor-pointer group relative overflow-hidden"
          >
            <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6">
              {/* Left Side: Stats (Max Width 400px) */}
              <div className="w-full sm:max-w-[400px] flex-shrink-0">
                <div className="mb-0 grid grid-cols-2 gap-1 px-2">
                  <div className="pt-0 pb-0 pr-0 text-center">
                    <p className="text-theme-muted text-[10px] sm:text-xs font-bold uppercase tracking-wider">Общий баланс</p>
                    <h2 className="text-lg sm:text-xl font-bold">{totalBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })} ₽</h2>
                  </div>
                  <div className="text-center border-l border-theme-base pt-0 pb-0 pl-0">
                    <p className="text-theme-muted text-[10px] sm:text-xs font-bold uppercase tracking-wider pb-[2px]">За прошедший месяц</p>
                    <h2 className={cn(
                      "text-lg sm:text-xl font-bold pb-[5px]",
                      monthlyRollingBalance >= 0 ? "text-emerald-500" : "text-rose-500"
                    )}>
                      {monthlyRollingBalance > 0 ? "+" : ""}{monthlyRollingBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })} ₽
                    </h2>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pb-0">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTransactionHistory?.({ type: 'income' });
                    }}
                    className="mt-3 pt-[10px] pb-[10px] pl-[10px] bg-theme-main rounded-[12px] flex items-center gap-3 cursor-pointer hover:bg-theme-primary-light/30 transition-colors"
                  >
                    <div className="bg-theme-primary-light/50 p-[6px] rounded-[12px]">
                      <TrendingUp className="mr-0 pr-0 w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="leading-[12px] pb-0">
                      <p className="text-[10px] sm:text-xs pt-0 pb-[6px] px-[6px] rounded-0 font-bold uppercase text-emerald-500/80">Доход</p>
                      <p className="font-semibold pt-[2px] pb-[2px] px-[6px] text-theme-main">{monthlyStats.income.toLocaleString()} ₽</p>
                    </div>
                  </div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTransactionHistory?.({ type: 'expense' });
                    }}
                    className="mt-[12px] p-[10px] bg-theme-main rounded-[12px] flex items-center gap-3 cursor-pointer hover:bg-theme-primary-light/30 transition-colors"
                  >
                    <div className="bg-rose-500/10 p-[6px] rounded-[12px]">
                      <TrendingDown className="mr-0 pr-0 w-4 h-4 text-rose-500" />
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-xs pt-[2px] pb-[2px] font-bold uppercase text-rose-500/80">Расход</p>
                      <p className="font-semibold pt-0 text-theme-main">{monthlyStats.expense.toLocaleString()} ₽</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side: Dynamics Chart (Hidden on mobile) */}
              <div className="hidden sm:flex flex-1 items-center h-[100px] w-full min-w-0">
                <div className="flex-1 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={balanceTrend} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                        domain={['auto', 'auto']}
                      />
                      <Area
                        type="monotone"
                        dataKey="balance"
                        stroke="var(--primary)"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorBalance)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Hover effect overlay */}
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors pointer-events-none" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
