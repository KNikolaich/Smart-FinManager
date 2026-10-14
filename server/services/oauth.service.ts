import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma";
import { JWT_SECRET_VALUE } from "../config";
import { fetchAvatarAsDataUrl } from "./remoteAvatar";
import type { OAuthProfile, OAuthProviderId } from "./oauthProviders";

export const OAUTH_STATE_COOKIE = "oauth_state";
export const OAUTH_STATE_TTL_SECONDS = 10 * 60;

interface StatePayload {
  p: OAuthProviderId;
  s: string;
  v: string;
}

function base64url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Starts a sign-in: a random `state` for the provider, a PKCE verifier/challenge pair,
 * and a signed cookie value that carries both back to the callback.
 */
export function createOAuthState(provider: OAuthProviderId) {
  const state = base64url(crypto.randomBytes(24));
  const codeVerifier = base64url(crypto.randomBytes(48));
  const codeChallenge = base64url(crypto.createHash("sha256").update(codeVerifier).digest());
  const cookie = jwt.sign({ p: provider, s: state, v: codeVerifier } satisfies StatePayload, JWT_SECRET_VALUE, {
    expiresIn: OAUTH_STATE_TTL_SECONDS,
  });
  return { state, codeChallenge, cookie };
}

/** Checks the callback against the cookie set at the start; returns the PKCE verifier. */
export function verifyOAuthState(provider: OAuthProviderId, cookie: string | undefined, state: string | undefined): string | null {
  if (!cookie || !state) return null;
  try {
    const payload = jwt.verify(cookie, JWT_SECRET_VALUE) as StatePayload;
    if (payload.p !== provider) return null;
    const expected = Buffer.from(payload.s);
    const actual = Buffer.from(state);
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
    return payload.v;
  } catch {
    return null;
  }
}

/** Address used when the service gave no email, or gave one already taken by another account. */
export function placeholderEmail(provider: OAuthProviderId, providerUserId: string): string {
  const safeId = providerUserId.toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return `${provider}-${safeId}@oauth.local`;
}

function issueToken(user: { id: string; email: string; role: string }) {
  return jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET_VALUE);
}

/**
 * Finds or creates the account for a person who signed in through a service:
 * 1. the service account is already tied to a user → that user;
 * 2. the service confirmed an email that belongs to an existing user → tie it to that user;
 * 3. otherwise a new user, with the name and the profile picture from the service.
 * An existing user without an avatar gets the service's picture as well.
 */
export async function signInWithOAuthProfile(profile: OAuthProfile) {
  const email = profile.email?.trim().toLowerCase() || null;

  const identity = await prisma.authIdentity.findUnique({
    where: { provider_providerUserId: { provider: profile.provider, providerUserId: profile.providerUserId } },
    include: { user: true },
  });

  let user = identity?.user ?? null;
  let isNewUser = false;

  if (!user && email && profile.emailVerified) {
    user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.authIdentity.create({
        data: { userId: user.id, provider: profile.provider, providerUserId: profile.providerUserId, email },
      });
    }
  }

  if (!user) {
    const emailTaken = email ? Boolean(await prisma.user.findUnique({ where: { email }, select: { id: true } })) : true;
    const accountEmail = !emailTaken && email ? email : placeholderEmail(profile.provider, profile.providerUserId);
    // Nobody knows this password: such a user signs in only through the service.
    const [password, photoURL, userCount] = await Promise.all([
      bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10),
      fetchAvatarAsDataUrl(profile.avatarUrl),
      prisma.user.count(),
    ]);
    user = await prisma.user.create({
      data: {
        email: accountEmail,
        password,
        displayName: profile.displayName?.slice(0, 120) || null,
        photoURL,
        role: userCount === 0 ? "admin" : "user",
        authIdentities: {
          create: { provider: profile.provider, providerUserId: profile.providerUserId, email },
        },
      },
    });
    isNewUser = true;
  } else {
    const patch: { displayName?: string; photoURL?: string } = {};
    if (!user.displayName && profile.displayName) patch.displayName = profile.displayName.slice(0, 120);
    if (!user.photoURL) {
      const photoURL = await fetchAvatarAsDataUrl(profile.avatarUrl);
      if (photoURL) patch.photoURL = photoURL;
    }
    if (Object.keys(patch).length > 0) {
      user = await prisma.user.update({ where: { id: user.id }, data: patch });
    }
  }

  console.log(`[Auth] ${profile.provider} sign-in for user ${user.id}${isNewUser ? " (new account)" : ""}`);
  return { token: issueToken(user), isNewUser };
}
