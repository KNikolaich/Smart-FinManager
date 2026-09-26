import { LogOut, User as UserIcon, Database, Shield, Github, Info, Sparkles, CheckCircle2, Eraser, Trash2, AlertTriangle, Tag, FileDown, FileUp, X, ArrowRightLeft, AlertCircle, Copy, Palette, ArrowUp, CreditCard, TrendingUp, RefreshCw, ServerCrash, CircleCheck, LayoutDashboard } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { api } from '../lib/api';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import CategoryManager from './CategoryManager';
import AccountManager from './AccountManager';
import BalanceManager from './BalanceManager';
import { CurrencyTable } from './CurrencyTable';
import { UserManager } from './UserManager';
import { useDataManagement } from '../hooks/useDataManagement';
import { APP_VERSION } from '../version';

import type {
  DashboardLayoutSettings,
  UserProfile,
  Account,
  ThemeDeviceClass,
  ThemePreferenceValue,
  ThemePreferences,
} from '../types';
import { DashboardLayoutEditor } from './settings/DashboardLayoutEditor';
import {
  DEFAULT_THEME,
  SYSTEM_THEME_ID,
  SYSTEM_THEME_PALETTE,
  THEME_DEVICE_OPTIONS,
  THEME_GROUPS,
  isThemePreference,
  resolveThemeChoice,
} from '../lib/themePreferences';
import { usePrefersDarkColorScheme } from '../hooks/usePrefersDarkColorScheme';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SettingsProps {
  user: UserProfile;
  accounts: Account[];
  onLogout: () => void;
  onShowLogs: () => void;
  onRefresh: () => void;
  onSaveDashboardLayout: (dashboard: DashboardLayoutSettings) => Promise<void>;
  themePreferences: ThemePreferences;
  themeDeviceClass: ThemeDeviceClass;
  onSaveThemePreference: (deviceClass: ThemeDeviceClass, theme: ThemePreferenceValue) => Promise<void>;
  onSaveThemeForAllDevices: (theme: ThemePreferenceValue) => Promise<void>;
}

