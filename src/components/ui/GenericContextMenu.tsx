import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { LucideIcon } from 'lucide-react';

export interface ContextMenuItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: 'default' | 'danger';
  divider?: boolean;
}

interface GenericContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function GenericContextMenu({ x, y, items, onClose }: GenericContextMenuProps) {
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
  const menuWidth = 200;
  const menuHeight = items.length * 40 + (items.filter(i => i.divider).length * 8);
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);

  return (
    <div 
      className="fixed inset-0 z-[999] overflow-hidden"
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        style={{ top: adjustedY, left: adjustedX }}
        className="absolute bg-theme-surface border border-theme-base rounded-xl shadow-2xl py-1.5 min-w-[200px] backdrop-blur-md z-[1000] overflow-hidden"
      >
        {items.map((item, index) => (
          <React.Fragment key={index}>
            {item.divider && <div className="h-px bg-theme-base/50 my-1.5 mx-2" />}
            <button
              onClick={(e) => {
                e.stopPropagation();
                item.onClick();
                onClose();
              }}
              className={cn(
                "w-full px-4 py-2.5 text-left hover:bg-theme-main transition-all flex items-center gap-3 active:scale-[0.98]",
                item.variant === 'danger' ? "text-rose-500" : "text-theme-main"
              )}
            >
              {item.icon && <item.icon size={16} className={cn(item.variant === 'danger' ? "text-rose-500" : "text-theme-primary")} />}
              <span className="text-sm font-bold">{item.label}</span>
            </button>
          </React.Fragment>
        ))}
      </motion.div>
    </div>
  );
}
