import { LogOut, Sparkles, Eraser, FileDown, FileUp, Edit2, Check, Trash2, AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import { UserProfile } from '../types';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import { useDataManagement } from '../hooks/useDataManagement';
import { APP_VERSION } from '../version';

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
    <div className="fixed inset-0 z-[120] bg-neutral-50 flex flex-col">
      <div className="p-4 flex items-center justify-between bg-white border-b border-neutral-100 relative z-[130]">
        <h2 className="text-xl font-bold">Профиль</h2>
        <button 
          onClick={onClose} 
          className="p-2 hover:bg-neutral-100 rounded-full cursor-pointer relative z-[140]"
          aria-label="Закрыть"
        >
          <X className="w-6 h-6 text-neutral-400" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {error && (
          <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-sm">
            {error}
          </div>
        )}
        {/* Profile Card */}
        <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm flex items-center gap-4">
          <button 
            onClick={() => setIsSelectingIcon(!isSelectingIcon)}
            className="w-16 h-16 bg-theme-primary-light rounded-2xl flex items-center justify-center overflow-hidden text-3xl hover:opacity-80 transition-opacity"
          >
            {photoURL ? (
              <span className="text-4xl">{photoURL}</span>
            ) : (
              <div className="w-full h-full bg-theme-primary flex items-center justify-center text-white font-bold text-xl">
                {displayName?.charAt(0) || user.email.charAt(0).toUpperCase()}
              </div>
            )}
          </button>
          
          {isSelectingIcon && (
            <div className="absolute top-24 left-6 bg-white p-4 rounded-2xl shadow-xl border border-neutral-100 grid grid-cols-4 gap-2 z-10">
              {AVATARS.map(avatar => (
                <button key={avatar} onClick={() => { setPhotoURL(avatar); handleSave(); }} className="text-2xl p-2 hover:bg-neutral-100 rounded-lg">
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
                  className="font-bold text-lg border-b-2 border-theme-primary outline-none w-full"
                />
                <button onClick={handleSave} className="p-1 text-theme-primary"><Check /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">{displayName || 'Пользователь'}</h3>
                <button onClick={() => setIsEditingName(true)} className="p-1 text-neutral-400 hover:text-theme-primary"><Edit2 size={16} /></button>
              </div>
            )}
            <p className="text-sm text-neutral-400">{user.email}</p>
          </div>
        </div>

        {/* Data Management Section */}
        <section className="space-y-3">
          <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest px-4">Управление данными</h4>
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

        <button 
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full bg-rose-50 text-rose-600 font-bold py-4 rounded-3xl flex items-center justify-center gap-2 hover:bg-rose-100 transition-all active:scale-95"
        >
          <LogOut className="w-5 h-5" />
          Выйти из аккаунта
        </button>

        {/* Modals */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-white rounded-[32px] p-8 text-center shadow-2xl animate-in zoom-in duration-200 border border-neutral-100">
              <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <LogOut className="w-8 h-8 text-rose-600" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Выйти из аккаунта?</h3>
              <p className="text-neutral-500 mb-8 text-sm">Вы сможете войти снова, используя вашу электронную почту.</p>
              <div className="flex flex-col w-full gap-3">
                <button
                  onClick={onLogout}
                  className="w-full bg-rose-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all active:scale-95"
                >
                  Выйти
                </button>
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="w-full bg-neutral-100 text-neutral-600 font-bold py-4 rounded-2xl hover:bg-neutral-200 transition-all active:scale-95"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}
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
      </div>
    </div>
  );
}
