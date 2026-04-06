import { LogOut, User as UserIcon, Database, Shield, Github, Info, Sparkles, CheckCircle2, Eraser, Trash2, AlertTriangle, Tag, FileDown, FileUp, X, ArrowRightLeft, AlertCircle, Copy, Palette } from 'lucide-react';
import { useState, useRef } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import CategoryManager from './CategoryManager';
import AccountManager from './AccountManager';
import { CurrencyTable } from './CurrencyTable';
import { useDataManagement } from '../hooks/useDataManagement';

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
  
  const {
    seeding, seedProgress, success, clearing, showClearConfirm, setShowClearConfirm,
    showClearTransactionsConfirm, setShowClearTransactionsConfirm, showSeedConfirm, setShowSeedConfirm,
    password, setPassword, exporting, importing, importProgress, importLogs, showLogModal, setShowLogModal,
    importResult, fileInputRef, handleImportClick, handleFileChange, seedInitialData, clearAllData,
    clearTransactionsOnly, exportData, copyLogsToClipboard
  } = useDataManagement(user, onRefresh);

  return (
    <div className="p-1.5 sm:p-2 lg:p-6 space-y-8">
      <h2 className="text-2xl font-bold">Настройки</h2>

      {/* Settings Sections */}
      <div className="space-y-6 relative">
        {showCategoryManager && <CategoryManager user={user} onClose={() => setShowCategoryManager(false)} onRefresh={onRefresh} />}
        {showAccountManager && (
          <AccountManager 
            accounts={accounts} 
            userId={user.id} 
            onClose={() => setShowAccountManager(false)} 
            onRefresh={onRefresh}
          />
        )}
        {showCurrencyTable && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-6 sm:p-4 bg-black/40 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={() => setShowCurrencyTable(false)} />
            <div className="relative w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 max-h-[90vh] flex flex-col">
              <div className="p-4 border-b border-neutral-100 flex items-center justify-between shrink-0">
                <h3 className="font-bold">Справочник валют</h3>
                <button onClick={() => setShowCurrencyTable(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
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
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-6 sm:p-4 bg-black/40 backdrop-blur-sm">
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

        {/* Seed Data Confirmation Overlay */}
        {showSeedConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white rounded-[32px] p-8 text-center shadow-2xl animate-in zoom-in duration-200 border border-amber-100">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Создать демо-данные?</h3>
              <p className="text-neutral-500 mb-8 text-sm">Будут добавлены 3 карты и операции за 3 месяца.</p>
              <input
                type="password"
                placeholder="Введите пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-neutral-100 p-4 rounded-2xl mb-4 text-center"
              />
              <div className="flex flex-col w-full gap-3">
                <button
                  onClick={seedInitialData}
                  disabled={seeding}
                  className="w-full bg-amber-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-amber-100 hover:bg-amber-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {seeding ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Sparkles className="w-5 h-5" />
                  )}
                  Создать
                </button>
                <button
                  onClick={() => { setShowSeedConfirm(false); setPassword(''); }}
                  disabled={seeding}
                  className="w-full bg-neutral-100 text-neutral-600 font-bold py-4 rounded-2xl hover:bg-neutral-200 transition-all active:scale-95"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Clear Data Confirmation Overlay */}
        {showClearConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white rounded-[32px] p-8 text-center shadow-2xl animate-in zoom-in duration-200 border border-rose-100">
              <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-rose-600" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Очистить абсолютно всё?</h3>
              <p className="text-neutral-500 mb-8 text-sm">Все ваши счета, операции, категории и цели будут удалены навсегда. Это действие необратимо.</p>
              <input
                type="password"
                placeholder="Введите пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-neutral-100 p-4 rounded-2xl mb-4 text-center"
              />
              <div className="flex flex-col w-full gap-3">
                <button
                  onClick={clearAllData}
                  disabled={clearing}
                  className="w-full bg-rose-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {clearing ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-5 h-5" />
                  )}
                  Да, удалить все данные
                </button>
                <button
                  onClick={() => { setShowClearConfirm(false); setPassword(''); }}
                  disabled={clearing}
                  className="w-full bg-neutral-100 text-neutral-600 font-bold py-4 rounded-2xl hover:bg-neutral-200 transition-all active:scale-95"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Clear Transactions Only Confirmation Overlay */}
        {showClearTransactionsConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white rounded-[32px] p-8 text-center shadow-2xl animate-in zoom-in duration-200 border border-blue-100">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Удалить только операции?</h3>
              <p className="text-neutral-500 mb-8 text-sm">Все записи о доходах и расходах будут удалены. Счета, категории и цели останутся.</p>
              <input
                type="password"
                placeholder="Введите пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-neutral-100 p-4 rounded-2xl mb-4 text-center"
              />
              <div className="flex flex-col w-full gap-3">
                <button
                  onClick={clearTransactionsOnly}
                  disabled={clearing}
                  className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {clearing ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-5 h-5" />
                  )}
                  Да, удалить операции
                </button>
                <button
                  onClick={() => { setShowClearTransactionsConfirm(false); setPassword(''); }}
                  disabled={clearing}
                  className="w-full bg-neutral-100 text-neutral-600 font-bold py-4 rounded-2xl hover:bg-neutral-200 transition-all active:scale-95"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Data Management Section */}
        <section className="space-y-3">
          <h4 className="text-xs font-bold text-theme-primary uppercase tracking-widest px-4">Управление данными</h4>
          <div className="bg-white rounded-3xl border border-neutral-100 overflow-hidden shadow-sm">
            <button 
              onClick={() => setShowSeedConfirm(true)}
              className="w-full px-6 py-4 flex items-center gap-4 hover:bg-neutral-50 transition-colors border-b border-neutral-50"
            >
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-amber-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Создать демо-данные</p>
                <p className="text-xs text-neutral-400">Добавить примеры операций</p>
              </div>
            </button>

            <button 
              onClick={exportData}
              disabled={exporting}
              className="w-full px-6 py-4 flex items-center gap-4 hover:bg-neutral-50 transition-colors border-b border-neutral-50"
            >
              <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center">
                <FileDown className="w-5 h-5 text-sky-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Экспорт данных</p>
                <p className="text-xs text-neutral-400">Скачать резервную копию (Excel)</p>
              </div>
            </button>

            <button 
              onClick={handleImportClick}
              className="w-full px-6 py-4 flex items-center gap-4 hover:bg-neutral-50 transition-colors border-b border-neutral-50"
            >
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx,.xls" />
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                <FileUp className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Импорт данных</p>
                <p className="text-xs text-neutral-400">Загрузить данные из Excel</p>
              </div>
            </button>

            <button 
              onClick={() => setShowClearTransactionsConfirm(true)}
              className="w-full px-6 py-4 flex items-center gap-4 hover:bg-neutral-50 transition-colors border-b border-neutral-50"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Стереть операции</p>
                <p className="text-xs text-neutral-400">Удалить только транзакции</p>
              </div>
            </button>

            <button 
              onClick={() => setShowClearConfirm(true)}
              className="w-full px-6 py-4 flex items-center gap-4 hover:bg-neutral-50 transition-colors"
            >
              <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                <Eraser className="w-5 h-5 text-rose-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Стереть все данные</p>
                <p className="text-xs text-neutral-400 text-rose-500">Полная очистка аккаунта</p>
              </div>
            </button>
          </div>
        </section>

        {/* Data Section */}
        <section className="space-y-3">
          <h4 className="text-xs font-bold text-theme-primary uppercase tracking-widest px-4">Данные</h4>
          <div className="bg-white rounded-3xl border border-neutral-100 overflow-hidden shadow-sm">
            <button 
              onClick={() => setShowCategoryManager(true)}
              className="w-full px-6 py-4 flex items-center gap-4 hover:bg-neutral-50 transition-colors border-b border-neutral-50"
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
              className="w-full px-6 py-4 flex items-center gap-4 hover:bg-neutral-50 transition-colors border-b border-neutral-50"
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
              onClick={() => setShowCurrencyTable(true)}
              className="w-full px-6 py-4 flex items-center gap-4 hover:bg-neutral-50 transition-colors"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Валюты</p>
                <p className="text-xs text-neutral-400">Справочник доступных валют</p>
              </div>
            </button>
          </div>
        </section>

        {/* App Settings Section */}
        <section className="space-y-3">
          <h4 className="text-xs font-bold text-theme-primary uppercase tracking-widest px-4">Приложение</h4>
          <div className="bg-white rounded-3xl border border-neutral-100 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-neutral-50">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center">
                  <Palette className="w-5 h-5 text-pink-600" />
                </div>
                <p className="font-semibold text-sm">Тема оформления</p>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {[
                  { id: 'theme-light-green', color: 'bg-emerald-500' },
                  { id: 'theme-light-blue', color: 'bg-blue-500' },
                  { id: 'theme-light-orange', color: 'bg-orange-500' },
                  { id: 'theme-light-brown', color: 'bg-yellow-700' },
                  { id: 'theme-light-gray', color: 'bg-neutral-500' },
                  { id: 'theme-light-purple', color: 'bg-purple-500' },
                ].map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => {
                      const themes = [
                        'theme-light-green', 'theme-light-blue', 'theme-light-orange', 
                        'theme-light-brown', 'theme-light-gray', 'theme-light-purple'
                      ];
                      document.body.classList.remove(...themes);
                      document.body.classList.add(theme.id);
                      localStorage.setItem('theme', theme.id);
                    }}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 border-white shadow-sm transition-transform active:scale-90",
                      theme.id === 'theme-light-green' ? 'bg-emerald-500' :
                      theme.id === 'theme-light-blue' ? 'bg-blue-500' :
                      theme.id === 'theme-light-orange' ? 'bg-orange-500' :
                      theme.id === 'theme-light-brown' ? 'bg-yellow-700' :
                      theme.id === 'theme-light-gray' ? 'bg-neutral-500' :
                      'bg-purple-500'
                    )}
                  />
                ))}
              </div>
            </div>

            <button 
              onClick={onShowLogs}
              className="w-full px-6 py-4 flex items-center gap-4 hover:bg-neutral-50 transition-colors border-b border-neutral-50"
            >
              <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center">
                <Database className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Логи AI</p>
                <p className="text-xs text-neutral-400">История запросов и ответов ассистента</p>
              </div>
            </button>

            <button className="w-full px-6 py-4 flex items-center gap-4 hover:bg-neutral-50 transition-colors">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Безопасность</p>
                <p className="text-xs text-neutral-400">Управление доступом и сессиями</p>
              </div>
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
