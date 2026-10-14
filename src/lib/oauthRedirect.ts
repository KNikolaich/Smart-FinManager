import { safeStorage } from './api';

export interface OAuthProviderInfo {
  id: 'google' | 'mailru' | 'vk';
  title: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  cancelled: 'Вход отменён',
  state_mismatch: 'Не удалось подтвердить вход. Попробуйте ещё раз',
  provider_unavailable: 'Этот способ входа сейчас недоступен',
  provider_error: 'Сервис не подтвердил вход. Попробуйте ещё раз или войдите по почте',
};

let pendingError: string | null = null;

/**
 * After signing in through Google / Mail.ru / VK the server sends the browser
 * back to `/#oauth_token=…` (or `/#oauth_error=…`). Called once before the app
 * renders: keeps the token like a normal login and removes it from the address bar.
 */
export function consumeOAuthRedirect(location: Location = window.location, history: History = window.history) {
  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : '';
  if (!hash.includes('oauth_')) return;
  const params = new URLSearchParams(hash);
  const token = params.get('oauth_token');
  const error = params.get('oauth_error');
  if (!token && !error) return;

  if (token) {
    safeStorage.setItem('token', token);
    // The saved offline profile may belong to whoever was signed in before.
    safeStorage.removeItem('last_logged_in_user');
  } else if (error) {
    pendingError = ERROR_MESSAGES[error] || ERROR_MESSAGES.provider_error;
  }
  history.replaceState(null, '', `${location.pathname}${location.search}`);
}

/** The message for a failed outside sign-in, shown once on the login screen. */
export function takeOAuthError(): string | null {
  const error = pendingError;
  pendingError = null;
  return error;
}

export function oauthStartUrl(provider: OAuthProviderInfo['id']): string {
  return `/api/auth/oauth/${provider}/start`;
}
