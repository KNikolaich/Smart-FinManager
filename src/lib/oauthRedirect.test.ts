import { beforeEach, describe, expect, it } from 'vitest';
import { consumeOAuthRedirect, takeOAuthError } from './oauthRedirect';

describe('consumeOAuthRedirect', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  it('keeps the token from the address and removes it from the address bar', () => {
    localStorage.setItem('last_logged_in_user', '{"id":"someone-else"}');
    window.history.replaceState(null, '', '/?tab=1#oauth_token=abc.def.ghi');

    consumeOAuthRedirect();

    expect(localStorage.getItem('token')).toBe('abc.def.ghi');
    expect(localStorage.getItem('last_logged_in_user')).toBeNull();
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('?tab=1');
    expect(takeOAuthError()).toBeNull();
  });

  it('turns an error code into a message shown once', () => {
    window.history.replaceState(null, '', '/#oauth_error=cancelled');

    consumeOAuthRedirect();

    expect(localStorage.getItem('token')).toBeNull();
    expect(window.location.hash).toBe('');
    expect(takeOAuthError()).toBe('Вход отменён');
    expect(takeOAuthError()).toBeNull();
  });

  it('leaves other address fragments alone', () => {
    window.history.replaceState(null, '', '/#section');

    consumeOAuthRedirect();

    expect(window.location.hash).toBe('#section');
    expect(localStorage.getItem('token')).toBeNull();
  });
});
