import { evaluateBlurRule } from "../../src/validation/rules/blurRule";
import { env } from "../../src/config/env";

describe("evaluateBlurRule", () => {
  it("fails when variance is below the threshold (blurry)", () => {
    const outcome = evaluateBlurRule(env.BLUR_VARIANCE_THRESHOLD - 0.01);
    expect(outcome.passed).toBe(false);
    expect(outcome.message).toMatch(/blurry/i);
  });

  it("passes at exactly the threshold (inclusive boundary)", () => {
    const outcome = evaluateBlurRule(env.BLUR_VARIANCE_THRESHOLD);
    expect(outcome.passed).toBe(true);
  });

  it("passes when variance is well above the threshold (sharp)", () => {
    const outcome = evaluateBlurRule(env.BLUR_VARIANCE_THRESHOLD * 10);
    expect(outcome.passed).toBe(true);
  });

  it("fails for a variance of zero (perfectly flat image)", () => {
    const outcome = evaluateBlurRule(0);
    expect(outcome.passed).toBe(false);
  });
});
