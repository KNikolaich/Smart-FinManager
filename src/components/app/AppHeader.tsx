import { motion } from 'motion/react';
import { Wallet } from 'lucide-react';
import { cn } from '../../lib/utils';
import { OfflineChip } from '../ui/OfflineChip';

interface AppHeaderProps {
  onLogoClick: () => void;
  isOnline: boolean;
  isHidden: boolean;
}

/** Tablet/desktop header; on phones the bottom nav carries profile and the header is hidden. */
export function AppHeader({ onLogoClick, isOnline, isHidden }: AppHeaderProps) {
  return (
    <header className={cn(
      "relative px-6 flex items-center justify-between bg-theme-surface/80 backdrop-blur-md border-b border-theme-base shrink-0 z-50 sticky top-0 transition-[height,opacity] duration-300 ease-out max-md:hidden",
      isHidden
        ? "h-0 overflow-hidden border-b-0 opacity-0 pointer-events-none"
        : "h-16 md:h-20 opacity-100"
    )} aria-hidden={isHidden} inert={isHidden} data-testid="app-header">
      <button
        type="button"
        aria-label="Открыть главную страницу"
        className="flex items-center gap-4 cursor-pointer group text-left rounded-xl"
        onClick={onLogoClick}
      >
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-11 h-11 bg-theme-primary rounded-xl flex items-center justify-center text-theme-on-primary shadow-lg shadow-theme-primary-light transition-all"
        >
          <Wallet size={20} />
        </motion.div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <h2 className="font-bold text-sm leading-none group-hover:text-theme-primary transition-colors text-theme-main">Finance</h2>
            <p className="text-[10px] text-theme-muted font-bold uppercase tracking-widest mt-0.5">Manager</p>
          </div>
        </div>
      </button>
      <div className="flex items-center gap-2">
        <OfflineChip isOnline={isOnline} variant="header" />
      </div>
    </header>
  );
}
