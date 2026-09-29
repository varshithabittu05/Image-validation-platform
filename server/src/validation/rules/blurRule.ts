import { env } from "../../config/env";
import type { RuleOutcome } from "../../types/domain";

export function evaluateBlurRule(variance: number): RuleOutcome {
  if (variance < env.BLUR_VARIANCE_THRESHOLD) {
    return {
      rule: "BLUR",
      passed: false,
      message: "Image appears too blurry. Please ensure the photo is in focus.",
      metadata: { variance, threshold: env.BLUR_VARIANCE_THRESHOLD },
    };
  }

  return {
    rule: "BLUR",
    passed: true,
    message: "Image sharpness is acceptable.",
    metadata: { variance, threshold: env.BLUR_VARIANCE_THRESHOLD },
  };
}
