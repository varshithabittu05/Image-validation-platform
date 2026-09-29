const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/heif": "heif",
};

export function extensionForMimeType(mimeType: string): string {
  return EXTENSION_BY_MIME_TYPE[mimeType] ?? "bin";
}
