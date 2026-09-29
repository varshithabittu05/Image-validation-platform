import { randomUUID } from "crypto";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { env } from "../config/env";
import { STORAGE_ROOT } from "../config/constants";

export type StoragePrefix = "originals" | "processed" | "thumbnails";

/** Never trust a client-supplied filename as a storage key: it can contain
 * path traversal sequences, be non-unique, or leak PII into object paths. */
export function buildStorageKey(prefix: StoragePrefix, extension: string): string {
  return `${prefix}/${randomUUID()}.${extension}`;
}

function resolveWithinStorageRoot(key: string): string {
  const resolved = path.resolve(STORAGE_ROOT, key);
  if (!resolved.startsWith(STORAGE_ROOT + path.sep)) {
    // Defense in depth: keys are always server-generated UUIDs (see
    // buildStorageKey above), but this refuses to write/read outside the
    // storage root if that ever stops being true.
    throw new Error(`Refusing to access storage key outside the storage root: ${key}`);
  }
  return resolved;
}

export async function ensureStorageReady(): Promise<void> {
  await Promise.all(
    (["originals", "processed", "thumbnails"] satisfies StoragePrefix[]).map((prefix) =>
      mkdir(path.join(STORAGE_ROOT, prefix), { recursive: true })
    )
  );
}

export async function uploadObject(key: string, body: Buffer): Promise<void> {
  const destination = resolveWithinStorageRoot(key);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, body);
}

export async function downloadObject(key: string): Promise<Buffer> {
  return readFile(resolveWithinStorageRoot(key));
}

export async function deleteObject(key: string): Promise<void> {
  await rm(resolveWithinStorageRoot(key), { force: true });
}

/**
 * Stands in for a real object store's public/presigned URL. Every external
 * S3-compatible option hit friction in this environment (Docker registry
 * blocks, Backblaze blocked by org policy, Cloudflare R2 requiring a card) --
 * this serves the same storage directory statically under /files (see
 * app.ts), so it's a real URL rather than a real time-limited signature.
 * Swapping to real S3/R2 later means this becomes an actual getSignedUrl()
 * call -- see the git history for the exact S3-backed version of this file.
 */
export function getPublicObjectUrl(key: string): string {
  return `http://localhost:${env.PORT}/files/${key}`;
}
