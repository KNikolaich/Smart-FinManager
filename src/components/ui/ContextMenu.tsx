import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Copy } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onAction: (action: 'create' | 'copy') => void;
}

export function ContextMenu({ x, y, onClose, onAction }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleScroll = () => onClose();

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  // Adjust position if menu goes off screen
  const menuWidth = 160;
  const menuHeight = 90;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);

  return (
    <div 
      className="fixed inset-0 z-[200] overflow-hidden pointer-events-none"
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        style={{ top: adjustedY, left: adjustedX }}
        className="absolute pointer-events-auto bg-theme-surface border border-theme-base rounded-xl shadow-xl py-1.5 min-w-[160px] backdrop-blur-md"
      >
        <button
          onClick={() => {
            onAction('create');
            onClose();
          }}
          className="w-full px-4 py-2 text-left hover:bg-theme-main transition-colors flex items-center gap-3"
        >
          <Plus size={16} className="text-theme-primary" />
          <span className="text-sm font-bold text-theme-main">Создать</span>
        </button>
        <button
          onClick={() => {
            onAction('copy');
            onClose();
          }}
          className="w-full px-4 py-2 text-left hover:bg-theme-main transition-colors flex items-center gap-3 border-t border-theme-base/50"
        >
          <Copy size={16} className="text-theme-primary" />
          <span className="text-sm font-bold text-theme-main">Копировать</span>
        </button>
      </motion.div>
    </div>
  );
}
