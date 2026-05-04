import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calculator as CalcIcon, Delete, Check, X, Minus, Plus, Divide, X as Multiply } from 'lucide-react';
import { cn } from '../lib/utils';

interface CalculatorProps {
  initialValue: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export default function Calculator({ initialValue, onConfirm, onCancel }: CalculatorProps) {
  const [display, setDisplay] = useState(initialValue || '0');
  const [expression, setExpression] = useState('');
  const [shouldReset, setShouldReset] = useState(false);

  const handleNumber = (num: string) => {
    if (display === '0' || shouldReset) {
      setDisplay(num);
      setShouldReset(false);
    } else {
      setDisplay(display + num);
    }
  };

  const handleOperator = (op: string) => {
    setExpression(display + ' ' + op + ' ');
    setShouldReset(true);
  };

  const calculate = () => {
    if (!expression) return;
    try {
      const fullExpression = expression + display;
      // Basic math parsing without eval for safety
      const parts = fullExpression.split(' ');
      let result = parseFloat(parts[0]);
      
      for (let i = 1; i < parts.length; i += 2) {
        const operator = parts[i];
        const nextValue = parseFloat(parts[i + 1]);
        if (operator === '+') result += nextValue;
        if (operator === '-') result -= nextValue;
        if (operator === '*') result *= nextValue;
        if (operator === '/') result /= nextValue;
      }
      
      const finalResult = Math.round(result);
      setDisplay(finalResult.toString());
      setExpression('');
      setShouldReset(true);
      return finalResult;
    } catch (e) {
      setDisplay('Error');
    }
  };

  const handleBackspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setExpression('');
  };

  const handleConfirm = () => {
    // If there's an active expression, calculate first
    let finalValue = display;
    if (expression) {
      const result = calculate();
      if (result !== undefined) finalValue = result.toString();
    }
    onConfirm(finalValue);
  };

  const buttons = [
    { label: 'AC', action: handleClear, className: 'text-rose-500 font-bold' },
    { label: <Delete size={18} />, action: handleBackspace, className: 'text-neutral-400' },
    { label: '/', action: () => handleOperator('/'), className: 'text-blue-500 font-bold bg-blue-50' },
    { label: '*', action: () => handleOperator('*'), className: 'text-blue-500 font-bold bg-blue-50' },
    
    { label: '7', action: () => handleNumber('7') },
    { label: '8', action: () => handleNumber('8') },
    { label: '9', action: () => handleNumber('9') },
    { label: '-', action: () => handleOperator('-'), className: 'text-blue-500 font-bold bg-blue-50' },
    
    { label: '4', action: () => handleNumber('4') },
    { label: '5', action: () => handleNumber('5') },
    { label: '6', action: () => handleNumber('6') },
    { label: '+', action: () => handleOperator('+'), className: 'text-blue-500 font-bold bg-blue-50' },
    
    { label: '1', action: () => handleNumber('1') },
    { label: '2', action: () => handleNumber('2') },
    { label: '3', action: () => handleNumber('3') },
    { label: '=', action: calculate, className: 'bg-theme-primary text-theme-on-primary font-bold row-span-2' },
    
    { label: '0', action: () => handleNumber('0') },
    { label: '00', action: () => handleNumber('00') },
    { label: '000', action: () => handleNumber('000') },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white rounded-3xl p-4 shadow-2xl border border-neutral-100 w-[280px]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-4">
        <div className="text-[10px] text-neutral-400 h-4 text-right pr-1 font-mono">
          {expression}
        </div>
        <div className="text-2xl font-bold font-mono text-right p-3 bg-neutral-50 rounded-2xl border border-neutral-100 overflow-hidden text-ellipsis">
          {display}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {buttons.map((btn, i) => (
          <button
            key={i}
            onClick={btn.action}
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
