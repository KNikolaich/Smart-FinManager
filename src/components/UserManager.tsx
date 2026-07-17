import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { UserProfile } from '../types';
import { Trash2, X, AlertTriangle, User, Mail, Calendar, LockOpen, Lock } from 'lucide-react';
import { cn } from '../lib/utils';

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

  if (loading) return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="text-white font-black uppercase tracking-widest animate-pulse">Загрузка пользователей...</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 lg:p-8 bg-black/80 backdrop-blur-xl">
      <div className="relative w-full h-full lg:h-auto lg:max-w-4xl bg-theme-main lg:rounded-xl lg:border border-neutral-100 shadow-2xl flex flex-col animate-in fade-in zoom-in duration-300 shadow-black/50 overflow-hidden">
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
