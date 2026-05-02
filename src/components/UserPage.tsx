import { LogOut, Sparkles, Eraser, FileDown, FileUp, Edit2, Check, Trash2, AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import { UserProfile } from '../types';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import { useDataManagement } from '../hooks/useDataManagement';

interface UserPageProps {
  user: UserProfile;
  onLogout: () => void;
  onClose: () => void;
  onUpdateUser: (updatedUser: UserProfile) => void;
  onRefresh: () => void;
}

const AVATARS = ['👤', '👨', '👩', '🧑', '🧔', '👱', '👩‍🦰', '👨‍🦰'];

export default function UserPage({ user, onLogout, onClose, onUpdateUser, onRefresh }: UserPageProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [isSelectingIcon, setIsSelectingIcon] = useState(false);
  const [photoURL, setPhotoURL] = useState(user.photoURL || '');
  const [error, setError] = useState<string | null>(null);

  const {
    seeding, showSeedConfirm, setShowSeedConfirm, password, setPassword, seedInitialData,
    showClearConfirm, setShowClearConfirm, clearAllData, showClearTransactionsConfirm,
    setShowClearTransactionsConfirm, clearTransactionsOnly, exporting, exportData,
    fileInputRef, handleImportClick, handleFileChange, clearing
  } = useDataManagement(user, onRefresh);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleSave = async () => {
    setError(null);
    try {
      const updatedUser = await api.put<UserProfile>('/auth/me', { displayName, photoURL });
      onUpdateUser(updatedUser);
      setIsEditingName(false);
      setIsSelectingIcon(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      setError(error instanceof Error ? error.message : 'Неизвестная ошибка при обновлении профиля');
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-theme-main flex flex-col">
      <div className="p-4 flex items-center justify-between bg-theme-surface border-b border-theme-base relative z-[130]">
        <h2 className="text-xl font-bold text-theme-main">Профиль</h2>
        <button 
          onClick={onClose} 
          className="p-2 hover:bg-theme-main rounded-full cursor-pointer relative z-[140]"
          aria-label="Закрыть"
        >
          <X className="w-6 h-6 text-theme-muted" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {error && (
          <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-sm">
            {error}
          </div>
        )}
        {/* Profile Card */}
        <div className="bg-theme-surface p-6 rounded-3xl border border-theme-base shadow-sm flex items-center gap-4">
          <button 
            onClick={() => setIsSelectingIcon(!isSelectingIcon)}
            className="w-16 h-16 bg-theme-primary-light rounded-2xl flex items-center justify-center overflow-hidden text-3xl hover:opacity-80 transition-opacity"
          >
            {photoURL ? (
              <span className="text-4xl">{photoURL}</span>
            ) : (
              <div className="w-full h-full bg-theme-primary flex items-center justify-center text-theme-on-primary font-bold text-xl">
                {displayName?.charAt(0) || user.email.charAt(0).toUpperCase()}
              </div>
            )}
          </button>
          
          {isSelectingIcon && (
            <div className="absolute top-24 left-6 bg-theme-surface p-4 rounded-2xl shadow-xl border border-theme-base grid grid-cols-4 gap-2 z-10">
              {AVATARS.map(avatar => (
                <button key={avatar} onClick={() => { setPhotoURL(avatar); handleSave(); }} className="text-2xl p-2 hover:bg-theme-main rounded-lg">
                  {avatar}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input 
                  value={displayName} 
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="font-bold text-lg border-b-2 border-theme-primary outline-none w-full bg-transparent text-theme-main"
                />
                <button onClick={handleSave} className="p-1 text-theme-primary"><Check /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-theme-main">{displayName || 'Пользователь'}</h3>
                <button onClick={() => setIsEditingName(true)} className="p-1 text-theme-muted hover:text-theme-primary"><Edit2 size={16} /></button>
              </div>
            )}
            <p className="text-sm text-theme-muted">{user.email}</p>
          </div>
        </div>

        {/* Data Management Section */}
        <section className="space-y-3">
          <h4 className="text-xs font-bold text-theme-muted uppercase tracking-widest px-4">Управление данными</h4>
          <div className="bg-theme-surface rounded-3xl border border-theme-base overflow-hidden shadow-sm">
            <button 
              onClick={() => setShowSeedConfirm(true)}
              className="w-full px-6 py-4 flex items-center gap-4 hover:bg-theme-main transition-colors border-b border-theme-base"
            >
              <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-amber-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-theme-main">Создать демо-данные</p>
                <p className="text-xs text-theme-muted">Добавить примеры операций</p>
              </div>
            </button>

            <button 
              onClick={exportData}
              disabled={exporting}
              className="w-full px-6 py-4 flex items-center gap-4 hover:bg-theme-main transition-colors border-b border-theme-base"
            >
              <div className="w-10 h-10 bg-sky-500/10 rounded-xl flex items-center justify-center">
                <FileDown className="w-5 h-5 text-sky-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-theme-main">Экспорт данных</p>
                <p className="text-xs text-theme-muted">Скачать резервную копию (Excel)</p>
              </div>
            </button>

            <button 
              onClick={handleImportClick}
              className="w-full px-6 py-4 flex items-center gap-4 hover:bg-theme-main transition-colors border-b border-theme-base"
            >
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx,.xls" />
              <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                <FileUp className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-theme-main">Импорт данных</p>
                <p className="text-xs text-theme-muted">Загрузить данные из Excel</p>
              </div>
            </button>

            <button 
              onClick={() => setShowClearTransactionsConfirm(true)}
              className="w-full px-6 py-4 flex items-center gap-4 hover:bg-theme-main transition-colors border-b border-theme-base"
            >
              <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-theme-main">Стереть операции</p>
                <p className="text-xs text-theme-muted">Удалить только транзакции</p>
              </div>
            </button>

            <button 
              onClick={() => setShowClearConfirm(true)}
              className="w-full px-6 py-4 flex items-center gap-4 hover:bg-theme-main transition-colors"
            >
              <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center">
                <Eraser className="w-5 h-5 text-rose-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-theme-main">Стереть все данные</p>
                <p className="text-xs text-rose-500 font-medium">Полная очистка аккаунта</p>
              </div>
            </button>
          </div>
        </section>

        <button 
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full bg-rose-500/10 text-rose-500 font-bold py-4 rounded-3xl flex items-center justify-center gap-2 hover:bg-rose-500/20 transition-all active:scale-95"
        >
          <LogOut className="w-5 h-5" />
          Выйти из аккаунта
        </button>

        {/* Modals */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-theme-surface rounded-[32px] p-8 text-center shadow-2xl animate-in zoom-in duration-200 border border-theme-base">
              <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <LogOut className="w-8 h-8 text-rose-500" />
              </div>
              <h3 className="text-xl font-bold text-theme-main mb-2">Выйти из аккаунта?</h3>
              <p className="text-theme-muted mb-8 text-sm">Вы сможете войти снова, используя вашу электронную почту.</p>
              <div className="flex flex-col w-full gap-3">
                <button
                  onClick={onLogout}
                  className="w-full bg-rose-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all active:scale-95"
                >
                  Выйти
                </button>
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="w-full bg-theme-main text-theme-muted font-bold py-4 rounded-2xl hover:bg-theme-base transition-all active:scale-95"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}
        {showSeedConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-theme-surface rounded-[32px] p-8 text-center shadow-2xl animate-in zoom-in duration-200 border border-theme-base">
              <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="text-xl font-bold text-theme-main mb-2">Создать демо-данные?</h3>
              <p className="text-theme-muted mb-8 text-sm">Будут добавлены 3 карты и операции за 3 месяца.</p>
              <input
                type="password"
                placeholder="Введите пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-theme-main p-4 rounded-2xl mb-4 text-center border border-theme-base outline-none focus:ring-2 ring-theme-primary/20 text-theme-main"
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
                  className="w-full bg-theme-main text-theme-muted font-bold py-4 rounded-2xl hover:bg-theme-base transition-all active:scale-95"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}

        {showClearConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-theme-surface rounded-[32px] p-8 text-center shadow-2xl animate-in zoom-in duration-200 border border-theme-base">
              <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-rose-500" />
              </div>
              <h3 className="text-xl font-bold text-theme-main mb-2">Очистить абсолютно всё?</h3>
              <p className="text-theme-muted mb-8 text-sm">Все ваши счета, операции, категории и цели будут удалены навсегда. Это действие необратимо.</p>
              <input
                type="password"
                placeholder="Введите пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-theme-main p-4 rounded-2xl mb-4 text-center border border-theme-base outline-none focus:ring-2 ring-theme-primary/20 text-theme-main"
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
                  className="w-full bg-theme-main text-theme-muted font-bold py-4 rounded-2xl hover:bg-theme-base transition-all active:scale-95"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}

        {showClearTransactionsConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-theme-surface rounded-[32px] p-8 text-center shadow-2xl animate-in zoom-in duration-200 border border-theme-base">
              <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold text-theme-main mb-2">Удалить только операции?</h3>
              <p className="text-theme-muted mb-8 text-sm">Все записи о доходах и расходах будут удалены. Счета, категории и цели останутся.</p>
              <input
                type="password"
                placeholder="Введите пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-theme-main p-4 rounded-2xl mb-4 text-center border border-theme-base outline-none focus:ring-2 ring-theme-primary/20 text-theme-main"
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
                  className="w-full bg-theme-main text-theme-muted font-bold py-4 rounded-2xl hover:bg-theme-base transition-all active:scale-95"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
