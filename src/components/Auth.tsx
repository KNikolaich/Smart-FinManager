import { useState, useRef } from 'react';
import { api } from '../lib/api';
import { LogIn, UserPlus, Mail, Lock, AlertCircle } from 'lucide-react';
import { UserProfile } from '../types';

interface AuthProps {
  onAuth: (user: UserProfile) => void;
}

export default function Auth({ onAuth }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Введите email для восстановления пароля');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const response = await api.post<{ message: string }>('/auth/forgot-password', { email });
      setSuccess(response.message);
    } catch (err: any) {
      setError(err.message || 'Ошибка при восстановлении пароля');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      passwordRef.current?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const data = await api.post<{ token: string; user: UserProfile }>(endpoint, { email, password });
      localStorage.setItem('token', data.token);
      onAuth(data.user);
    } catch (err: any) {
      console.error('Auth error:', err);
      let errorMessage = 'Ошибка авторизации';
      
      const message = err.message || '';
      if (message.includes('{')) {
        try {
          const potentialJson = message.substring(message.indexOf('{'));
          const errorData = JSON.parse(potentialJson);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          errorMessage = message;
        }
      } else {
        errorMessage = message;
      }
      
      // Clean up common technical prefixes and translate
      errorMessage = errorMessage.replace(/^Expected JSON but received .*?: /, '');
      
      const translations: Record<string, string> = {
        'Invalid credentials': 'Неверный логин или пароль',
        'Email and password are required': 'Введите email и пароль',
        'Email already exists': 'Пользователь с таким email уже существует',
        'User not found': 'Пользователь не найден',
        'Unauthorized': 'Неавторизован',
        'Session expired. Please log in again.': 'Сессия истекла. Пожалуйста, войдите снова.'
      };
      
      errorMessage = translations[errorMessage] || errorMessage;
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-theme-main p-4">
      <div className="w-full max-w-md bg-theme-surface rounded-[32px] shadow-2xl overflow-hidden p-8 border border-theme-base">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-theme-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-theme-primary-light">
            {isLogin ? <LogIn className="text-theme-on-primary w-8 h-8" /> : <UserPlus className="text-theme-on-primary w-8 h-8" />}
          </div>
          <h1 className="text-2xl font-bold text-theme-main font-sans tracking-tight">
            {isLogin ? 'С возвращением' : 'Создать аккаунт'}
          </h1>
          <p className="text-theme-muted text-sm mt-2">
            {isLogin ? 'Войдите в свой аккаунт' : 'Зарегистрируйтесь, чтобы начать'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-rose-500 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-500 text-sm">
              <div className="w-5 h-5 shrink-0 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[10px]">✓</div>
              <p>{success}</p>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-theme-muted uppercase tracking-wider ml-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-muted" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleEmailKeyDown}
                className="w-full bg-theme-main border border-theme-base rounded-2xl pl-12 pr-4 py-3.5 outline-none focus:ring-2 ring-theme-primary/20 transition-all text-theme-main"
                placeholder="your@email.com"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-theme-muted uppercase tracking-wider ml-1">Пароль</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-muted" />
              <input
                type="password"
                required
                ref={passwordRef}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-theme-main border border-theme-base rounded-2xl pl-12 pr-4 py-3.5 outline-none focus:ring-2 ring-theme-primary/20 transition-all text-theme-main"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-theme-primary hover:bg-theme-primary-dark text-theme-on-primary font-bold py-4 rounded-2xl shadow-lg shadow-theme-primary-light transition-all disabled:opacity-50 mt-4 active:scale-[0.98]"
          >
            {loading ? 'Загрузка...' : isLogin ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>

        <div className="mt-8 text-center space-y-3">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-theme-muted text-sm hover:text-theme-primary transition-colors font-medium block w-full"
          >
            {isLogin ? 'Нет аккаунта? Зарегистрируйтесь' : 'Уже есть аккаунт? Войдите'}
          </button>
          
          {isLogin && (
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-[10px] font-bold text-theme-primary hover:underline"
            >
              Забыли пароль?
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
