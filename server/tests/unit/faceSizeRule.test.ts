import { evaluateFaceSizeRule } from "../../src/validation/rules/faceSizeRule";
import { env } from "../../src/config/env";
import type { FaceDetection } from "../../src/types/domain";

const IMAGE_WIDTH = 1000;
const IMAGE_HEIGHT = 1000;
const IMAGE_AREA = IMAGE_WIDTH * IMAGE_HEIGHT;

function faceWithAreaRatio(ratio: number): FaceDetection {
  const side = Math.sqrt(IMAGE_AREA * ratio);
  return { x: 0, y: 0, width: side, height: side };
}

describe("evaluateFaceSizeRule", () => {
  it("passes when no face was detected (rule does not apply)", () => {
    const outcome = evaluateFaceSizeRule([], IMAGE_WIDTH, IMAGE_HEIGHT);
    expect(outcome.passed).toBe(true);
    expect(outcome.metadata).toEqual({ faceCount: 0 });
  });

  it("fails when the face area ratio is below the minimum", () => {
    const face = faceWithAreaRatio(env.MIN_FACE_AREA_RATIO / 2);
    const outcome = evaluateFaceSizeRule([face], IMAGE_WIDTH, IMAGE_HEIGHT);
    expect(outcome.passed).toBe(false);
    expect(outcome.message).toMatch(/too small/i);
  });

  it("passes when the face area ratio is comfortably above the minimum", () => {
    const face = faceWithAreaRatio(env.MIN_FACE_AREA_RATIO * 5);
    const outcome = evaluateFaceSizeRule([face], IMAGE_WIDTH, IMAGE_HEIGHT);
    expect(outcome.passed).toBe(true);
  });

  it("handles a zero-area image without dividing by zero", () => {
    const outcome = evaluateFaceSizeRule([{ x: 0, y: 0, width: 10, height: 10 }], 0, 0);
    expect(outcome.passed).toBe(false);
  });
});
