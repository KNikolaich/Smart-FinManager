import { LogOut, User as UserIcon, Database, Shield, Github, Info, Sparkles, CheckCircle2, Eraser, Trash2, AlertTriangle, Tag, FileDown, FileUp, X, ArrowRightLeft, AlertCircle, Copy, Palette } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { generateDemoData } from '../services/demoDataService';
import { importFinancialData } from '../services/importService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import CategoryManager from './CategoryManager';
import { CurrencyTable } from './CurrencyTable';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';

import { UserProfile } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SettingsProps {
  user: UserProfile;
  onLogout: () => void;
  onShowLogs: () => void;
  onRefresh: () => void;
}

export default function Settings({ user, onLogout, onShowLogs, onRefresh }: SettingsProps) {
  const [seeding, setSeeding] = useState(false);
  const [success, setSuccess] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showClearTransactionsConfirm, setShowClearTransactionsConfirm] = useState(false);
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);
  const [password, setPassword] = useState('');
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showCurrencyTable, setShowCurrencyTable] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [showLogModal, setShowLogModal] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; count: number } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleJSONClick = () => {
    jsonInputRef.current?.click();
  };

  const handleStopImport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, isJson: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setImporting(true);
    setImportProgress(0);
    setImportLogs(['Начало импорта...']);
    setImportResult(null);
    try {
      const result = await importFinancialData(
        file, 
        (progress) => setImportProgress(progress),
        (log) => setImportLogs(prev => [...prev, log]),
        controller.signal
      );
      if (result.success) {
        setImportResult({ success: true, count: result.count });
        onRefresh();
      }
    } catch (error: any) {
      if (error.message === 'Import cancelled') {
        setImportLogs(prev => [...prev, '⚠️ Импорт остановлен пользователем']);
      } else {
        console.error('Import error:', error);
        setImportLogs(prev => [...prev, `Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`]);
        alert('Ошибка при импорте данных');
      }
    } finally {
      setImporting(false);
      setImportProgress(0);
      abortControllerRef.current = null;
      if (isJson) {
        if (jsonInputRef.current) jsonInputRef.current.value = '';
      } else {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  const verifyPassword = async () => {
    try {
      await api.post('/auth/verify-password', { password });
      return true;
    } catch (error) {
      alert('Неверный пароль');
      return false;
    }
  };

  const seedInitialData = async () => {
    if (!(await verifyPassword())) return;
    setSeeding(true);
    setSuccess(false);
    try {
      await generateDemoData(user.id);
      setSuccess(true);
      onRefresh();
      setShowSeedConfirm(false);
      setPassword('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Seed error:', error);
    } finally {
      setSeeding(false);
    }
  };

  const clearAllData = async () => {
    if (!(await verifyPassword())) return;
    setClearing(true);
    try {
      await api.delete('/data/clear');
      onRefresh();
      setShowClearConfirm(false);
      setPassword('');
    } catch (error) {
      console.error('Clear error:', error);
    } finally {
      setClearing(false);
    }
  };

  const clearTransactionsOnly = async () => {
    if (!(await verifyPassword())) return;
    setClearing(true);
    try {
      await api.delete('/data/clear-transactions');
      onRefresh();
      setShowClearTransactionsConfirm(false);
      setPassword('');
    } catch (error) {
      console.error('Clear transactions error:', error);
    } finally {
      setClearing(false);
    }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const workbook = XLSX.utils.book_new();

      const collections = [
        { name: 'transactions', endpoint: '/transactions' },
        { name: 'accounts', endpoint: '/accounts' },
        { name: 'categories', endpoint: '/categories' },
        { name: 'goals', endpoint: '/goals' },
        { name: 'budgets', endpoint: '/budgets' }
      ];
      
      let hasData = false;
      
      for (const col of collections) {
        try {
          const data = await api.get<any[]>(col.endpoint);
          if (data && data.length > 0) {
            const worksheet = XLSX.utils.json_to_sheet(data);
            XLSX.utils.book_append_sheet(workbook, worksheet, col.name);
            hasData = true;
          }
        } catch (err) {
          console.error(`Error exporting ${col.name}:`, err);
        }
      }

      if (!hasData) {
        alert('Нет данных для экспорта');
        return;
      }

      const date = new Date().toISOString().split('T')[0];
      const fileName = `backupAiFinAssistant_${date}.xlsx`;
      
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error('Export error:', error);
      alert('Произошла ошибка при экспорте данных');
    } finally {
      setExporting(false);
    }
  };

  const copyLogsToClipboard = () => {
    const text = importLogs.join('\n');
    navigator.clipboard.writeText(text);
    alert('Логи скопированы в буфер обмена');
  };

  return (
    <div className="p-1.5 sm:p-2 lg:p-6 space-y-8">
      <h2 className="text-2xl font-bold">Настройки</h2>

      {/* Profile Card */}
      <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm flex items-center gap-4">
        <div className="w-16 h-16 bg-theme-primary-light rounded-2xl flex items-center justify-center overflow-hidden">
          {user.photoURL ? (
            <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" />
          ) : (
            <UserIcon className="w-8 h-8 text-theme-primary" />
          )}
        </div>
        <div>
          <h3 className="font-bold text-lg">{user.displayName || 'Пользователь'}</h3>
          <p className="text-sm text-neutral-400">{user.email}</p>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6 relative">
        {showCategoryManager && <CategoryManager user={user} onClose={() => setShowCategoryManager(false)} onRefresh={onRefresh} />}
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
          <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest px-4">Управление данными</h4>
          <div className="bg-white rounded-3xl border border-neutral-100 overflow-hidden shadow-sm">
            <div className="flex items-center border-b border-neutral-50">
              <button 
                onClick={() => setShowSeedConfirm(true)}
                disabled={seeding || success}
                className="flex-1 px-6 py-4 flex items-center gap-4 hover:bg-neutral-50 transition-colors"
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                  success ? "bg-emerald-100" : "bg-amber-100"
                )}>
                  {success ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Sparkles className="w-5 h-5 text-amber-600" />}
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm">{seeding ? 'Создание...' : success ? 'Готово!' : 'Создать демо-данные'}</p>
                  <p className="text-xs text-neutral-400">
                    {success ? 'Проверьте вкладку "Обзор"' : 'Добавить 3 карты и операции за 3 месяца'}
                  </p>
                </div>
              </button>
              <button
                onClick={() => setShowClearTransactionsConfirm(true)}
                className="px-6 py-4 hover:bg-blue-50 text-blue-400 hover:text-blue-600 transition-all border-l border-neutral-50 group"
                title="Очистить только операции"
              >
                <Eraser className="w-6 h-6 group-hover:scale-110 transition-transform" />
              </button>
              <button
                onClick={() => setShowClearConfirm(true)}
                className="px-6 py-4 hover:bg-rose-50 text-rose-400 hover:text-rose-600 transition-all border-l border-neutral-50 group"
                title="Очистить всё (счета, категории, цели)"
              >
                <Eraser className="w-6 h-6 group-hover:scale-110 transition-transform" />
              </button>
            </div>
            
            <button 
              onClick={exportData}
              disabled={exporting}
              className="w-full px-6 py-4 flex items-center gap-4 hover:bg-neutral-50 transition-colors border-b border-neutral-50"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                {exporting ? (
                  <div className="w-5 h-5 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                ) : (
                  <FileDown className="w-5 h-5 text-blue-600" />
                )}
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">Экспорт данных</p>
                <p className="text-xs text-neutral-400">Скачать все данные в Excel</p>
              </div>
            </button>

            <div 
              onClick={handleImportClick}
              className={cn(
                "w-full px-6 py-4 flex items-center gap-4 hover:bg-neutral-50 transition-colors border-b border-neutral-50 cursor-pointer",
                importing && "pointer-events-none opacity-80"
              )}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => handleFileChange(e, false)}
                accept=".csv,.xlsx,.xls"
                className="hidden"
              />
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                importResult?.success ? "bg-theme-primary-light" : "bg-theme-primary-light"
              )}>
                {importing ? (
                  <div className="w-5 h-5 border-2 border-theme-primary/30 border-t-theme-primary rounded-full animate-spin" />
                ) : importResult?.success ? (
                  <CheckCircle2 className="w-5 h-5 text-theme-primary" />
                ) : (
                  <FileUp className="w-5 h-5 text-theme-primary" />
                )}
              </div>
              <div className="text-left flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">
                    {importing ? 'Импорт...' : importResult?.success ? `Импортировано: ${importResult.count}` : 'Импорт данных'}
                  </p>
                  {importLogs.length > 0 && !importing && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowLogModal(true);
                      }}
                      className="p-1.5 hover:bg-orange-100 rounded-lg text-orange-500 transition-all active:scale-90"
                      title="Показать логи"
                    >
                      <AlertCircle size={18} />
                    </button>
                  )}
                </div>
                <p className="text-xs text-neutral-400">Загрузить CSV или Excel файл</p>
                {importing && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-orange-500 h-full transition-all duration-300" 
                          style={{ width: `${importProgress}%` }}
                        />
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStopImport();
                        }}
                        className="px-2 py-1 bg-rose-50 text-rose-600 text-[10px] font-bold rounded-lg hover:bg-rose-100 transition-colors pointer-events-auto"
                      >
                        СТОП
                      </button>
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-2 max-h-32 overflow-y-auto text-[10px] font-mono text-neutral-500 space-y-1">
                      {importLogs.map((log, idx) => (
                        <div key={idx} className="flex gap-2">
                          <span className="text-neutral-300">[{new Date().toLocaleTimeString()}]</span>
                          <span>{log}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div 
              onClick={handleJSONClick}
              className={cn(
                "w-full px-6 py-4 flex items-center gap-4 hover:bg-neutral-50 transition-colors cursor-pointer",
                importing && "pointer-events-none opacity-80"
              )}
            >
              <input
                type="file"
                ref={jsonInputRef}
                onChange={(e) => handleFileChange(e, true)}
                accept=".json"
                className="hidden"
              />
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                importResult?.success ? "bg-theme-primary-light" : "bg-theme-primary-light"
              )}>
                {importing ? (
                  <div className="w-5 h-5 border-2 border-theme-primary/30 border-t-theme-primary rounded-full animate-spin" />
                ) : importResult?.success ? (
                  <CheckCircle2 className="w-5 h-5 text-theme-primary" />
                ) : (
                  <FileUp className="w-5 h-5 text-theme-primary" />
                )}
              </div>
              <div className="text-left flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">
                    {importing ? 'Импорт...' : importResult?.success ? `Импортировано: ${importResult.count}` : 'Импорт из JSON'}
                  </p>
                  {importLogs.length > 0 && !importing && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowLogModal(true);
                      }}
                      className="p-1.5 hover:bg-yellow-100 rounded-lg text-yellow-500 transition-all active:scale-90"
                      title="Показать логи"
                    >
                      <AlertCircle size={18} />
                    </button>
                  )}
                </div>
                <p className="text-xs text-neutral-400">Загрузить .json файл</p>
                {importing && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-yellow-500 h-full transition-all duration-300" 
                          style={{ width: `${importProgress}%` }}
                        />
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStopImport();
                        }}
                        className="px-2 py-1 bg-rose-50 text-rose-600 text-[10px] font-bold rounded-lg hover:bg-rose-100 transition-colors pointer-events-auto"
                      >
                        СТОП
                      </button>
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-2 max-h-32 overflow-y-auto text-[10px] font-mono text-neutral-500 space-y-1">
                      {importLogs.map((log, idx) => (
                        <div key={idx} className="flex gap-2">
                          <span className="text-neutral-300">[{new Date().toLocaleTimeString()}]</span>
                          <span>{log}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* App Settings Section */}
        <section className="space-y-3">
          <h4 className="text-xs font-bold text-theme-primary uppercase tracking-widest px-4">Приложение</h4>
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
              onClick={() => setShowCurrencyTable(true)}
              className="w-full px-6 py-4 flex items-center gap-4 hover:bg-neutral-50 transition-colors border-b border-neutral-50"
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

        <section className="bg-white rounded-3xl border border-neutral-100 overflow-hidden shadow-sm">
          <a href="https://github.com/KNikolaich/AiFinAssistant" target="_blank" className="w-full px-6 py-4 flex items-center gap-4 hover:bg-neutral-50 transition-colors border-b border-neutral-50">
            <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center">
              <Github className="w-5 h-5 text-neutral-600" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm">GitHub</p>
              <p className="text-xs text-neutral-400">Исходный код проекта</p>
            </div>
          </a>
          
          <button className="w-full px-6 py-4 flex items-center gap-4 hover:bg-neutral-50 transition-colors">
            <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center">
              <Info className="w-5 h-5 text-neutral-600" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm">О приложении</p>
              <p className="text-xs text-neutral-400">Версия 1.0.0 (MVP)</p>
            </div>
          </button>
        </section>

        <button 
          onClick={onLogout}
          className="w-full bg-rose-50 text-rose-600 font-bold py-4 rounded-3xl flex items-center justify-center gap-2 hover:bg-rose-100 transition-all active:scale-95"
        >
          <LogOut className="w-5 h-5" />
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}
