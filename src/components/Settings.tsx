import { LogOut, User as UserIcon, Database, Shield, Github, Info, Sparkles, CheckCircle2, Eraser, Trash2, AlertTriangle, Tag, FileDown, FileUp, X, ArrowRightLeft, AlertCircle, Copy, Palette, ArrowUp } from 'lucide-react';
import { useState, useRef } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import CategoryManager from './CategoryManager';
import AccountManager from './AccountManager';
import BalanceManager from './BalanceManager';
import { CurrencyTable } from './CurrencyTable';
import { useDataManagement } from '../hooks/useDataManagement';
import { APP_VERSION } from '../version';

import { UserProfile, Account } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SettingsProps {
  user: UserProfile;
  accounts: Account[];
  onLogout: () => void;
  onShowLogs: () => void;
  onRefresh: () => void;
}

export default function Settings({ user, accounts, onLogout, onShowLogs, onRefresh }: SettingsProps) {
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showAccountManager, setShowAccountManager] = useState(false);
  const [showCurrencyTable, setShowCurrencyTable] = useState(false);
  const [showBalanceManager, setShowBalanceManager] = useState(false);
  
  const {
    seeding, seedProgress, success, clearing, showClearConfirm, setShowClearConfirm,
    showClearTransactionsConfirm, setShowClearTransactionsConfirm, showSeedConfirm, setShowSeedConfirm,
    password, setPassword, exporting, importing, importProgress, importLogs, showLogModal, setShowLogModal,
    importResult, fileInputRef, handleImportClick, handleFileChange, seedInitialData, clearAllData,
    clearTransactionsOnly, exportData, copyLogsToClipboard
  } = useDataManagement(user, onRefresh);

  return (
    <div className="p-1.5 sm:p-2 lg:p-2 space-y-8">
      {/* Settings Sections */}
      <div className="space-y-6 relative">
        {showCategoryManager && <CategoryManager onClose={() => setShowCategoryManager(false)} onRefresh={onRefresh} />}
        {showAccountManager && (
          <AccountManager 
            accounts={accounts} 
            onClose={() => setShowAccountManager(false)} 
            onRefresh={onRefresh}
          />
        )}
        {showBalanceManager && (
          <BalanceManager 
            onClose={() => setShowBalanceManager(false)}
            onRefresh={onRefresh}
          />
        )}
        {showCurrencyTable && (
          <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-6 sm:p-2 bg-black/40 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={() => setShowCurrencyTable(false)} />
            <div className="relative w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 max-h-[90vh] flex flex-col">
              <div className="p-4 border-b border-neutral-100 flex items-center justify-between shrink-0 relative z-10">
                <h3 className="font-bold">Справочник валют</h3>
                <button 
                  onClick={() => setShowCurrencyTable(false)} 
                  className="p-2 hover:bg-neutral-100 rounded-full transition-colors cursor-pointer relative z-20"
                  aria-label="Закрыть"
                >
                  <X className="w-5 h-5 text-neutral-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto no-scrollbar">
                <CurrencyTable />
              </div>
            </div>
          </div>
        )}
        
        {showLogModal && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-6 sm:p-2 bg-black/40 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={() => setShowLogModal(false)} />
            <div className="relative w-full max-w-2xl bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center text-white">
                    <Database size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Логи импорта</h3>
                    <p className="text-xs text-neutral-400">Детальный отчет о процессе</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={copyLogsToClipboard}
                    className="p-2.5 hover:bg-neutral-100 rounded-xl transition-all text-neutral-500 hover:text-neutral-900 flex items-center gap-2 text-sm font-bold"
                  >
                    <Copy size={18} />
                    Копировать
                  </button>
                  <button onClick={() => setShowLogModal(false)} className="p-2.5 hover:bg-neutral-100 rounded-xl transition-all text-neutral-400">
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 font-mono text-xs space-y-1.5 bg-neutral-900 text-neutral-300 selection:bg-emerald-500/30 no-scrollbar">
                {importLogs.map((log, idx) => (
                  <div key={idx} className="flex gap-3 py-0.5 border-b border-white/5 last:border-0">
                    <span className="text-neutral-600 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                    <span className={cn(
                      "break-all",
                      log.includes('❌') ? "text-rose-400" : 
                      log.includes('⚠️') ? "text-amber-400" : 
                      log.includes('✅') || log.includes('успешно') ? "text-emerald-400" : ""
                    )}>{log}</span>
                  </div>
                ))}
                {importLogs.length === 0 && (
                  <div className="text-center py-12 text-neutral-500 italic">Логов пока нет...</div>
                )}
              </div>
            </div>
          </div>
        )}


        {/* Data Section */}
        <section className="space-y-3 mt-0 pt-0 pb-[6px]">
          <h4 className="text-xs font-bold text-theme-primary uppercase tracking-widest px-4">Данные</h4>
          <div className="bg-white rounded-3xl border border-neutral-100 overflow-hidden shadow-sm">
            <button 
              onClick={() => setShowCategoryManager(true)}
              className="w-full px-6 py-2 flex items-center gap-4 hover:bg-neutral-50 transition-colors border-b border-neutral-50"
            >
              <div className="w-10 h-10 bg-theme-primary-light rounded-xl flex items-center justify-center">
                <Tag className="w-5 h-5 text-theme-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Категории</p>
                <p className="text-xs text-neutral-400">Управление категориями операций</p>
              </div>
            </button>

            <button 
              onClick={() => setShowAccountManager(true)}
              className="w-full px-6 py-2 flex items-center gap-4 hover:bg-neutral-50 transition-colors border-b border-neutral-50"
            >
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Database className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Счета</p>
                <p className="text-xs text-neutral-400">Управление вашими счетами</p>
              </div>
            </button>

            <button 
              onClick={() => setShowBalanceManager(true)}
              className="w-full px-6 py-2 flex items-center gap-4 hover:bg-neutral-50 transition-colors border-b border-neutral-50"
            >
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <ArrowUp className="w-5 h-5 text-amber-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Баланс</p>
                <p className="text-xs text-neutral-400">История общего баланса по месяцам</p>
              </div>
            </button>

            <button 
              onClick={() => setShowCurrencyTable(true)}
              className="w-full px-6 py-2 flex items-center gap-4 hover:bg-neutral-50 transition-colors border-b border-neutral-50"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Валюты</p>
                <p className="text-xs text-neutral-400">Справочник доступных валют</p>
              </div>
            </button>

            <button 
              onClick={onShowLogs}
              className="w-full px-6 py-2 flex items-center gap-4 hover:bg-neutral-50 transition-colors"
            >
              <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center">
                <Database className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Логи AI</p>
                <p className="text-xs text-neutral-400">История запросов и ответов ассистента</p>
              </div>
            </button>
          </div>
        </section>

        {/* App Settings Section */}
        <section className="space-y-3">
          <h4 className="text-xs font-bold text-theme-primary uppercase tracking-widest px-4">Приложение</h4>
          <div className="bg-white rounded-3xl border border-neutral-100 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-neutral-50 last:border-0">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 bg-pink-100 dark:bg-pink-900/30 rounded-xl flex items-center justify-center">
                  <Palette className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Тема оформления</p>
                  <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-bold">Выберите настроение</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase mb-2 px-1">Светлые</p>
                  <div className="flex flex-wrap gap-3">
                    {[                      
                      { id: 'theme-light-blue', color: 'bg-blue-500', name: 'Лазурь' },
                      { id: 'theme-nordic', color: 'bg-sky-400', name: 'Нордик' },
                      { id: 'theme-light-orange', color: 'bg-orange-400', name: 'Пустыня' },
                      { id: 'theme-light-ruby', color: 'bg-rose-600', name: 'Рубин' },
                      { id: 'theme-light-violet', color: 'bg-violet-500', name: 'Фиалка' },
                      { id: 'theme-light-green', color: 'bg-emerald-500', name: 'Салат' },
                    ].map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => {
                          const themes = [
                            'theme-light-green', 'theme-light-blue', 'theme-nordic',
                            'theme-light-orange', 'theme-light-ruby', 'theme-light-violet',
                            'theme-midnight', 'theme-carbon', 'theme-oled', 'theme-forest-dark', 'theme-purple-night', 'theme-cyber'
                          ];
                          document.body.classList.remove(...themes);
                          document.body.classList.add(theme.id);
                          localStorage.setItem('theme', theme.id);
                        }}
                        className="group flex flex-col items-center gap-1"
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-2xl border-2 border-white shadow-sm transition-all group-active:scale-95 group-hover:ring-2 ring-emerald-500/20",
                          theme.color
                        )} />
                        <span className="text-[10px] font-medium text-neutral-500">{theme.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase mb-2 px-1">Темные</p>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { id: 'theme-midnight', color: 'bg-indigo-900', name: 'Полночь' },
                      { id: 'theme-carbon', color: 'bg-neutral-800', name: 'Уголь' },
                      { id: 'theme-oled', color: 'bg-black', name: 'OLED' },
                      { id: 'theme-forest-dark', color: 'bg-emerald-950', name: 'Тайга' },
                      { id: 'theme-purple-night', color: 'bg-purple-900', name: 'Неон' },
                      { id: 'theme-cyber', color: 'bg-cyan-400', name: 'Кибер' },
                    ].map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => {
                          const themes = [
                            'theme-light-green', 'theme-light-blue', 'theme-nordic',
                            'theme-light-orange', 'theme-light-ruby', 'theme-light-violet',
                            'theme-midnight', 'theme-carbon', 'theme-oled', 'theme-forest-dark', 'theme-purple-night', 'theme-cyber'
                          ];
                          document.body.classList.remove(...themes);
                          document.body.classList.add(theme.id);
                          localStorage.setItem('theme', theme.id);
                        }}
                        className="group flex flex-col items-center gap-1"
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-2xl border-2 border-neutral-800 shadow-sm transition-all group-active:scale-95 group-hover:ring-2 ring-emerald-500/20",
                          theme.color
                        )} />
                        <span className="text-[10px] font-medium text-neutral-500">{theme.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full px-6 py-2 flex items-center gap-4 border-b border-neutral-50">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <Info className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Версия приложения</p>
                <p className="text-xs text-neutral-400">{APP_VERSION}</p>
              </div>
            </div>

            <a 
              href="https://github.com/KNikolaich/Smart-FinManager" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full px-6 py-2 flex items-center gap-4 hover:bg-neutral-50 transition-colors"
            >
              <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center">
                <Github className="w-5 h-5 text-neutral-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">GitHub</p>
                <p className="text-xs text-neutral-400">Исходный код проекта</p>
              </div>
            </a>
          </div>
        </section>

        {/* Bottom Bar Spacer */}
        <div className="h-10 lg:hidden shrink-0" />

      </div>
    </div>
  );
}
