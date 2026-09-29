import sharp from "sharp";
import { MAX_DECODED_PIXELS, THUMBNAIL_MAX_DIMENSION_PX } from "../config/constants";
import type { DecodedImage } from "../types/domain";
import { convertHeicToJpeg, isHeic } from "./heicConversionService";

/**
 * Normalizes any supported upload into a browser-displayable, orientation-
 * corrected, metadata-stripped buffer. This is the single place the pipeline
 * (and every downstream rule: blur, hash, face detection) reads pixels from,
 * so every rule sees the same canonical image regardless of source format.
 */
export async function decodeAndNormalize(buffer: Buffer, mimeType: string): Promise<DecodedImage> {
  const sourceBuffer = isHeic(mimeType) ? await convertHeicToJpeg(buffer) : buffer;

  const image = sharp(sourceBuffer, { limitInputPixels: MAX_DECODED_PIXELS });
  const metadata = await image.metadata();

  // .rotate() with no args applies the EXIF orientation tag then strips it;
  // re-encoding through sharp without .withMetadata() also drops the rest of
  // the EXIF block (GPS, device serial, etc.) by default -- a privacy win,
  // not just a side effect.
  const normalized = await image.rotate().jpeg({ quality: 92 }).toBuffer();
  const normalizedMetadata = await sharp(normalized).metadata();

  return {
    buffer: normalized,
    format: "jpeg",
    width: normalizedMetadata.width ?? metadata.width ?? 0,
    height: normalizedMetadata.height ?? metadata.height ?? 0,
  };
}

export async function generateThumbnail(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(THUMBNAIL_MAX_DIMENSION_PX, THUMBNAIL_MAX_DIMENSION_PX, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80 })
    .toBuffer();
}
