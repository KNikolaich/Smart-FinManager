import { motion } from 'motion/react';
import {
  LayoutDashboard,
  CalendarRange,
  Telescope,
  BarChart2,
  Settings as SettingsIcon,
  User as UserIcon,
} from 'lucide-react';
import { RobotIcon } from '../icons/RobotIcon';
import { cn } from '../../lib/utils';
import { OfflineChip } from '../ui/OfflineChip';
import { UserAvatar } from '../ui/UserAvatar';

type Tab = 'dashboard' | 'calendar' | 'plan' | 'analytics' | 'settings' | 'ai';

interface BottomNavProps {
  activeTab: Tab;
  onChangeTab: (tab: Tab) => void;
  onDashboardClick: () => void;
  showUserPage: boolean;
  onOpenUserPage: () => void;
  isOnline: boolean;
  photoURL?: string | null;
}

const navButtonClass = (active: boolean) => cn(
  "flex flex-col items-center justify-center gap-0.5 w-12 h-10 rounded-[18px] transition-all active:scale-95 md:w-auto md:min-w-16 md:h-12 md:px-3 md:rounded-2xl",
  active ? "text-theme-primary bg-theme-primary-light/50" : "text-theme-muted hover:text-theme-primary"
);

/** Caption under a nav icon: shown on tablet/desktop only, mobile stays icon-only. */
function NavLabel({ children }: { children: string }) {
  return (
    <span className="hidden md:block max-md:landscape:hidden text-[11px] font-semibold leading-none whitespace-nowrap">
      {children}
    </span>
  );
}

export function BottomNav({ activeTab, onChangeTab, onDashboardClick, showUserPage, onOpenUserPage, isOnline, photoURL }: BottomNavProps) {
  return (
    <nav aria-label="Основная навигация" className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-0 h-[54px] shrink-0 z-40 flex items-center justify-center md:relative md:bottom-0 md:left-auto md:translate-x-0 md:max-w-none md:h-[68px] md:bg-theme-surface md:border-t border-theme-base md:rounded-none max-md:landscape:relative max-md:landscape:bottom-0 max-md:landscape:left-auto max-md:landscape:translate-x-0 max-md:landscape:w-20 max-md:landscape:h-full max-md:landscape:px-0 max-md:landscape:bg-theme-surface max-md:landscape:border-r max-md:landscape:border-t-0">
      <div className="w-full bg-theme-surface/90 backdrop-blur-xl border border-theme-base shadow-elegant rounded-[18px] flex items-center justify-around h-full px-1 md:justify-center md:gap-4 md:bg-transparent md:backdrop-blur-none md:border-none md:shadow-none md:rounded-none max-md:landscape:flex-col max-md:landscape:justify-around max-md:landscape:gap-0 max-md:landscape:py-4 max-md:landscape:bg-transparent max-md:landscape:backdrop-blur-none">

        {/* Offline indicator - only shown in the mobile landscape sidebar */}
        <div className="hidden max-md:landscape:flex items-center justify-center">
          <OfflineChip isOnline={isOnline} variant="sidebar" />
        </div>
        <button
          onClick={onDashboardClick}
          aria-label="Дашборд"
          aria-current={activeTab === 'dashboard' ? 'page' : undefined}
          className={navButtonClass(activeTab === 'dashboard')}
        >
          <LayoutDashboard size={20} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
          <NavLabel>Дашборд</NavLabel>
        </button>
        <button
          onClick={() => onChangeTab('calendar')}
          aria-label="Календарь"
          aria-current={activeTab === 'calendar' ? 'page' : undefined}
          className={navButtonClass(activeTab === 'calendar')}
        >
          <CalendarRange size={20} strokeWidth={activeTab === 'calendar' ? 2.5 : 2} />
          <NavLabel>Календарь</NavLabel>
        </button>
        <button
          onClick={() => onChangeTab('plan')}
          aria-label="Прогнозы"
          aria-current={activeTab === 'plan' ? 'page' : undefined}
          className={navButtonClass(activeTab === 'plan')}
        >
          <Telescope size={20} strokeWidth={activeTab === 'plan' ? 2.5 : 2} />
          <NavLabel>Прогнозы</NavLabel>
        </button>

        {/* AI Assistant Button */}
        <div className={cn(
          "relative w-14 h-14 flex flex-col items-center justify-center -top-4 md:top-0 md:w-auto md:min-w-16 md:h-12 md:px-3 md:gap-0.5 md:rounded-2xl max-md:landscape:top-0 max-md:landscape:relative",
          activeTab === 'ai' && "md:bg-theme-primary-light/50"
        )}>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onChangeTab('ai')}
            aria-label="AI-помощник"
            aria-current={activeTab === 'ai' ? 'page' : undefined}
            className={cn(
              "w-14 h-14 md:w-6 md:h-5 rounded-full flex items-center justify-center shadow-lg transition-all z-50 md:shadow-none md:border-0 md:bg-transparent",
              activeTab === 'ai'
                ? "bg-theme-primary-light text-theme-primary shadow-theme-primary-light"
                : "bg-theme-surface border border-theme-base text-theme-primary shadow-soft"
            )}
          >
            <RobotIcon className="w-11 h-11 md:w-6 md:h-6 md:shrink-0" active={activeTab === 'ai'} />
          </motion.button>
          <span className={cn(
            "hidden md:block max-md:landscape:hidden text-[11px] font-semibold leading-none whitespace-nowrap",
            activeTab === 'ai' ? "text-theme-primary" : "text-theme-muted"
          )}>
            Помощник
          </span>
        </div>

        <button
          onClick={() => onChangeTab('analytics')}
          aria-label="Аналитика"
          aria-current={activeTab === 'analytics' ? 'page' : undefined}
          className={navButtonClass(activeTab === 'analytics')}
        >
          <BarChart2 size={20} strokeWidth={activeTab === 'analytics' ? 2.5 : 2} />
          <NavLabel>Аналитика</NavLabel>
        </button>
        <button
          onClick={() => onChangeTab('settings')}
          aria-label="Настройки"
          aria-current={activeTab === 'settings' ? 'page' : undefined}
          className={navButtonClass(activeTab === 'settings')}
        >
          <SettingsIcon size={20} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
          <NavLabel>Настройки</NavLabel>
        </button>
        <button
          onClick={onOpenUserPage}
          aria-label="Открыть профиль"
          className={navButtonClass(showUserPage)}
        >
          {photoURL ? (
            <UserAvatar
              photoURL={photoURL}
              className={cn('w-6 h-6 rounded-lg bg-theme-primary-light max-md:landscape:w-8 max-md:landscape:h-8 max-md:landscape:rounded-xl', showUserPage && 'ring-2 ring-theme-primary')}
              contentClassName="text-base"
            />
          ) : (
            <UserIcon size={20} strokeWidth={showUserPage ? 2.5 : 2} />
          )}
          <NavLabel>Профиль</NavLabel>
        </button>
      </div>
    </nav>
  );
}
