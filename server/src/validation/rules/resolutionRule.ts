import { env } from "../../config/env";
import type { RuleOutcome } from "../../types/domain";

export function evaluateResolutionRule(fileSizeBytes: number, width: number, height: number): RuleOutcome {
  const tooSmallFile = fileSizeBytes < env.MIN_FILE_SIZE_BYTES;
  const tooSmallResolution = width < env.MIN_WIDTH_PX || height < env.MIN_HEIGHT_PX;

  if (tooSmallFile || tooSmallResolution) {
    return {
      rule: "RESOLUTION",
      passed: false,
      message: tooSmallResolution
        ? `Image resolution ${width}x${height} is below the minimum of ${env.MIN_WIDTH_PX}x${env.MIN_HEIGHT_PX}.`
        : `File size ${fileSizeBytes} bytes is below the minimum of ${env.MIN_FILE_SIZE_BYTES} bytes.`,
      metadata: { fileSizeBytes, width, height },
    };
  }

  return {
    rule: "RESOLUTION",
    passed: true,
    message: "Resolution and file size are sufficient.",
    metadata: { fileSizeBytes, width, height },
  };
}
