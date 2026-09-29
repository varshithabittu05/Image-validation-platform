export type SupportedImageFormat = "image/jpeg" | "image/png" | "image/heic";

const MAX_HEADER_BYTES = 32;
const MAX_FILE_SIZE_BYTES = 120 * 1024 * 1024; // mirrors the server's MAX_UPLOAD_BYTES, just for instant client-side feedback

// ISO base media file format "ftyp" box brands used by HEIC/HEIF. Browsers
// often report an empty or generic `file.type` for HEIC (especially on
// non-Safari browsers), so `file.type`/the filename extension cannot be
// trusted -- the same magic-byte sniffing the backend does is done here too.
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"]);

async function readHeaderBytes(file: File): Promise<Uint8Array> {
  const buffer = await file.slice(0, MAX_HEADER_BYTES).arrayBuffer();
  return new Uint8Array(buffer);
}

function matchesSignature(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

export async function detectImageFormat(file: File): Promise<SupportedImageFormat | null> {
  const bytes = await readHeaderBytes(file);

  if (matchesSignature(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (matchesSignature(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";

  const hasFtypBox = matchesSignature(bytes, [0x66, 0x74, 0x79, 0x70], 4); // 'ftyp' ASCII at byte offset 4
  if (hasFtypBox && bytes.length >= 12) {
    const brand = String.fromCharCode(bytes[8] as number, bytes[9] as number, bytes[10] as number, bytes[11] as number).toLowerCase();
    if (HEIC_BRANDS.has(brand)) return "image/heic";
  }

  return null;
}

export interface FileValidationResult {
  valid: boolean;
  reason?: string;
  detectedFormat?: SupportedImageFormat;
}

export async function validateImageFile(file: File): Promise<FileValidationResult> {
  if (file.size === 0) {
    return { valid: false, reason: "File is empty." };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, reason: `File exceeds the ${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB limit.` };
  }

  const detectedFormat = await detectImageFormat(file);
  if (!detectedFormat) {
    return { valid: false, reason: "Unsupported format. Please upload a PNG, JPG, or HEIC image." };
  }

  return { valid: true, detectedFormat };
}
