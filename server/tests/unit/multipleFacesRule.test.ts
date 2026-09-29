import { evaluateMultipleFacesRule } from "../../src/validation/rules/multipleFacesRule";
import type { FaceDetection } from "../../src/types/domain";

const face = (): FaceDetection => ({ x: 0, y: 0, width: 100, height: 100 });

describe("evaluateMultipleFacesRule", () => {
  it("passes when no faces are detected", () => {
    expect(evaluateMultipleFacesRule([]).passed).toBe(true);
  });

  it("passes when exactly one face is detected", () => {
    expect(evaluateMultipleFacesRule([face()]).passed).toBe(true);
  });

  it("fails when two faces are detected", () => {
    const outcome = evaluateMultipleFacesRule([face(), face()]);
    expect(outcome.passed).toBe(false);
    expect(outcome.metadata).toEqual({ faceCount: 2 });
  });

  it("fails when many faces are detected", () => {
    const outcome = evaluateMultipleFacesRule([face(), face(), face(), face()]);
    expect(outcome.passed).toBe(false);
    expect(outcome.message).toMatch(/4 faces/);
  });
});
