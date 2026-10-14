/**
 * Sign-in through outside services: Google, Mail.ru and VK ID.
 * Each provider is on only when its keys are set in the environment.
 */

export type OAuthProviderId = "google" | "mailru" | "vk";

export interface OAuthProfile {
  provider: OAuthProviderId;
  providerUserId: string;
  email: string | null;
  /** The service confirmed the person owns this email, so it may join an existing account. */
  emailVerified: boolean;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface OAuthCallbackParams {
  code: string;
  redirectUri: string;
  codeVerifier: string;
  state: string;
  /** VK ID only: the device id sent back with the code. */
  deviceId?: string;
}

interface OAuthProvider {
  id: OAuthProviderId;
  title: string;
  isConfigured(): boolean;
  authorizeUrl(params: { redirectUri: string; state: string; codeChallenge: string }): string;
  fetchProfile(params: OAuthCallbackParams): Promise<OAuthProfile>;
}

function env(name: string): string {
  return (process.env[name] || "").trim();
}

async function readJson(response: Response, what: string): Promise<any> {
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // keep body null, the error below says what came back
  }
  if (!response.ok || !body || body.error) {
    const reason = body?.error_description || body?.error?.message || body?.error || text.slice(0, 200);
    throw new Error(`${what} failed (${response.status}): ${reason}`);
  }
  return body;
}

function postForm(url: string, fields: Record<string, string>, headers: Record<string, string> = {}) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", ...headers },
    body: new URLSearchParams(fields).toString(),
    signal: AbortSignal.timeout(10000),
  });
}

function fullName(...parts: Array<string | null | undefined>): string | null {
  const name = parts.map(part => (part || "").trim()).filter(Boolean).join(" ");
  return name || null;
}

const google: OAuthProvider = {
  id: "google",
  title: "Google",
  isConfigured: () => Boolean(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET")),
  authorizeUrl({ redirectUri, state, codeChallenge }) {
    const query = new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${query}`;
  },
  async fetchProfile({ code, redirectUri, codeVerifier }) {
    const tokens = await readJson(await postForm("https://oauth2.googleapis.com/token", {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      code_verifier: codeVerifier,
    }), "Google token exchange");
    const info = await readJson(await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(10000),
    }), "Google profile");
    // "=s96-c" at the end of a Google photo link is its size; ask for a 256 px square instead.
    const picture: string | null = info.picture ? String(info.picture).replace(/=s\d+(-c)?$/, "=s256-c") : null;
    return {
      provider: "google",
      providerUserId: String(info.sub),
      email: info.email || null,
      emailVerified: info.email_verified === true,
      displayName: info.name || fullName(info.given_name, info.family_name),
      avatarUrl: picture,
    };
  },
};

const mailru: OAuthProvider = {
  id: "mailru",
  title: "Mail.ru",
  isConfigured: () => Boolean(env("MAILRU_CLIENT_ID") && env("MAILRU_CLIENT_SECRET")),
  authorizeUrl({ redirectUri, state }) {
    const query = new URLSearchParams({
      client_id: env("MAILRU_CLIENT_ID"),
      response_type: "code",
      scope: "userinfo",
      redirect_uri: redirectUri,
      state,
    });
    return `https://oauth.mail.ru/login?${query}`;
  },
  async fetchProfile({ code, redirectUri }) {
    const basic = Buffer.from(`${env("MAILRU_CLIENT_ID")}:${env("MAILRU_CLIENT_SECRET")}`).toString("base64");
    const tokens = await readJson(await postForm("https://oauth.mail.ru/token", {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }, { Authorization: `Basic ${basic}` }), "Mail.ru token exchange");
    const info = await readJson(await fetch(
      `https://oauth.mail.ru/userinfo?access_token=${encodeURIComponent(tokens.access_token)}`,
      { signal: AbortSignal.timeout(10000) },
    ), "Mail.ru profile");
    return {
      provider: "mailru",
      providerUserId: String(info.id),
      email: info.email || null,
      // Mail.ru signs people in with the mailbox itself, so the address is theirs.
      emailVerified: Boolean(info.email),
      displayName: info.name || fullName(info.first_name, info.last_name),
      avatarUrl: info.image || null,
    };
  },
};

const vk: OAuthProvider = {
  id: "vk",
  title: "VK",
  isConfigured: () => Boolean(env("VK_CLIENT_ID")),
  authorizeUrl({ redirectUri, state, codeChallenge }) {
    const query = new URLSearchParams({
      response_type: "code",
      client_id: env("VK_CLIENT_ID"),
      redirect_uri: redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "s256",
      scope: "email",
    });
    return `https://id.vk.com/authorize?${query}`;
  },
  async fetchProfile({ code, redirectUri, codeVerifier, state, deviceId }) {
    if (!deviceId) throw new Error("VK ID did not send device_id");
    const tokens = await readJson(await postForm("https://id.vk.com/oauth2/auth", {
      grant_type: "authorization_code",
      code,
      code_verifier: codeVerifier,
      client_id: env("VK_CLIENT_ID"),
      device_id: deviceId,
      redirect_uri: redirectUri,
      state,
    }), "VK ID token exchange");
    const info = await readJson(await postForm("https://id.vk.com/oauth2/user_info", {
      client_id: env("VK_CLIENT_ID"),
      access_token: tokens.access_token,
    }), "VK ID profile");
    const user = info.user || {};
    return {
      provider: "vk",
      providerUserId: String(user.user_id || tokens.user_id),
      email: user.email || null,
      // VK ID hands out only an address the person confirmed.
      emailVerified: Boolean(user.email),
      displayName: fullName(user.first_name, user.last_name),
      avatarUrl: user.avatar || null,
    };
  },
};

const PROVIDERS: Record<OAuthProviderId, OAuthProvider> = { google, mailru, vk };

export function getProvider(id: string): OAuthProvider | null {
  const provider = (PROVIDERS as Record<string, OAuthProvider | undefined>)[id];
  return provider && provider.isConfigured() ? provider : null;
}

export function listConfiguredProviders(): Array<{ id: OAuthProviderId; title: string }> {
  return Object.values(PROVIDERS)
    .filter(provider => provider.isConfigured())
    .map(({ id, title }) => ({ id, title }));
}