export default function Settings({
  user,
  accounts,
  onLogout,
  onShowLogs,
  onRefresh,
  onSaveDashboardLayout,
  themePreferences,
  themeDeviceClass,
  onSaveThemePreference,
  onSaveThemeForAllDevices,
}: SettingsProps) {
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showAccountManager, setShowAccountManager] = useState(false);
  const [showCurrencyTable, setShowCurrencyTable] = useState(false);
  const [showBalanceManager, setShowBalanceManager] = useState(false);
  const [showUserManager, setShowUserManager] = useState(false);
  const [showDashboardLayoutEditor, setShowDashboardLayoutEditor] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedThemeDevice, setSelectedThemeDevice] = useState<ThemeDeviceClass>(themeDeviceClass);
  const [themeDraft, setThemeDraft] = useState<ThemePreferenceValue>(themePreferences[themeDeviceClass]);
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeSaveError, setThemeSaveError] = useState<string | null>(null);
  const prefersDarkColorScheme = usePrefersDarkColorScheme();

  useEffect(() => {
    setSelectedThemeDevice(themeDeviceClass);
  }, [themeDeviceClass]);
  useEffect(() => {
    setThemeDraft(themePreferences[selectedThemeDevice]);
  }, [selectedThemeDevice, themePreferences]);

  // DB migration panel (admin only)
  const [dbMigrateOpen, setDbMigrateOpen] = useState(false);
  const [dbMigrateRunning, setDbMigrateRunning] = useState(false);
  const [dbMigrateOutput, setDbMigrateOutput] = useState<string | null>(null);
  const [dbMigrateSuccess, setDbMigrateSuccess] = useState<boolean | null>(null);
  const [dbMigrateSyncedDespiteError, setDbMigrateSyncedDespiteError] = useState(false);
  const [dbMigrateAlreadyInSync, setDbMigrateAlreadyInSync] = useState(false);
  const [dbMigrateAcceptLoss, setDbMigrateAcceptLoss] = useState(false);
  const [dbStatusLoading, setDbStatusLoading] = useState(false);
  const [dbStatusInSync, setDbStatusInSync] = useState<boolean | null>(null);
  const [dbStatusOutput, setDbStatusOutput] = useState<string | null>(null);
  const [dbStatusError, setDbStatusError] = useState<string | null>(null);

  const handleDbStatus = async () => {
    setDbStatusLoading(true);
    setDbStatusInSync(null);
    setDbStatusOutput(null);
    setDbStatusError(null);
    try {
      const result = await api.get<{ inSync: boolean; output?: string; exitCode?: number }>('/admin/db-status');
      setDbStatusInSync(result.inSync);
      setDbStatusOutput(result.output || null);
      if (result.exitCode && result.exitCode !== 0) {
        setDbStatusError(result.output || `Prisma завершилась с кодом ${result.exitCode}.`);
      }
    } catch (err: any) {
      setDbStatusInSync(false);
      setDbStatusError(err.message || 'Не удалось проверить состояние схемы.');
    } finally {
      setDbStatusLoading(false);
    }
  };

  const handleDbMigrate = async () => {
    setDbMigrateRunning(true);
    setDbMigrateOutput(null);
    setDbMigrateSuccess(null);
    setDbMigrateSyncedDespiteError(false);
    setDbMigrateAlreadyInSync(false);
    try {
      const result = await api.post<{
        success: boolean;
        alreadyInSync?: boolean;
        syncedDespiteError?: boolean;
        output: string;
        exitCode: number;
      }>('/admin/db-migrate', { acceptDataLoss: dbMigrateAcceptLoss });
      setDbMigrateOutput(result.output || '(нет вывода)');
      setDbMigrateSuccess(result.success);
      setDbMigrateSyncedDespiteError(!!result.syncedDespiteError);
      setDbMigrateAlreadyInSync(!!result.alreadyInSync);
      setDbStatusInSync(result.success);
    } catch (err: any) {
      setDbMigrateOutput(err.message || 'Неизвестная ошибка');
      setDbMigrateSuccess(false);
    } finally {
      setDbMigrateRunning(false);
    }
  };

  const currentTheme = themePreferences[selectedThemeDevice];
  const activeThemeObj = THEME_GROUPS.flatMap(group => group.items).find(theme => theme.id === themeDraft)
    ?? THEME_GROUPS[0].items[0];
  const activeThemeName = themeDraft === SYSTEM_THEME_ID
    ? `Системная · ${prefersDarkColorScheme ? 'тёмная' : 'светлая'}`
    : activeThemeObj.name;
  const activeThemePalette = themeDraft === SYSTEM_THEME_ID ? SYSTEM_THEME_PALETTE : activeThemeObj.palette;
  const previewThemeId = resolveThemeChoice(themeDraft, prefersDarkColorScheme);

  const handleThemeChange = (theme: ThemePreferenceValue) => {
    if (!isThemePreference(theme) || themeSaving) return;
    setThemeDraft(theme);
    setDropdownOpen(false);
    setThemeSaveError(null);
  };

  const handleSaveCurrentTheme = async () => {
    if (themeSaving || themeDraft === currentTheme) return;
    setThemeSaving(true);
    setThemeSaveError(null);
    try {
      await onSaveThemePreference(selectedThemeDevice, themeDraft);
    } catch {
      setThemeSaveError('Не удалось сохранить выбор. Проверьте подключение и попробуйте снова.');
    } finally {
      setThemeSaving(false);
    }
  };

  const handleSaveThemeForAll = async (theme: ThemePreferenceValue) => {
    if (themeSaving) return;
    setThemeSaving(true);
    setThemeSaveError(null);
    try {
      await onSaveThemeForAllDevices(theme);
      setThemeDraft(theme);
    } catch {
      setThemeSaveError('Не удалось сохранить темы для экранов. Проверьте подключение и попробуйте снова.');
    } finally {
      setThemeSaving(false);
    }
  };

  const handleResetAllThemes = async () => {
    const allAlreadyDefault = themePreferences.mobile === DEFAULT_THEME
      && themePreferences.tablet === DEFAULT_THEME
      && themePreferences.desktop === DEFAULT_THEME;
    if (allAlreadyDefault) {
      setThemeDraft(DEFAULT_THEME);
      setDropdownOpen(false);
      return;
    }
    await handleSaveThemeForAll(DEFAULT_THEME);
  };
  const {
    seeding, seedProgress, success, clearing, showClearConfirm, setShowClearConfirm,
    showClearTransactionsConfirm, setShowClearTransactionsConfirm, showSeedConfirm, setShowSeedConfirm,
    password, setPassword, exporting, importing, importProgress, importLogs, showLogModal, setShowLogModal,
    importResult, fileInputRef, handleImportClick, handleFileChange, seedInitialData, deleteAccount,
    clearTransactionsOnly, exportData, copyLogsToClipboard
  } = useDataManagement(user, onRefresh, onLogout);

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
          <CurrencyTable onClose={() => setShowCurrencyTable(false)} />
        )}
        {showUserManager && (
          <UserManager onClose={() => setShowUserManager(false)} />
        )}
        {showDashboardLayoutEditor && (
          <DashboardLayoutEditor
            value={user.settings?.dashboard}
            onClose={() => setShowDashboardLayoutEditor(false)}
            onSave={onSaveDashboardLayout}
          />
        )}
        
        {showLogModal && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-6 sm:p-2 bg-black/40 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={() => setShowLogModal(false)} />
            <div className="relative w-full max-w-2xl bg-theme-surface rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-theme-base flex items-center justify-between bg-theme-main shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-theme-primary rounded-xl flex items-center justify-center text-theme-on-primary">
                    <Database size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Логи импорта</h3>
                    <p className="text-xs text-theme-muted">Детальный отчет о процессе</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={copyLogsToClipboard}
                    className="p-2.5 hover:bg-theme-main rounded-xl transition-all text-theme-muted hover:text-theme-main flex items-center gap-2 text-sm font-bold"
                  >
                    <Copy size={18} />
                    Копировать
                  </button>
                  <button onClick={() => setShowLogModal(false)} className="p-2.5 hover:bg-theme-main rounded-xl transition-all text-theme-muted">
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 font-mono text-xs space-y-1.5 bg-neutral-900 text-neutral-300 selection:bg-emerald-500/30 no-scrollbar">
                {importLogs.map((log, idx) => (
                  <div key={idx} className="flex gap-3 py-0.5 border-b border-white/5 last:border-0">
                    <span className="text-neutral-500 shrink-0">[{new Date().toLocaleTimeString()}]</span>
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


        {/* DB Migration Modal (admin only) */}
        {dbMigrateOpen && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-6 sm:p-2 bg-black/40 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={() => setDbMigrateOpen(false)} />
            <div className="relative w-full max-w-2xl bg-theme-surface rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="p-6 border-b border-theme-base flex items-center justify-between bg-theme-main/50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center text-white">
                    <Database size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Обновление БД</h3>
                    <p className="text-xs text-theme-muted">prisma db push — синхронизация схемы</p>
                  </div>
                </div>
                <button onClick={() => setDbMigrateOpen(false)} className="p-2.5 hover:bg-theme-main rounded-xl transition-all text-theme-muted">
                  <X size={20} />
                </button>
              </div>

              {/* Info + controls */}
              <div className="px-6 pt-5 pb-3 shrink-0 space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 text-sm text-amber-800">
                  <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">Когда нужно запускать</p>
                    <p className="text-xs text-amber-700 leading-relaxed">
                      После каждого обновления приложения, если в нём были изменения схемы БД — новые таблицы, поля или индексы.
                      Без этого сервер может падать с ошибками вроде <code className="bg-amber-100 px-1 rounded">relation "..." does not exist</code>.
                    </p>
                  </div>
                </div>

                {/* Status check */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDbStatus}
                    disabled={dbStatusLoading || dbMigrateRunning}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-theme-main hover:bg-theme-primary-light text-theme-main transition-all disabled:opacity-50"
                  >
                    {dbStatusLoading
                      ? <RefreshCw size={13} className="animate-spin" />
                      : <Database size={13} />
                    }
                    Проверить состояние
                  </button>
                  {dbStatusInSync === true && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                      <CircleCheck size={14} /> БД синхронизирована
                    </span>
                  )}
                  {dbStatusInSync === false && !dbStatusError && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                      <AlertCircle size={14} /> Есть несинхронизированные изменения
                    </span>
                  )}
                </div>
                {dbStatusError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    <p className="font-semibold">Не удалось проверить состояние БД</p>
                    <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">{dbStatusError}</pre>
                  </div>
                )}
                {dbStatusOutput && !dbStatusError && dbStatusInSync === false && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <p className="font-semibold">Prisma ожидает следующие изменения:</p>
                    <pre className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">{dbStatusOutput}</pre>
                  </div>
                )}

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={dbMigrateAcceptLoss}
                    onChange={e => setDbMigrateAcceptLoss(e.target.checked)}
                    className="w-4 h-4 accent-violet-600"
                  />
                  <div>
                    <p className="text-sm font-semibold text-theme-main">Разрешить удаление данных</p>
                    <p className="text-xs text-theme-muted">Нужно только если схема удаляет колонки или таблицы. Обычно не требуется.</p>
                  </div>
                </label>

                <button
                  onClick={handleDbMigrate}
                  disabled={dbMigrateRunning}
                  className={cn(
                    "w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all",
                    dbMigrateRunning
                      ? "bg-theme-main text-theme-muted cursor-not-allowed"
                      : "bg-violet-600 text-white hover:bg-violet-700 active:scale-[0.98] shadow-lg shadow-violet-100"
                  )}
                >
                  {dbMigrateRunning
                    ? <><RefreshCw size={16} className="animate-spin" /> Выполняется...</>
                    : <><RefreshCw size={16} /> Синхронизировать БД</>
                  }
                </button>
              </div>

              {/* Output log */}
              {dbMigrateOutput !== null && (
                <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
                  <div className={cn(
                    "mx-6 mb-2 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2",
                    dbMigrateSuccess
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-rose-50 text-rose-700 border border-rose-200"
                  )}>
                    {dbMigrateAlreadyInSync
                      ? <><CircleCheck size={14} /> БД уже синхронизирована, изменений не требуется</>
                      : dbMigrateSyncedDespiteError
                        ? <><CircleCheck size={14} /> БД синхронизирована (несущественная ошибка переименования ключа — игнорируйте)</>
                        : dbMigrateSuccess
                          ? <><CircleCheck size={14} /> Схема успешно синхронизирована</>
                          : <><AlertCircle size={14} /> Ошибка синхронизации — см. вывод ниже</>
                    }
                  </div>
                  {!dbMigrateAlreadyInSync && (
                    <pre className="flex-1 overflow-y-auto mx-6 mb-6 p-4 bg-neutral-900 text-neutral-300 rounded-2xl font-mono text-xs leading-relaxed whitespace-pre-wrap break-all no-scrollbar">
                      {dbMigrateOutput}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Data Section */}
        <section className="space-y-3 mt-0 pt-0 pb-[6px]">
          <h4 className="text-xs font-bold text-theme-primary uppercase tracking-widest px-4">Данные</h4>
          <div className="bg-theme-surface rounded-3xl border border-theme-base overflow-hidden shadow-sm">
            <button 
              onClick={() => setShowCategoryManager(true)}
              className="w-full px-6 py-2 flex items-center gap-4 text-theme-main hover:bg-theme-main transition-colors border-b border-theme-base"
            >
              <div className="w-10 h-10 bg-theme-primary-light rounded-xl flex items-center justify-center">
                <Tag className="w-5 h-5 text-theme-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-theme-main">Категории</p>
                <p className="text-xs text-theme-muted">Управление категориями операций</p>
              </div>
            </button>

            <button 
              onClick={() => setShowAccountManager(true)}
              className="w-full px-6 py-2 flex items-center gap-4 text-theme-main hover:bg-theme-main transition-colors border-b border-theme-base"
            >
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center relative">
                <CreditCard className="w-5 h-5 text-emerald-600 relative z-10" />
                <CreditCard className="w-5 h-5 text-emerald-400 absolute translate-x-1 -translate-y-1 opacity-50" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-theme-main">Счета</p>
                <p className="text-xs text-theme-muted">Управление вашими счетами</p>
              </div>
            </button>

            <button 
              onClick={() => setShowBalanceManager(true)}
              className="w-full px-6 py-2 flex items-center gap-4 text-theme-main hover:bg-theme-main transition-colors border-b border-theme-base"
            >
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-theme-main">Баланс</p>
                <p className="text-xs text-theme-muted">История общего баланса по месяцам</p>
              </div>
            </button>

            <button 
              onClick={() => setShowCurrencyTable(true)}
              className="w-full px-6 py-2 flex items-center gap-4 text-theme-main hover:bg-theme-main transition-colors border-b border-theme-base"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-theme-main">Валюты</p>
                <p className="text-xs text-theme-muted">Справочник доступных валют</p>
              </div>
            </button>

            {user.role === 'admin' && (
              <button 
                onClick={() => setShowUserManager(true)}
                className="w-full px-6 py-2 flex items-center gap-4 text-theme-main hover:bg-theme-main transition-colors border-b border-theme-base"
              >
                <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-rose-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm text-theme-main">Пользователи</p>
                  <p className="text-xs text-theme-muted">Управление всеми пользователями системы</p>
                </div>
              </button>
            )}

            {user.role === 'admin' && (
              <button 
                onClick={() => setDbMigrateOpen(true)}
                className="w-full px-6 py-2 flex items-center gap-4 text-theme-main hover:bg-theme-main transition-colors border-b border-theme-base"
              >
                <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                  <Database className="w-5 h-5 text-violet-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm text-theme-main">Обновление БД</p>
                  <p className="text-xs text-theme-muted">Синхронизировать схему базы данных с кодом</p>
                </div>
              </button>
            )}

            <button 
              onClick={onShowLogs}
              className="w-full px-6 py-2 flex items-center gap-4 text-theme-main hover:bg-theme-main transition-colors"
            >
              <div className="w-10 h-10 bg-theme-primary rounded-xl flex items-center justify-center">
                <Database className="w-5 h-5 text-theme-on-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-theme-main">Логи AI</p>
                <p className="text-xs text-theme-muted">История запросов и ответов ассистента</p>
              </div>
            </button>
          </div>
        </section>

        {/* App Settings Section */}
        <section className="space-y-3">
          <h4 className="text-xs font-bold text-theme-primary uppercase tracking-widest px-4">Приложение</h4>
          <div className="bg-theme-surface rounded-3xl border border-theme-base shadow-sm overflow-visible">
            <div className="px-6 py-4 border-b border-theme-base last:border-0">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 bg-theme-primary-light rounded-xl flex items-center justify-center">
                  <Palette className="w-5 h-5 text-theme-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-theme-main">Тема оформления</p>
                  <p className="text-[10px] text-theme-muted uppercase tracking-wider font-bold">Отдельная тема для каждой группы экранов</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-1 rounded-2xl bg-theme-main p-1" role="group" aria-label="Группа экранов">
                  {THEME_DEVICE_OPTIONS.map(option => (
                    <button
                      key={option.id}
                      type="button"
                      data-testid={`theme-device-${option.id}`}
                      aria-pressed={selectedThemeDevice === option.id}
                      onClick={() => {
                        setSelectedThemeDevice(option.id);
                        setDropdownOpen(false);
                        setThemeSaveError(null);
                      }}
                      className={cn(
                        'rounded-xl px-2 py-2 text-[10px] sm:text-xs font-semibold transition-colors',
                        selectedThemeDevice === option.id
                          ? 'bg-theme-surface text-theme-primary shadow-sm'
                          : 'text-theme-muted hover:text-theme-main',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] leading-relaxed text-theme-muted">
                  Сохраняется в аккаунте: телефон — до 767 px, планшет / ноутбук — 768–1439 px, большой экран — от 1440 px.
                </p>
                <div className="relative">
                  <button
                    type="button"
                    data-testid="theme-picker-toggle"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    disabled={themeSaving}
                    className="w-full flex items-center justify-between p-3 bg-theme-main rounded-2xl border border-theme-base hover:border-theme-primary transition-all font-semibold text-sm text-theme-main disabled:opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-1">
                        {activeThemePalette.map((color, i) => (
                          <div key={i} className="w-4 h-4 rounded-full border border-theme-base" style={{ backgroundColor: color }} />
                        ))}
                      </div>
                      <span>{activeThemeName}</span>
                    </div>
                    <ArrowUp className={cn("w-4 h-4 transition-transform", dropdownOpen ? "rotate-0" : "rotate-180")} />
                  </button>
                  
                  {dropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-theme-surface rounded-3xl border border-theme-base shadow-xl z-50 animate-in fade-in slide-in-from-top-2 flex flex-col max-h-[400px]">
                      <div className="p-2 overflow-y-auto">
                        <button
                          type="button"
                          data-testid="theme-option-system"
                          aria-pressed={themeDraft === SYSTEM_THEME_ID}
                          onClick={() => handleThemeChange(SYSTEM_THEME_ID)}
                          disabled={themeSaving}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-theme-main rounded-xl transition-all disabled:opacity-60"
                        >
                          <span className="text-left">
                            <span className={cn("block text-sm font-medium", themeDraft === SYSTEM_THEME_ID ? "text-theme-primary" : "text-theme-main")}>Системная</span>
                            <span className="block text-[10px] text-theme-muted">Как в настройках устройства</span>
                          </span>
                          <div className="flex -space-x-1">
                            {SYSTEM_THEME_PALETTE.map((color, i) => (
                              <div key={i} className="w-4 h-4 rounded-full border border-theme-base" style={{ backgroundColor: color }} />
                            ))}
                          </div>
                        </button>
                        <div className="my-2 border-t border-theme-base" />
                        {THEME_GROUPS.map(group => (
                          <div key={group.type} className="mb-4 last:mb-0">
                            <p className="text-[10px] font-bold text-theme-muted uppercase mb-2 px-3">{group.type}</p>
                            {group.items.map((theme) => (
                              <button
                                key={theme.id}
                                type="button"
                                data-testid={`theme-option-${theme.id}`}
                                aria-pressed={themeDraft === theme.id}
                                onClick={() => handleThemeChange(theme.id)}
                                disabled={themeSaving}
                                className="w-full flex items-center justify-between px-3 py-2 hover:bg-theme-main rounded-xl transition-all disabled:opacity-60"
                              >
                                <span className={cn("text-sm font-medium", themeDraft === theme.id ? "text-theme-primary" : "text-theme-main")}>{theme.name}</span>
                                <div className="flex -space-x-1">
                                  {theme.palette.map((color, i) => (
                                    <div key={i} className="w-4 h-4 rounded-full border border-theme-base" style={{ backgroundColor: color }} />
                                  ))}
                                </div>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-theme-main">Предпросмотр темы</p>
                    <p className="text-[10px] text-theme-muted">
                      {themeDraft === SYSTEM_THEME_ID
                        ? `Сейчас используется ${prefersDarkColorScheme ? 'тёмный' : 'светлый'} вариант`
                        : 'Изменения пока не применены'}
                    </p>
                  </div>
                  <div
                    data-testid="theme-preview"
                    aria-label={`Предпросмотр темы ${activeThemeName}`}
                    className={cn(previewThemeId, 'rounded-2xl border border-theme-base p-3')}
                  >
                    <div className="bg-theme-main rounded-xl p-3">
                      <div className="bg-theme-surface border border-theme-base rounded-xl p-3">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-theme-muted">Обзор месяца</p>
                        <div className="mt-1 flex items-end justify-between gap-2">
                          <div>
                            <p className="text-xs text-theme-muted">Общий баланс</p>
                            <p className="text-lg font-bold text-theme-main">128 450 ₽</p>
                          </div>
                          <span className="text-xs font-semibold text-theme-primary">+4,8%</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-lg bg-theme-primary px-3 py-2 text-xs font-semibold text-theme-on-primary">Добавить операцию</span>
                          <span className="rounded-lg bg-theme-primary-light px-3 py-2 text-xs font-semibold text-theme-primary">Доход +3 200 ₽</span>
                        </div>
                        <div className="mt-3 rounded-lg border border-theme-base bg-theme-main px-3 py-2 text-xs text-theme-muted">
                          Поиск операции
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    data-testid="theme-apply-current"
                    onClick={() => void handleSaveCurrentTheme()}
                    disabled={themeSaving || themeDraft === currentTheme}
                    className="flex items-center justify-center gap-2 rounded-xl bg-theme-primary px-3 py-2.5 text-xs font-semibold text-theme-on-primary transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {themeSaving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Применить на этот экран
                  </button>
                  <button
                    type="button"
                    data-testid="theme-apply-all"
                    onClick={() => void handleSaveThemeForAll(themeDraft)}
                    disabled={themeSaving || (themePreferences.mobile === themeDraft && themePreferences.tablet === themeDraft && themePreferences.desktop === themeDraft)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-theme-base bg-theme-main px-3 py-2.5 text-xs font-semibold text-theme-main transition-colors hover:border-theme-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} />
                    Применить ко всем
                  </button>
                </div>
                <button
                  type="button"
                  data-testid="theme-reset-all"
                  onClick={() => void handleResetAllThemes()}
                  disabled={themeSaving || (
                    themeDraft === DEFAULT_THEME
                    && themePreferences.mobile === DEFAULT_THEME
                    && themePreferences.tablet === DEFAULT_THEME
                    && themePreferences.desktop === DEFAULT_THEME
                  )}
                  className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-theme-muted transition-colors hover:bg-theme-main hover:text-theme-main disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw size={13} />
                  Сбросить все темы · Нордик по умолчанию
                </button>
                {themeSaveError && <p role="alert" className="text-xs text-red-600">{themeSaveError}</p>}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowDashboardLayoutEditor(true)}
              className="w-full px-6 py-4 flex items-center gap-4 text-left hover:bg-theme-main transition-colors border-b border-theme-base"
            >
              <div className="w-10 h-10 bg-theme-primary-light rounded-xl flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5 text-theme-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-theme-main">Настройка дашборда</p>
                <p className="text-xs text-theme-muted">Видимость и порядок блоков отдельно для устройств</p>
              </div>
            </button>

            <div className="w-full px-6 py-2 flex items-center gap-4 border-b border-theme-base">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <Info className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Версия приложения</p>
                <p className="text-xs text-theme-muted">{APP_VERSION}</p>
              </div>
            </div>

            <a 
              href="https://github.com/KNikolaich/Smart-FinManager" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full px-6 py-2 flex items-center gap-4 hover:bg-theme-main transition-colors"
            >
              <div className="w-10 h-10 bg-theme-primary-light rounded-xl flex items-center justify-center">
                <Github className="w-5 h-5 text-theme-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">GitHub</p>
                <p className="text-xs text-theme-muted">Исходный код проекта</p>
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
