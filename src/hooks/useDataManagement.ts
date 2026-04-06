import { useState, useRef } from 'react';
import { generateDemoData } from '../services/demoDataService';
import { importFinancialData } from '../services/importService';
import { api } from '../lib/api';
import * as XLSX from 'xlsx';
import { UserProfile } from '../types';

export function useDataManagement(user: UserProfile, onRefresh: () => void) {
  const [seeding, setSeeding] = useState(false);
  const [seedProgress, setSeedProgress] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showClearTransactionsConfirm, setShowClearTransactionsConfirm] = useState(false);
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
      
      // Export plans separately
      try {
        const plansData = await api.get<any>('/plan-grid');
        if (plansData) {
          const blob = new Blob([JSON.stringify(plansData, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `plans_${new Date().toISOString().split('T')[0]}.json`;
          a.click();
          URL.revokeObjectURL(url);
          hasData = true;
        }
      } catch (err) {
        console.error('Error exporting plans:', err);
      }
      
      for (const col of collections) {
        try {
          const data = await api.get<any>(col.endpoint);
          const exportData = Array.isArray(data) ? data : [];
          if (exportData && exportData.length > 0) {
            const worksheet = XLSX.utils.json_to_sheet(exportData);
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

  return {
    seeding, seedProgress, success, clearing, showClearConfirm, setShowClearConfirm,
    showClearTransactionsConfirm, setShowClearTransactionsConfirm, showSeedConfirm, setShowSeedConfirm,
    password, setPassword, exporting, importing, importProgress, importLogs, showLogModal, setShowLogModal,
    importResult, fileInputRef, handleImportClick, handleFileChange, seedInitialData, clearAllData,
    clearTransactionsOnly, exportData, copyLogsToClipboard
  };
}
