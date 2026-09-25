import { useState, useRef } from 'react';
import { addDemoCalendarData, generateDemoData } from '../services/demoDataService';
import { importFinancialData } from '../services/importService';
import { api, clearLocalUserDataAfterReset } from '../lib/api';
import * as XLSX from 'xlsx';
import { UserProfile } from '../types';

export function useDataManagement(user: UserProfile, onRefresh: () => void, onLogout: () => void) {
  const [seeding, setSeeding] = useState(false);
  const [seedProgress, setSeedProgress] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showClearTransactionsConfirm, setShowClearTransactionsConfirm] = useState(false);
  const [showClearAllDataConfirm, setShowClearAllDataConfirm] = useState(false);
  const [clearAllDataError, setClearAllDataError] = useState<string | null>(null);
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);
  const [password, setPassword] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [showLogModal, setShowLogModal] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; count: number } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        controller.signal,
        { isAdmin: user.role === 'admin' },
      );
      if (result.success) {
        setImportResult({ success: true, count: result.count });
        onRefresh();
      } else if (result.errors.length > 0) {
        const wasCancelled = result.errors.includes('Import cancelled');
        setImportLogs(prev => [
          ...prev,
          ...(wasCancelled
            ? ['⚠️ Импорт остановлен пользователем']
            : result.errors.map(message => `Ошибка: ${message}`)),
        ]);
        if (!wasCancelled) alert('Ошибка при импорте данных');
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
      if (fileInputRef.current) fileInputRef.current.value = '';
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
    setSeedProgress('Начинаем...');
    setSuccess(false);
    try {
      await generateDemoData(user.id, (message) => setSeedProgress(message));
      setSuccess(true);
      onRefresh();
      setShowSeedConfirm(false);
      setPassword('');
      setTimeout(() => { setSuccess(false); setSeedProgress(null); }, 3000);
    } catch (error) {
      console.error('Seed error:', error);
      setSeedProgress(null);
    } finally {
      setSeeding(false);
    }
  };

  const seedCalendarOnly = async () => {
    if (!(await verifyPassword())) return;
    setSeeding(true);
    setSeedProgress('Добавляем пропущенные планы и заметки...');
    setSuccess(false);
    try {
      await addDemoCalendarData(user.id, (message) => setSeedProgress(message));
      setSuccess(true);
      onRefresh();
      setPassword('');
      setTimeout(() => { setSuccess(false); setSeedProgress(null); }, 5000);
    } catch (error) {
      console.error('Demo calendar seed error:', error);
      setSeedProgress(error instanceof Error ? error.message : 'Не удалось добавить планы в календарь');
    } finally {
      setSeeding(false);
    }
  };

  const deleteAccount = async () => {
    if (!(await verifyPassword())) return;
    setClearing(true);
    try {
      await api.delete('/user/delete-account');
      onLogout();
    } catch (error) {
      console.error('Delete account error:', error);
      alert('Ошибка при удалении аккаунта');
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

  const clearAllUserData = async () => {
    if (!password) {
      setClearAllDataError('Введите пароль для подтверждения.');
      return;
    }

    setClearing(true);
    setClearAllDataError(null);
    try {
      await api.postDirect('/data/clear-all', { password });
      clearLocalUserDataAfterReset();
      onRefresh();
      setShowClearAllDataConfirm(false);
      setPassword('');
    } catch (error) {
      console.error('Clear all user data error:', error);
      setClearAllDataError(
        error instanceof Error ? error.message : 'Не удалось очистить данные. Попробуйте ещё раз.',
      );
    } finally {
      setClearing(false);
    }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const endpoint = user.role === 'admin' ? '/admin/backup/export' : '/backup/export';
      const backupData = await api.get<Record<string, any>>(endpoint);

      const date = new Date().toISOString().split('T')[0];
      const fileName = `backupAiFinAssistant_${date}.json`;
      
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
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

  return {
    seeding, seedProgress, success, clearing, showClearConfirm, setShowClearConfirm,
    showClearTransactionsConfirm, setShowClearTransactionsConfirm,
    showClearAllDataConfirm, setShowClearAllDataConfirm, clearAllDataError, setClearAllDataError,
    showSeedConfirm, setShowSeedConfirm,
    password, setPassword, exporting, importing, importProgress, importLogs, showLogModal, setShowLogModal,
    importResult, fileInputRef, handleImportClick, handleFileChange, seedInitialData, seedCalendarOnly, deleteAccount,
    clearAllUserData,
    clearTransactionsOnly, exportData, copyLogsToClipboard
  };
}
