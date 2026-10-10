import { api } from './api';

/**
 * Pictures of notes live on the server (`/note-images/:id`); the note text only
 * holds `![](img:<id>)`. Fetching needs the session token, so a picture is
 * downloaded once per session and shown from an object URL.
 */
const urls = new Map<string, Promise<string>>();

/** Remembers a picture that is already on this device, so it shows without a request. */
export function primeNoteImage(id: string, url: string) {
  urls.set(id, Promise.resolve(url));
}

export function loadNoteImage(id: string): Promise<string> {
  const cached = urls.get(id);
  if (cached) return cached;
  const pending = api.getBlob(`/note-images/${encodeURIComponent(id)}`)
    .then(blob => URL.createObjectURL(blob))
    .catch(error => {
      // A failed load (offline, expired session) must be retried next time.
      urls.delete(id);
      throw error;
    });
  urls.set(id, pending);
  return pending;
}

/** Uploads a picture (idempotent: the same id overwrites the same picture). */
export async function uploadNoteImage(id: string, dataUrl: string) {
  await api.putDirect(`/note-images/${encodeURIComponent(id)}`, { dataUrl });
  primeNoteImage(id, dataUrl);
}

export function newNoteImageId() {
  return `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
