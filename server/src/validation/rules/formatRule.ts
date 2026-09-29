import { fromBuffer as fileTypeFromBuffer } from "file-type";
import { SUPPORTED_MIME_TYPES } from "../../config/constants";
import type { RuleOutcome } from "../../types/domain";

/**
 * Sniffs the real file format from magic bytes rather than trusting the
 * client-supplied MIME type or file extension, which are trivial to spoof
 * (e.g. renaming a script to "photo.jpg"). This is the pipeline's security
 * boundary: nothing downstream should ever branch on client-declared type.
 */
export async function evaluateFormatRule(buffer: Buffer): Promise<RuleOutcome> {
  const detected = await fileTypeFromBuffer(buffer);

  if (!detected) {
    return {
      rule: "FORMAT",
      passed: false,
      message: "Could not determine file format. Only JPEG, PNG, and HEIC/HEIF are supported.",
    };
  }

  if (!(SUPPORTED_MIME_TYPES as readonly string[]).includes(detected.mime)) {
    return {
      rule: "FORMAT",
      passed: false,
      message: `Unsupported format "${detected.mime}". Only JPEG, PNG, and HEIC/HEIF are supported.`,
      metadata: { detectedMimeType: detected.mime },
    };
  }

  return {
    rule: "FORMAT",
    passed: true,
    message: "Format is supported.",
    metadata: { detectedMimeType: detected.mime },
  };
}
