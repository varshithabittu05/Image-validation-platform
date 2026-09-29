import convert from "heic-convert";

/** HEIC/HEIF isn't renderable in browsers, so every HEIC upload is normalized
 * to JPEG immediately after the initial magic-byte format check, before any
 * other pipeline step touches it. `heic-convert` uses a WASM libheif build,
 * so this works without a native libvips-with-libheif compile of `sharp`. */
export async function convertHeicToJpeg(input: Buffer): Promise<Buffer> {
  const output = await convert({ buffer: input, format: "JPEG", quality: 0.92 });
  return Buffer.from(output);
}

export function isHeic(mimeType: string): boolean {
  return mimeType === "image/heic" || mimeType === "image/heif";
}
