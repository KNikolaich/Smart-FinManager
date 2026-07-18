import { motion } from 'motion/react';
import { User as UserIcon, Wallet } from 'lucide-react';
import { cn } from '../../lib/utils';
import { OfflineChip } from '../ui/OfflineChip';

interface AppHeaderProps {
  activeTab: string;
  onLogoClick: () => void;
  isOnline: boolean;
  showUserPage: boolean;
  onOpenUserPage: () => void;
}

export function AppHeader({ activeTab, onLogoClick, isOnline, showUserPage, onOpenUserPage }: AppHeaderProps) {
  return (
    <header className="relative px-6 h-16 md:h-20 flex items-center justify-between bg-theme-surface/80 backdrop-blur-md border-b border-theme-base shrink-0 z-50 sticky top-0 transition-all landscape:hidden">
      <div
        className="flex items-center gap-4 cursor-pointer group"
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
      </div>
      <div className="flex items-center gap-2">
        <OfflineChip isOnline={isOnline} variant="header" />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onOpenUserPage}
          className={cn(
            "w-10 h-10 md:w-11 md:h-11 rounded-xl overflow-hidden border border-theme-base shadow-sm flex items-center justify-center transition-all",
            showUserPage ? "bg-theme-primary text-theme-on-primary shadow-lg shadow-theme-primary-light" : "bg-theme-primary-light text-theme-primary-dark"
          )}
        >
          <UserIcon className="w-6 h-6" />
        </motion.button>
      </div>
    </header>
  );
}
