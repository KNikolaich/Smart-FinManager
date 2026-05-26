import { useState, useMemo, useEffect } from 'react';
import { PlanData } from '../types';
import { BarChart, Bar, ResponsiveContainer, Tooltip } from 'recharts';
import { Save, Info, Sparkles, Check, HelpCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface CreditTabProps {
  planData: PlanData;
  onSave: (newData: PlanData) => void;
}

export default function CreditTab({ planData, onSave }: CreditTabProps) {
  // Read saved data or use defaults
  const savedAmount = (planData as any).credit?.amount !== undefined ? (planData as any).credit.amount : 1000000;
  const savedRate = (planData as any).credit?.rate !== undefined ? (planData as any).credit.rate : 12;
  const savedTerm = (planData as any).credit?.term !== undefined ? (planData as any).credit.term : 24;

  const [amount, setAmount] = useState<number>(savedAmount);
  const [rate, setRate] = useState<number>(savedRate);
  const [term, setTerm] = useState<number>(savedTerm);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  // Sync state if backend data updates
  useEffect(() => {
    const freshAmount = (planData as any).credit?.amount;
    const freshRate = (planData as any).credit?.rate;
    const freshTerm = (planData as any).credit?.term;

    if (freshAmount !== undefined) setAmount(freshAmount);
    if (freshRate !== undefined) setRate(freshRate);
    if (freshTerm !== undefined) setTerm(freshTerm);
  }, [planData]);

  // Handle saving to database
  const handleSave = async () => {
    setIsSaving(true);
    const updatedPlan: PlanData = {
      ...planData,
      credit: {
        amount,
        rate,
        term
      }
    } as any;
    
    try {
      await onSave(updatedPlan);
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 2000);
    } catch (err) {
      console.error("Failed to save credit settings:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Annuity Monthly Payment Calculation
  const monthlyPaymentObj = useMemo(() => {
    const P = amount;
    const annualRate = rate;
    const N = term;

    if (N <= 0) return { payment: 0, overpayment: 0, totalPayout: 0 };

    const r = (annualRate / 12) / 100;

    let payment = 0;
    if (annualRate === 0) {
      payment = P / N;
    } else {
      payment = P * (r * Math.pow(1 + r, N)) / (Math.pow(1 + r, N) - 1);
    }

    const totalPayout = payment * N;
    const overpayment = Math.max(0, totalPayout - P);

    return {
      payment,
      overpayment,
      totalPayout
    };
  }, [amount, rate, term]);

  const { payment: monthlyPayment, overpayment, totalPayout } = monthlyPaymentObj;

  // Generate complete amortization schedule and charts data
  const { schedule, chartData } = useMemo(() => {
    const items = [];
    const chartItems = [];
    let remainingPrincipal = amount;
    const r = (rate / 12) / 100;

    for (let month = 1; month <= term; month++) {
      let interestPayment = r > 0 ? remainingPrincipal * r : 0;
      let principalPayment = monthlyPayment - interestPayment;

      // Handle precision on last payment
      if (month === term || remainingPrincipal < principalPayment) {
        principalPayment = remainingPrincipal;
        interestPayment = Math.max(0, monthlyPayment - principalPayment);
        remainingPrincipal = 0;
      } else {
        remainingPrincipal = Math.max(0, remainingPrincipal - principalPayment);
      }

      items.push({
        month,
        payment: principalPayment + interestPayment,
        principal: principalPayment,
        interest: interestPayment,
        remaining: remainingPrincipal,
      });

      chartItems.push({
        name: `M ${month}`,
        monthNum: month,
        principal: Math.round(principalPayment),
        interest: Math.round(interestPayment),
        payment: Math.round(principalPayment + interestPayment),
        remaining: Math.round(remainingPrincipal),
      });
    }

    return {
      schedule: items,
      chartData: chartItems,
    };
  }, [amount, rate, term, monthlyPayment]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#0f1d15] border border-[#234231] p-3 rounded-2xl shadow-xl text-xs text-white space-y-1.5 font-sans min-w-[150px]">
          <p className="font-bold border-b border-[#234231] pb-1 mb-1 text-emerald-400">Месяц {data.monthNum}</p>
          <div className="flex justify-between gap-4">
            <span className="text-neutral-400">Платеж:</span>
            <span className="font-bold">{data.payment.toLocaleString()} ₽</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-sky-400 font-medium">Долг:</span>
            <span className="font-bold text-sky-400">{data.principal.toLocaleString()} ₽</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-amber-400 font-medium">Проценты:</span>
            <span className="font-bold text-amber-500">{data.interest.toLocaleString()} ₽</span>
          </div>
          <div className="flex justify-between gap-4 border-t border-[#234231] pt-1 mt-1">
            <span className="text-neutral-400">Остаток:</span>
            <span className="font-bold text-neutral-300">{data.remaining.toLocaleString()} ₽</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-neutral-50 overflow-y-auto no-scrollbar pb-10">
      {/* Parameter inputs header panel */}
      <div className="bg-white border-b border-neutral-100 p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-neutral-800 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-sky-500 shrink-0" />
              <span className="truncate">Кредитный калькулятор</span>
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5 max-w-[280px] sm:max-w-none truncate sm:normal-case">
              Моделирование планируемых кредитов с расчетом аннуитетного графика
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              "p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer shrink-0 border border-transparent",
              showSaveSuccess
                ? "bg-emerald-500 text-white shadow-md shadow-emerald-100"
                : "bg-neutral-900 text-white hover:bg-neutral-800 shadow-md shadow-neutral-100 disabled:opacity-50"
            )}
            title="Сохранить настройки кредита"
          >
            {showSaveSuccess ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Dynamic Inputs block in a single row if screen width allows */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-2">
          {/* Amount input */}
          <div className="space-y-1.5 flex flex-col justify-end">
            <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Сумма кредита</label>
            <div className="relative">
              <input
                type="number"
                value={amount === 0 ? '' : amount}
                onChange={(e) => setAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm text-neutral-800 font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-right pr-9"
                placeholder="1 000 000"
                min="0"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">₽</span>
            </div>
          </div>

          {/* Rate input */}
          <div className="space-y-1.5 flex flex-col justify-end">
            <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Процентная ставка</label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={rate === 0 ? '' : rate}
                onChange={(e) => setRate(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm text-neutral-800 font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-right pr-9"
                placeholder="12"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">%</span>
            </div>
          </div>

          {/* Term input */}
          <div className="space-y-1.5 flex flex-col justify-end">
            <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Срок кредита</label>
            <div className="relative">
              <input
                type="number"
                value={term === 0 ? '' : term}
                onChange={(e) => setTerm(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm text-neutral-800 font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-right pr-12"
                placeholder="24"
                min="1"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">мес</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Bento Grid layout for core metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-[22px] border border-neutral-100 shadow-sm flex flex-col justify-between">
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              Ежемесячный платеж
            </p>
            <div className="mt-4">
              <p className="text-2xl font-black text-neutral-800 tracking-tight">
                {Math.round(monthlyPayment).toLocaleString()} <span className="text-lg font-medium text-neutral-400">₽</span>
              </p>
              <p className="text-[10px] text-neutral-400 mt-1">Аннуитетная схема выравнивания платежей</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-[22px] border border-neutral-100 shadow-sm flex flex-col justify-between">
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              Сумма переплаты по процентам
            </p>
            <div className="mt-4">
              <p className="text-2xl font-black text-amber-600 tracking-tight">
                {Math.round(overpayment).toLocaleString()} <span className="text-lg font-medium text-amber-500/50">₽</span>
              </p>
              <p className="text-[10px] text-neutral-400 mt-1">
                {amount > 0 ? `${Math.round((overpayment / amount) * 100)}% от изначального тела долга` : '0%'}
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-[22px] border border-neutral-100 shadow-sm flex flex-col justify-between">
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              Общая сумма выплат
            </p>
            <div className="mt-4">
              <p className="text-2xl font-black text-indigo-700 tracking-tight">
                {Math.round(totalPayout).toLocaleString()} <span className="text-lg font-medium text-indigo-400">₽</span>
              </p>
              <p className="text-[10px] text-neutral-400 mt-1">Тело ({amount.toLocaleString()} ₽) + Начисленные проценты</p>
            </div>
          </div>
        </div>

        {/* Stacked Payments Dynamics Chart matching the reference image perfectly */}
        <div className="bg-[#0b1712] text-white p-6 rounded-[28px] shadow-lg border border-[#1b3427]/40 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold tracking-wide font-sans text-neutral-100 uppercase py-0.5">
              Динамика платежей
            </h3>
            {/* Custom Legend closely styled after the screenshot */}
            <div className="flex items-center gap-5 text-[10px] font-black uppercase tracking-widest text-[#93b39d]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded bg-[#2563eb]" />
                долг
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded bg-[#caa325]" />
                проценты
              </div>
            </div>
          </div>

          {/* Core Stacked Bar Chart */}
          <div className="h-[220px] w-full mt-2">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  barCategoryGap={1}
                  margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
                >
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                  {/* Stacked bars: principal first (bottom), interest second (top) */}
                  <Bar dataKey="principal" stackId="dynamicPayments" fill="#2563eb" />
                  <Bar dataKey="interest" stackId="dynamicPayments" fill="#caa325" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-neutral-400 italic">
                Введите корректные параметры для отрисовки графиков
              </div>
            )}
          </div>
        </div>

        {/* Detailed amortization table */}
        <div className="bg-white rounded-[28px] border border-neutral-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-neutral-800">Детализированный график амортизации</h3>
            </div>
            <div className="px-3 py-1 bg-neutral-100 rounded-full text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
              Срок: {term} мес
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50/70 border-b border-neutral-100 text-[10px] font-black uppercase tracking-wider text-neutral-400 select-none">
                  <th className="py-3.5 px-6">№</th>
                  <th className="py-3.5 px-6 text-right">Сумма платежа</th>
                  <th className="py-3.5 px-6 text-right text-sky-600">Тело кредита</th>
                  <th className="py-3.5 px-6 text-right text-amber-600">Проценты</th>
                  <th className="py-3.5 px-6 text-right">Остаток долга</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((item) => (
                  <tr key={item.month} className="border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors">
                    <td className="py-3 px-6 font-bold text-neutral-700">
                      {item.month}
                    </td>
                    <td className="py-3 px-6 text-right font-medium text-neutral-800">
                      {Math.round(item.payment || 0).toLocaleString()} ₽
                    </td>
                    <td className="py-3 px-6 text-right font-bold text-sky-600/90">
                      {Math.round(item.principal || 0).toLocaleString()} ₽
                    </td>
                    <td className="py-3 px-6 text-right font-medium text-amber-600">
                      {Math.round(item.interest || 0).toLocaleString()} ₽
                    </td>
                    <td className="py-3 px-6 text-right font-mono text-neutral-400 font-medium">
                      {Math.round(item.remaining || 0).toLocaleString()} ₽
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
