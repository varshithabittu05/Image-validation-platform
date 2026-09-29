const STORAGE_KEY = "ivp:sourceId";

/**
 * A stable per-tab id so the server can route socket status events back to
 * the browser that uploaded a given image, without requiring authentication.
 * Persisted in sessionStorage (not localStorage) so a reload keeps the same
 * id, but a new tab -- which has no in-flight uploads to resume -- gets its own.
 */
export function getOrCreateSourceId(): string {
  const existing = sessionStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const generated = crypto.randomUUID();
  sessionStorage.setItem(STORAGE_KEY, generated);
  return generated;
}
