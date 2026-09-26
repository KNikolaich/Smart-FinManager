import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 w-full max-w-xs px-4 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </AnimatePresence>
    </div>
  );
};

const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, 3000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-finance-income" />,
    error: <AlertCircle className="w-4 h-4 text-finance-expense" />,
    info: <Info className="w-4 h-4 text-finance-transfer" />
  };

  const accentColors = {
    success: 'var(--color-income)',
    error: 'var(--color-expense)',
    info: 'var(--color-transfer)'
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className={cn(
        "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border border-l-4 border-theme-base bg-theme-surface/95 text-theme-main shadow-elegant backdrop-blur-md w-full"
      )}
      style={{ borderLeftColor: accentColors[toast.type] }}
    >
      <div className="flex-shrink-0">{icons[toast.type]}</div>
      <p className="text-sm font-medium text-theme-main flex-grow leading-tight">
        {toast.message}
      </p>
      <button 
        type="button"
        aria-label="Закрыть уведомление"
        onClick={() => onRemove(toast.id)}
        className="text-theme-muted hover:text-theme-main transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};
