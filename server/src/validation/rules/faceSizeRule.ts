import { env } from "../../config/env";
import type { FaceDetection, RuleOutcome } from "../../types/domain";

/**
 * Only meaningful when exactly one face was detected -- the multiple-faces
 * rule runs first in the pipeline and short-circuits before this one on
 * more than one face. Zero faces is treated as a pass: the spec only asks
 * us to reject a face that is "too small", not to require a face to be
 * present at all (see README "Assumptions" for the rationale).
 */
export function evaluateFaceSizeRule(faces: FaceDetection[], imageWidth: number, imageHeight: number): RuleOutcome {
  if (faces.length === 0) {
    return {
      rule: "FACE_SIZE",
      passed: true,
      message: "No face detected; face-size check does not apply.",
      metadata: { faceCount: 0 },
    };
  }

  const face = faces[0] as FaceDetection;
  const imageArea = imageWidth * imageHeight;
  const faceArea = face.width * face.height;
  const faceAreaRatio = imageArea > 0 ? faceArea / imageArea : 0;

  if (faceAreaRatio < env.MIN_FACE_AREA_RATIO) {
    return {
      rule: "FACE_SIZE",
      passed: false,
      message: "The detected face is too small. Please move closer or crop the photo.",
      metadata: { faceAreaRatio, threshold: env.MIN_FACE_AREA_RATIO },
    };
  }

  return {
    rule: "FACE_SIZE",
    passed: true,
    message: "Face size is acceptable.",
    metadata: { faceAreaRatio, threshold: env.MIN_FACE_AREA_RATIO },
  };
}
