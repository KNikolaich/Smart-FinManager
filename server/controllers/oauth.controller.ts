import { getProvider, listConfiguredProviders, type OAuthProviderId } from "../services/oauthProviders";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_TTL_SECONDS,
  createOAuthState,
  signInWithOAuthProfile,
  verifyOAuthState,
} from "../services/oauth.service";

const COOKIE_PATH = "/api/auth/oauth";

/**
 * Public address of the app, used in the redirect URI registered with each service.
 * PUBLIC_URL (e.g. https://fin.example.com) wins; otherwise it comes from the request.
 */
function publicBaseUrl(req: any): string {
  const configured = (process.env.PUBLIC_URL || "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  return `${req.protocol}://${req.get("host")}`;
}

export function callbackUrl(req: any, provider: OAuthProviderId): string {
  return `${publicBaseUrl(req)}/api/auth/oauth/${provider}/callback`;
}

function readCookie(req: any, name: string): string | undefined {
  const header: string = req.headers?.cookie || "";
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return undefined;
}

function stateCookie(req: any, value: string, maxAge: number): string {
  const secure = publicBaseUrl(req).startsWith("https://") ? "; Secure" : "";
  return `${OAUTH_STATE_COOKIE}=${encodeURIComponent(value)}; Path=${COOKIE_PATH}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

// The token goes in the URL fragment: browsers never send it to the server or in Referer.
function finish(res: any, fragment: Record<string, string>) {
  res.redirect(302, `/#${new URLSearchParams(fragment)}`);
}

export function listProviders(_req: any, res: any) {
  res.json({ providers: listConfiguredProviders() });
}

export function start(req: any, res: any) {
  const provider = getProvider(req.params.provider);
  if (!provider) return res.status(404).json({ error: "Sign-in provider is not configured" });

  const { state, codeChallenge, cookie } = createOAuthState(provider.id);
  res.setHeader("Set-Cookie", stateCookie(req, cookie, OAUTH_STATE_TTL_SECONDS));
  res.setHeader("Cache-Control", "no-store");
  res.redirect(302, provider.authorizeUrl({ redirectUri: callbackUrl(req, provider.id), state, codeChallenge }));
}

export async function callback(req: any, res: any) {
  const provider = getProvider(req.params.provider);
  res.setHeader("Cache-Control", "no-store");
  if (!provider) return finish(res, { oauth_error: "provider_unavailable" });

  const query = req.query || {};
  const cookie = readCookie(req, OAUTH_STATE_COOKIE);
  res.setHeader("Set-Cookie", stateCookie(req, "", 0));

  if (query.error) {
    // The person pressed "cancel" on the service's page, or the service refused.
    console.warn(`[Auth] ${provider.id} sign-in returned error: ${String(query.error)}`);
    return finish(res, { oauth_error: query.error === "access_denied" ? "cancelled" : "provider_error" });
  }

  const code = typeof query.code === "string" ? query.code : "";
  const state = typeof query.state === "string" ? query.state : undefined;
  const codeVerifier = verifyOAuthState(provider.id, cookie, state);
  if (!code || !codeVerifier) {
    console.warn(`[Auth] ${provider.id} sign-in rejected: missing code or state mismatch`);
    return finish(res, { oauth_error: "state_mismatch" });
  }

  try {
    const profile = await provider.fetchProfile({
      code,
      redirectUri: callbackUrl(req, provider.id),
      codeVerifier,
      state: state!,
      deviceId: typeof query.device_id === "string" ? query.device_id : undefined,
    });
    const { token } = await signInWithOAuthProfile(profile);
    finish(res, { oauth_token: token });
  } catch (error: any) {
    console.error(`[Auth] ${provider.id} sign-in failed:`, error?.message || error);
    finish(res, { oauth_error: "provider_error" });
  }
}
