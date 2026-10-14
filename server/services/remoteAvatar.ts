import crypto from "crypto";
import { MAX_AVATAR_DATA_URL_LENGTH } from "../../validation";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
// base64 grows the picture by 4/3, so this keeps the data URL under the profile limit.
const MAX_AVATAR_BYTES = Math.floor((MAX_AVATAR_DATA_URL_LENGTH - 64) * 3 / 4);
const FETCH_TIMEOUT_MS = 5000;

/**
 * Downloads a profile picture from Google / Mail.ru / VK / Gravatar and keeps it
 * as a data URL, so the avatar keeps working after the service's link expires
 * and the browser never calls those services when showing it.
 * Returns null when there is no picture, it is too big, or the download fails.
 */
export async function fetchAvatarAsDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url || !/^https:\/\//i.test(url)) return null;
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const type = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_TYPES.has(type)) return null;
    const declared = Number(response.headers.get("content-length"));
    if (declared && declared > MAX_AVATAR_BYTES) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_AVATAR_BYTES) return null;
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch (error: any) {
    console.warn(`[Avatar] Could not download profile picture: ${error?.message || error}`);
    return null;
  }
}

/** Gravatar link for an email; `d=404` makes Gravatar answer 404 when the person has no picture. */
export function gravatarUrl(email: string, size = 256): string {
  const hash = crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  return `https://gravatar.com/avatar/${hash}?s=${size}&d=404`;
}
