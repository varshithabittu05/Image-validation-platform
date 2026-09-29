import path from "path";

export const SUPPORTED_MIME_TYPES = ["image/jpeg", "image/png", "image/heic", "image/heif"] as const;
export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

export const STORAGE_ROOT = path.resolve(__dirname, "..", "..", "storage");

// Cap on decoded pixel count (not file bytes) so a small file that decompresses
// into a huge bitmap ("decompression bomb") can't be used to exhaust server memory.
export const MAX_DECODED_PIXELS = 60_000_000; // e.g. ~10000x6000

export const THUMBNAIL_MAX_DIMENSION_PX = 512;
