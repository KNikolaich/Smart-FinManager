import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Delete, Check, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface CalculatorProps {
  initialValue: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

type Operator = '+' | '-' | '*' | '/';

function applyOperation(left: number, right: number, operator: Operator) {
  if (operator === '/' && right === 0) throw new Error('Division by zero');

  const result = {
    '+': left + right,
    '-': left - right,
    '*': left * right,
    '/': left / right,
  }[operator];

  // Keep decimal results while hiding floating-point artifacts such as
  // 0.1 + 0.2 = 0.30000000000000004.
  return Number(result.toFixed(10));
}

export default function Calculator({ initialValue, onConfirm, onCancel }: CalculatorProps) {
  const normalizedInitialValue = initialValue.replace(',', '.');
  const [display, setDisplay] = useState(
    normalizedInitialValue && Number.isFinite(Number(normalizedInitialValue))
      ? normalizedInitialValue
      : '0'
  );
  const [expression, setExpression] = useState('');
  const [shouldReset, setShouldReset] = useState(false);
  const [accumulator, setAccumulator] = useState<number | null>(null);
  const [pendingOperator, setPendingOperator] = useState<Operator | null>(null);

  const handleNumber = useCallback((num: string) => {
    if (display === '0' || display === 'Error' || shouldReset) {
      setDisplay(num);
      setShouldReset(false);
    } else {
      setDisplay(display + num);
    }
  }, [display, shouldReset]);

  const handleDecimal = useCallback(() => {
    if (display === 'Error' || shouldReset) {
      setDisplay('0.');
      setShouldReset(false);
      return;
    }

    if (!display.includes('.')) {
      setDisplay(`${display}.`);
    }
  }, [display, shouldReset]);

  const handleOperator = useCallback((op: Operator) => {
    if (display === 'Error') return;

    const currentValue = Number(display);
    if (!Number.isFinite(currentValue)) return;

    let nextAccumulator = currentValue;

    if (accumulator !== null && pendingOperator) {
      // Pressing another operator evaluates the pending operation immediately,
      // just like a desktop calculator. Repeated operators only replace the
      // pending operator instead of applying the displayed value twice.
      if (!shouldReset) {
        try {
          nextAccumulator = applyOperation(accumulator, currentValue, pendingOperator);
          setDisplay(nextAccumulator.toString());
        } catch {
          setDisplay('Error');
          setExpression('');
          setAccumulator(null);
          setPendingOperator(null);
          setShouldReset(true);
          return;
        }
      } else {
        nextAccumulator = accumulator;
      }
    }

    setAccumulator(nextAccumulator);
    setPendingOperator(op);
    setExpression(`${nextAccumulator} ${op} `);
    setShouldReset(true);
  }, [accumulator, display, pendingOperator, shouldReset]);

  const calculate = useCallback(() => {
    if (accumulator === null || !pendingOperator || shouldReset) return;

    try {
      const currentValue = Number(display);
      if (!Number.isFinite(currentValue)) throw new Error('Invalid operand');

      const finalResult = applyOperation(accumulator, currentValue, pendingOperator);
      setDisplay(finalResult.toString());
      setExpression('');
      setAccumulator(null);
      setPendingOperator(null);
      setShouldReset(true);
      return finalResult;
    } catch {
      setDisplay('Error');
      setExpression('');
      setAccumulator(null);
      setPendingOperator(null);
      setShouldReset(true);
    }
  }, [accumulator, display, pendingOperator, shouldReset]);

  const handleBackspace = useCallback(() => {
    if (display === 'Error' || shouldReset) {
      setDisplay('0');
      setShouldReset(false);
      return;
    }

    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  }, [display, shouldReset]);

  const handleClear = useCallback(() => {
    setDisplay('0');
    setExpression('');
    setAccumulator(null);
    setPendingOperator(null);
    setShouldReset(false);
  }, []);

  const handleConfirm = useCallback(() => {
    // If there's an active expression, calculate first
    let finalValue = display;
    if (pendingOperator && !shouldReset) {
      const result = calculate();
      if (result !== undefined) finalValue = result.toString();
    }
    if (finalValue !== 'Error') onConfirm(finalValue);
  }, [calculate, display, onConfirm, pendingOperator, shouldReset]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        handleNumber(event.key);
      } else if (event.key === '.' || event.key === ',') {
        event.preventDefault();
        handleDecimal();
      } else if (['+', '-', '*', '/'].includes(event.key)) {
        event.preventDefault();
        handleOperator(event.key as Operator);
      } else if (event.key === 'Enter' || event.key === '=') {
        event.preventDefault();
        calculate();
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        handleBackspace();
      } else if (event.key === 'Delete') {
        event.preventDefault();
        handleClear();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [calculate, handleBackspace, handleClear, handleDecimal, handleNumber, handleOperator, onCancel]);

  const buttons = [
    { label: 'AC', action: handleClear, className: 'text-rose-500 font-bold', ariaLabel: 'Очистить' },
    { label: <Delete size={18} />, action: handleBackspace, className: 'text-neutral-400', ariaLabel: 'Удалить последний знак' },
    { label: '/', action: () => handleOperator('/'), className: 'text-blue-500 font-bold bg-blue-50', ariaLabel: 'Разделить' },
    { label: '*', action: () => handleOperator('*'), className: 'text-blue-500 font-bold bg-blue-50', ariaLabel: 'Умножить' },
    
    { label: '7', action: () => handleNumber('7') },
    { label: '8', action: () => handleNumber('8') },
    { label: '9', action: () => handleNumber('9') },
    { label: '-', action: () => handleOperator('-'), className: 'text-blue-500 font-bold bg-blue-50', ariaLabel: 'Вычесть' },
    
    { label: '4', action: () => handleNumber('4') },
    { label: '5', action: () => handleNumber('5') },
    { label: '6', action: () => handleNumber('6') },
    { label: '+', action: () => handleOperator('+'), className: 'text-blue-500 font-bold bg-blue-50', ariaLabel: 'Сложить' },
    
    { label: '1', action: () => handleNumber('1') },
    { label: '2', action: () => handleNumber('2') },
    { label: '3', action: () => handleNumber('3') },
    { label: '=', action: calculate, className: 'bg-theme-primary text-theme-on-primary font-bold row-span-2', ariaLabel: 'Вычислить' },
    
    { label: '0', action: () => handleNumber('0') },
    { label: '00', action: () => handleNumber('00') },
    { label: '.', action: handleDecimal, className: 'bg-theme-primary-light text-theme-primary-dark font-black text-lg', ariaLabel: 'Десятичная точка' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white rounded-3xl p-4 shadow-2xl border border-neutral-100 w-[300px]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-4">
        <div className="text-[10px] text-neutral-400 h-4 text-right pr-1 font-mono">
          {expression}
        </div>
        <div data-testid="calculator-display" className="text-2xl font-bold font-mono text-right p-3 bg-neutral-50 rounded-2xl border border-neutral-100 overflow-hidden text-ellipsis">
          {display}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {buttons.map((btn, i) => (
          <button
            key={i}
            onClick={btn.action}
            aria-label={btn.ariaLabel}
            className={cn(
              "h-12 rounded-xl flex items-center justify-center text-sm transition-all active:scale-95",
              btn.className || "bg-neutral-50 text-neutral-600 hover:bg-neutral-100"
            )}
          >
            {btn.label}
          </button>
        ))}
        
        <button
          onClick={onCancel}
          aria-label="Закрыть калькулятор"
          className="col-span-1 h-12 rounded-xl bg-neutral-100 text-neutral-500 font-bold flex items-center justify-center transition-all active:scale-95"
        >
          <X size={18} />
        </button>
        <button
          onClick={handleConfirm}
          className="col-span-3 h-12 rounded-xl bg-theme-primary text-theme-on-primary font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-theme-primary-light"
        >
          <Check size={18} />
          OK
        </button>
      </div>
    </motion.div>
  );
}
