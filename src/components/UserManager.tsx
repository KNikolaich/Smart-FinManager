import React, { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { UserProfile } from '../types';
import { Trash2, X, AlertTriangle, User, Mail, Calendar, LockOpen, Lock, Upload } from 'lucide-react';
import { cn } from '../lib/utils';

type PendingBackupRestore = {
  target: UserProfile;
  fileName: string;
  archive: Record<string, any>;
};

export const UserManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [sendPassTarget, setSendPassTarget] = useState<UserProfile | null>(null);
  const [targetEmail, setTargetEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [sending, setSending] = useState(false);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [pendingRestore, setPendingRestore] = useState<PendingBackupRestore | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const restoreTargetRef = useRef<UserProfile | null>(null);

  const fetchUsers = async () => {
    try {
      const data = await api.get<UserProfile[]>('/admin/users');
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  const handleDeleteUser = async (id: string) => {
    setDeleting(true);
    try {
      await api.delete(`/admin/users/${id}`);
      setDeleteConfirmId(null);
      await fetchUsers();
      setStatusMessage({ text: 'Пользователь удален', type: 'success' });
    } catch (error) {
      console.error('Error deleting user:', error);
      setStatusMessage({ text: 'Ошибка удаления', type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const handleUnlockUser = async (id: string) => {
    setUnlockingId(id);
    try {
      await api.post(`/admin/users/${id}/unlock`, {});
      await fetchUsers();
      setStatusMessage({ text: 'Аккаунт разблокирован', type: 'success' });
    } catch (error) {
      console.error('Error unlocking user:', error);
      setStatusMessage({ text: 'Ошибка разблокировки', type: 'error' });
    } finally {
      setUnlockingId(null);
    }
  };

  const handleSendPassword = async () => {
    if (!sendPassTarget) return;
    setSending(true);
    try {
      await api.post(`/admin/users/${sendPassTarget.id}/send-password`, { email: targetEmail });
      setSendPassTarget(null);
      setStatusMessage({ text: 'Пароль отправлен', type: 'success' });
    } catch (error: any) {
      console.error('Error sending password:', error);
      setStatusMessage({ text: error.response?.data?.error || 'Ошибка отправки', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const openRestorePicker = (target: UserProfile) => {
    restoreTargetRef.current = target;
    if (restoreInputRef.current) {
      restoreInputRef.current.value = '';
      restoreInputRef.current.click();
    }
  };

  const handleRestoreFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const target = restoreTargetRef.current;
    restoreTargetRef.current = null;
    event.target.value = '';
    if (!file || !target) return;

    if (file.size > 100 * 1024 * 1024) {
      setStatusMessage({ text: 'Размер архива превышает 100 МБ', type: 'error' });
      return;
    }

    try {
      const archive = JSON.parse(await file.text());
      if (
        archive?.format !== 'ai-fin-assistant-backup' ||
        archive?.version !== 2 ||
        !['user', 'admin'].includes(archive?.scope)
      ) {
        setStatusMessage({ text: 'Формат резервной копии не поддерживается', type: 'error' });
        return;
      }
      setPendingRestore({ target, fileName: file.name, archive });
    } catch {
      setStatusMessage({ text: 'Не удалось прочитать JSON-файл резервной копии', type: 'error' });
    }
  };

  const confirmBackupRestore = async () => {
    if (!pendingRestore) return;
    const { target, archive } = pendingRestore;
    setRestoringId(target.id);
    try {
      const result = await api.post<{ restoredCounts?: Record<string, number> }>(
        `/admin/users/${target.id}/backup/restore`,
        archive,
      );
      const totalRestored = Object.values(result?.restoredCounts || {}).reduce(
        (sum, count) => sum + (Number.isFinite(count) ? count : 0),
        0,
      );
      setPendingRestore(null);
      await fetchUsers();
      setStatusMessage({ text: `Данные восстановлены. Записей: ${totalRestored}`, type: 'success' });
    } catch (error: any) {
      setStatusMessage({
        text: error.response?.data?.error || 'Не удалось восстановить данные пользователя',
        type: 'error',
      });
    } finally {
      setRestoringId(null);
    }
  };

  if (loading) return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="text-white font-black uppercase tracking-widest animate-pulse">Загрузка пользователей...</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 lg:p-8 bg-black/80 backdrop-blur-xl">
      <div className="relative w-full h-full lg:h-auto lg:max-w-4xl bg-theme-main lg:rounded-xl lg:border border-neutral-100 shadow-2xl flex flex-col animate-in fade-in zoom-in duration-300 shadow-black/50 overflow-hidden">
        <input
          ref={restoreInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleRestoreFileChange}
        />
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-theme-surface/10 backdrop-blur-sm shrink-0">
          <h3 className="text-sm font-black uppercase tracking-widest text-theme-main">Управление пользователями</h3>
          <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-theme-surface text-theme-muted hover:text-rose-500 hover:bg-rose-500/10 transition-all border border-theme-base/50"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 lg:p-6 no-scrollbar bg-theme-main">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {users.map((u) => (
              <div key={u.id} className="bg-theme-surface border border-theme-base rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-shadow group relative">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-theme-primary-light flex items-center justify-center text-theme-primary shrink-0 overflow-hidden">
                    {u.photoURL ? (
                      <img src={u.photoURL} alt={u.displayName || u.email} className="w-full h-full object-cover" />
                    ) : (
                      <User size={24} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                       <h4 className="font-black text-theme-main truncate">{u.displayName || 'Без имени'}</h4>
                       {u.role === 'admin' && (
                         <span className="px-1.5 py-0.5 bg-rose-100 text-rose-600 text-[8px] font-black uppercase rounded tracking-widest">Admin</span>
                       )}
                       {u.isLockedOut && (
                         <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-black uppercase rounded tracking-widest flex items-center gap-0.5">
                           <Lock size={8} />
                           Заблокирован
                         </span>
                       )}
                    </div>
                    <div className="flex items-center gap-1.5 text-theme-muted text-xs font-medium truncate">
                      <Mail size={12} />
                      {u.email}
                    </div>
                    <div className="flex items-center gap-1.5 text-theme-muted/60 text-[10px] font-bold mt-1">
                      <Calendar size={10} />
                      Регистрация: {new Date(u.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-theme-base flex items-center justify-between">
                  <span className="text-[10px] font-mono text-theme-muted/40 uppercase">ID: {u.id.substring(0, 8)}...</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openRestorePicker(u)}
                      disabled={restoringId !== null}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-theme-primary/20 px-2.5 py-2 text-[10px] font-bold text-theme-primary hover:bg-theme-primary/10 transition-colors disabled:opacity-50"
                      title="Восстановить данные из резервной копии"
                    >
                      <Upload size={15} />
                      Восстановить
                    </button>
                    {u.isLockedOut && (
                      <button
                        onClick={() => handleUnlockUser(u.id)}
                        disabled={unlockingId === u.id}
                        className="p-2 text-amber-500 hover:text-amber-600 hover:bg-amber-50 transition-colors rounded-lg disabled:opacity-50"
                        title="Разблокировать аккаунт"
                      >
                        <LockOpen size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSendPassTarget(u);
                        setTargetEmail(u.email);
                      }}
                      className="p-2 text-theme-muted hover:text-theme-primary hover:bg-theme-primary/10 transition-colors rounded-lg"
                      title="Отправить пароль на почту"
                    >
                      <Mail size={18} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(u.id)}
                      className="p-2 text-theme-muted hover:text-rose-500 hover:bg-rose-50 transition-colors rounded-lg"
                      title="Удалить пользователя"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Status Notifications */}
      {statusMessage && (
        <div className={cn(
          "fixed bottom-8 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 rounded-full shadow-2xl font-black uppercase tracking-widest text-[10px] animate-in slide-in-from-bottom-4 duration-300",
          statusMessage.type === 'success' ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
        )}>
          {statusMessage.text}
        </div>
      )}

      {/* Admin backup restore confirmation */}
      {pendingRestore && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <div className="relative w-full max-w-lg bg-theme-main rounded-xl border border-neutral-100 shadow-2xl flex flex-col animate-in fade-in zoom-in duration-300">
            <div className="p-6 space-y-5">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 shrink-0">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-theme-main">Восстановить данные?</h3>
                  <p className="text-sm text-theme-muted mt-1">
                    Целевой аккаунт: <span className="font-bold text-theme-main">{pendingRestore.target.displayName || pendingRestore.target.email}</span>
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-sm text-theme-muted">
                <p className="break-all">Файл: {pendingRestore.fileName}</p>
                <p>
                  Все личные данные выбранного аккаунта будут заменены данными архива.
                  Email, пароль и роль аккаунта останутся прежними.
                </p>
                <p>
                  Общая история курсов не заменяется. Если архив содержит валюты,
                  которых нет в справочнике, они будут добавлены без изменения уже существующих валют.
                </p>
                <p className="font-bold text-amber-600">Это действие нельзя отменить.</p>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-2">
                <button
                  onClick={() => setPendingRestore(null)}
                  disabled={restoringId !== null}
                  className="flex-1 rounded-lg border border-theme-base bg-theme-surface px-4 py-3 text-sm font-bold text-theme-muted hover:text-theme-main transition-colors disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  onClick={confirmBackupRestore}
                  disabled={restoringId !== null}
                  className="flex-1 rounded-lg bg-rose-600 px-4 py-3 text-sm font-bold text-white hover:bg-rose-700 transition-colors disabled:opacity-50"
                >
                  {restoringId === pendingRestore.target.id ? 'Восстановление...' : 'Заменить данные'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Password Modal */}
      {sendPassTarget && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <div className="relative w-full max-w-sm bg-theme-main rounded-xl border border-neutral-100 shadow-2xl flex flex-col animate-in fade-in zoom-in duration-300">
            <div className="p-8 space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-theme-primary/10 rounded-2xl flex items-center justify-center text-theme-primary mx-auto mb-4">
                  <Mail size={32} />
                </div>
                <h3 className="text-lg font-black uppercase tracking-widest text-theme-main">Отправить пароль</h3>
                <p className="text-[10px] text-theme-muted font-bold mt-1 uppercase tracking-tight">
                  Пользователь: {sendPassTarget.displayName || sendPassTarget.email}
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-theme-muted ml-1">Email для отправки</label>
                  <input
                    type="email"
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                    className="w-full bg-theme-surface border border-theme-base rounded-lg px-4 py-3 outline-none focus:border-theme-primary transition-colors text-sm font-bold"
                    placeholder="example@mail.com"
                  />
                </div>
                
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg">
                  <div className="flex gap-3">
                    <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                    <p className="text-[10px] text-amber-700 font-bold leading-relaxed">
                      Пароль будет расшифрован и отправлен в открытом виде на указанный адрес.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button 
                  onClick={handleSendPassword} 
                  disabled={sending || !targetEmail}
                  className="w-full py-4 bg-theme-primary text-theme-on-primary rounded-lg font-black uppercase tracking-widest text-[10px] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-theme-primary/30 disabled:opacity-50"
                >
                  {sending ? 'Отправка...' : 'Отправить'}
                </button>
                <button 
                  onClick={() => setSendPassTarget(null)} 
                  disabled={sending}
                  className="w-full py-4 bg-theme-surface border border-neutral-100 text-theme-muted hover:text-theme-main rounded-lg font-black uppercase tracking-widest text-[10px] transition-all"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <div className="relative w-full max-w-sm bg-theme-main rounded-xl border border-neutral-100 shadow-2xl flex flex-col animate-in fade-in zoom-in duration-300">
            <div className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mx-auto shadow-sm">
                <AlertTriangle size={40} />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-widest text-theme-main">Удалить пользователя?</h3>
                <p className="text-xs text-theme-muted font-bold mt-2">
                  Это действие каскадно удалит все данные пользователя (счета, операции, цели) и не может быть отменено.
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button 
                  onClick={() => handleDeleteUser(deleteConfirmId)} 
                  disabled={deleting}
                  className="w-full py-4 bg-rose-500 text-white rounded-lg font-black uppercase tracking-widest text-[10px] hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50"
                >
                  {deleting ? 'Удаление...' : 'Удалить навсегда'}
                </button>
                <button 
                  onClick={() => setDeleteConfirmId(null)} 
                  disabled={deleting}
                  className="w-full py-4 bg-theme-surface border border-neutral-100 text-theme-muted hover:text-theme-main rounded-lg font-black uppercase tracking-widest text-[10px] transition-all"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
