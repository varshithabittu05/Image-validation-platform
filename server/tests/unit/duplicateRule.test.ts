import { evaluateDuplicateRule, findClosestDuplicate } from "../../src/validation/rules/duplicateRule";
import { env } from "../../src/config/env";

describe("evaluateDuplicateRule", () => {
  it("passes when no match was found", () => {
    expect(evaluateDuplicateRule(null).passed).toBe(true);
  });

  it("fails when a match was found, and surfaces which image it matched", () => {
    const outcome = evaluateDuplicateRule({ imageId: "img-123", hammingDistance: 3 });
    expect(outcome.passed).toBe(false);
    expect(outcome.metadata).toEqual({ matchedImageId: "img-123", hammingDistance: 3 });
  });
});

describe("findClosestDuplicate", () => {
  const HASH = "0".repeat(64);

  it("returns null when the query finds no accepted images at all", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) };
    const result = await findClosestDuplicate(prisma as never, HASH, "self-id");
    expect(result).toBeNull();
  });

  it("returns null when the closest match is beyond the configured threshold", async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: "other-id", distance: env.DUPLICATE_HAMMING_DISTANCE_THRESHOLD + 1 }]),
    };
    const result = await findClosestDuplicate(prisma as never, HASH, "self-id");
    expect(result).toBeNull();
  });

  it("returns the match when the distance is at exactly the threshold (inclusive boundary)", async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: "other-id", distance: env.DUPLICATE_HAMMING_DISTANCE_THRESHOLD }]),
    };
    const result = await findClosestDuplicate(prisma as never, HASH, "self-id");
    expect(result).toEqual({ imageId: "other-id", hammingDistance: env.DUPLICATE_HAMMING_DISTANCE_THRESHOLD });
  });

  it("propagates a database failure instead of silently treating it as no-duplicate-found", async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error("connection terminated")) };
    await expect(findClosestDuplicate(prisma as never, HASH, "self-id")).rejects.toThrow("connection terminated");
  });
});
