import { evaluateResolutionRule } from "../../src/validation/rules/resolutionRule";
import { env } from "../../src/config/env";

describe("evaluateResolutionRule", () => {
  it("passes when file size and dimensions are comfortably above the minimums", () => {
    const outcome = evaluateResolutionRule(env.MIN_FILE_SIZE_BYTES * 2, env.MIN_WIDTH_PX * 2, env.MIN_HEIGHT_PX * 2);
    expect(outcome.passed).toBe(true);
  });

  it("passes at exactly the minimum thresholds (inclusive boundary)", () => {
    const outcome = evaluateResolutionRule(env.MIN_FILE_SIZE_BYTES, env.MIN_WIDTH_PX, env.MIN_HEIGHT_PX);
    expect(outcome.passed).toBe(true);
  });

  it("fails when file size is one byte below the minimum", () => {
    const outcome = evaluateResolutionRule(env.MIN_FILE_SIZE_BYTES - 1, env.MIN_WIDTH_PX, env.MIN_HEIGHT_PX);
    expect(outcome.passed).toBe(false);
    expect(outcome.message).toMatch(/file size/i);
  });

  it("fails when width is one pixel below the minimum", () => {
    const outcome = evaluateResolutionRule(env.MIN_FILE_SIZE_BYTES, env.MIN_WIDTH_PX - 1, env.MIN_HEIGHT_PX);
    expect(outcome.passed).toBe(false);
    expect(outcome.message).toMatch(/resolution/i);
  });

  it("fails when both dimensions are zero", () => {
    const outcome = evaluateResolutionRule(env.MIN_FILE_SIZE_BYTES, 0, 0);
    expect(outcome.passed).toBe(false);
  });
});
