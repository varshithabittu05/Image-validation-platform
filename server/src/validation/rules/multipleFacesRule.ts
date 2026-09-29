import type { FaceDetection, RuleOutcome } from "../../types/domain";

export function evaluateMultipleFacesRule(faces: FaceDetection[]): RuleOutcome {
  if (faces.length > 1) {
    return {
      rule: "MULTIPLE_FACES",
      passed: false,
      message: `Detected ${faces.length} faces. Please upload a photo with only one person.`,
      metadata: { faceCount: faces.length },
    };
  }

  return {
    rule: "MULTIPLE_FACES",
    passed: true,
    message: "At most one face detected.",
    metadata: { faceCount: faces.length },
  };
}
