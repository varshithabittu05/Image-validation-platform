import { describe, expect, it } from "vitest";
import { detectImageFormat, validateImageFile } from "../src/utils/fileValidation";

function fileFromBytes(bytes: number[], name: string, mimeType: string): File {
  return new File([new Uint8Array(bytes)], name, { type: mimeType });
}

const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0];
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
// Minimal ISO-BMFF box: 4-byte size, "ftyp", brand "heic", then padding.
const HEIC_HEADER = [0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0];
const GIF_HEADER = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];

describe("detectImageFormat", () => {
  it("recognizes a JPEG by its magic bytes", async () => {
    const file = fileFromBytes(JPEG_HEADER, "photo.jpg", "image/jpeg");
    expect(await detectImageFormat(file)).toBe("image/jpeg");
  });

  it("recognizes a PNG by its magic bytes", async () => {
    const file = fileFromBytes(PNG_HEADER, "photo.png", "image/png");
    expect(await detectImageFormat(file)).toBe("image/png");
  });

  it("recognizes a HEIC file via its ftyp box brand", async () => {
    const file = fileFromBytes(HEIC_HEADER, "photo.heic", "");
    expect(await detectImageFormat(file)).toBe("image/heic");
  });

  it("returns null for a real but unsupported format (GIF)", async () => {
    const file = fileFromBytes(GIF_HEADER, "animation.gif", "image/gif");
    expect(await detectImageFormat(file)).toBeNull();
  });

  it("ignores a spoofed extension/MIME type and trusts only the magic bytes", async () => {
    // A GIF renamed to look like a JPEG by extension and declared MIME type.
    const file = fileFromBytes(GIF_HEADER, "photo.jpg", "image/jpeg");
    expect(await detectImageFormat(file)).toBeNull();
  });

  it("returns null for an empty file instead of throwing", async () => {
    const file = fileFromBytes([], "empty.jpg", "image/jpeg");
    expect(await detectImageFormat(file)).toBeNull();
  });
});

describe("validateImageFile", () => {
  it("accepts a well-formed JPEG", async () => {
    const file = fileFromBytes(JPEG_HEADER, "photo.jpg", "image/jpeg");
    const result = await validateImageFile(file);
    expect(result).toEqual({ valid: true, detectedFormat: "image/jpeg" });
  });

  it("rejects a zero-byte file with a specific reason", async () => {
    const file = fileFromBytes([], "empty.jpg", "image/jpeg");
    const result = await validateImageFile(file);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/empty/i);
  });

  it("rejects a file over the size limit before even reading its bytes", async () => {
    const file = fileFromBytes(JPEG_HEADER, "huge.jpg", "image/jpeg");
    Object.defineProperty(file, "size", { value: 200 * 1024 * 1024 });

    const result = await validateImageFile(file);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/exceeds/i);
  });

  it("rejects an unsupported format with an actionable reason", async () => {
    const file = fileFromBytes(GIF_HEADER, "animation.gif", "image/gif");
    const result = await validateImageFile(file);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/PNG, JPG, or HEIC/);
  });
});
