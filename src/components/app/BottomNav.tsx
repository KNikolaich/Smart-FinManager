import { motion } from 'motion/react';
import {
  LayoutDashboard,
  CalendarRange,
  BarChart2,
  Settings as SettingsIcon,
  User as UserIcon,
  Wallet
} from 'lucide-react';
import { RobotIcon } from '../icons/RobotIcon';
import { cn } from '../../lib/utils';

type Tab = 'dashboard' | 'plan' | 'analytics' | 'settings' | 'ai';

interface BottomNavProps {
  activeTab: Tab;
  onChangeTab: (tab: Tab) => void;
  onWalletClick: () => void;
  showUserPage: boolean;
  onOpenUserPage: () => void;
}

export function BottomNav({ activeTab, onChangeTab, onWalletClick, showUserPage, onOpenUserPage }: BottomNavProps) {
  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-sm px-6 pb-0 h-[54px] shrink-0 z-40 flex items-center justify-center md:relative md:bottom-0 md:left-auto md:translate-x-0 md:max-w-none md:bg-theme-surface md:border-t border-theme-base md:rounded-none landscape:relative landscape:bottom-0 landscape:left-auto landscape:translate-x-0 landscape:w-20 landscape:h-full landscape:px-0 landscape:bg-theme-surface landscape:border-r landscape:border-t-0">
      <div className="w-full bg-theme-surface/90 backdrop-blur-xl border border-theme-base shadow-elegant rounded-3xl flex items-center justify-around h-full px-2 md:bg-transparent md:backdrop-blur-none md:border-none md:shadow-none md:rounded-none landscape:flex-col landscape:py-4 landscape:bg-transparent landscape:backdrop-blur-none">
        {/* Wallet button - only shown in landscape, where the header is hidden */}
        <button
          onClick={onWalletClick}
          className="hidden landscape:flex flex-col items-center justify-center w-12 h-10 rounded-[18px] transition-all active:scale-95 text-theme-muted hover:text-theme-primary"
        >
          <Wallet size={20} />
        </button>
        <button
          onClick={() => onChangeTab('dashboard')}
          className={cn(
            "flex flex-col items-center justify-center w-12 h-10 rounded-[18px] transition-all active:scale-95",
            activeTab === 'dashboard' ? "text-theme-primary bg-theme-primary-light/50" : "text-theme-muted hover:text-theme-primary"
          )}
        >
          <LayoutDashboard size={20} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
        </button>
        <button
          onClick={() => onChangeTab('plan')}
          className={cn(
            "flex flex-col items-center justify-center w-12 h-10 rounded-[18px] transition-all active:scale-95",
            activeTab === 'plan' ? "text-theme-primary bg-theme-primary-light/50" : "text-theme-muted hover:text-theme-primary"
          )}
        >
          <CalendarRange size={20} strokeWidth={activeTab === 'plan' ? 2.5 : 2} />
        </button>

        {/* AI Assistant Button */}
        <div className="relative w-14 h-14 flex items-center justify-center -top-4 md:top-0 md:relative landscape:top-0 landscape:relative">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onChangeTab('ai')}
            className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all z-50",
              activeTab === 'ai'
                ? "bg-theme-primary-light text-theme-primary shadow-theme-primary-light"
                : "bg-theme-surface border border-theme-base text-theme-primary shadow-soft"
            )}
          >
            <RobotIcon className="w-11 h-11" active={activeTab === 'ai'} />
          </motion.button>
        </div>

        <button
          onClick={() => onChangeTab('analytics')}
          className={cn(
            "flex flex-col items-center justify-center w-12 h-10 rounded-[18px] transition-all active:scale-95",
            activeTab === 'analytics' ? "text-theme-primary bg-theme-primary-light/50" : "text-theme-muted hover:text-theme-primary"
          )}
        >
          <BarChart2 size={20} strokeWidth={activeTab === 'analytics' ? 2.5 : 2} />
        </button>
        <button
          onClick={() => onChangeTab('settings')}
          className={cn(
            "flex flex-col items-center justify-center w-12 h-10 rounded-[18px] transition-all active:scale-95",
            activeTab === 'settings' ? "text-theme-primary bg-theme-primary-light/50" : "text-theme-muted hover:text-theme-primary"
          )}
        >
          <SettingsIcon size={20} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
        </button>

        {/* Profile button - only shown in landscape, where the header is hidden */}
        <button
          onClick={onOpenUserPage}
          className={cn(
            "hidden landscape:flex flex-col items-center justify-center w-12 h-10 rounded-[18px] transition-all active:scale-95",
            showUserPage ? "text-theme-primary bg-theme-primary-light/50" : "text-theme-muted hover:text-theme-primary"
          )}
        >
          <UserIcon size={20} strokeWidth={showUserPage ? 2.5 : 2} />
        </button>
      </div>
    </nav>
  );
}
