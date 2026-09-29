import { ImageStatus, ValidationRule } from "@prisma/client";

jest.mock("../../src/lib/prisma", () => ({
  prisma: {
    image: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
    validationResult: { createMany: jest.fn() },
    $transaction: jest.fn(async (arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (tx: unknown) => Promise<unknown>)({ $executeRaw: jest.fn().mockResolvedValue(undefined) });
      }
      return Promise.all(arg as Promise<unknown>[]);
    }),
  },
}));

jest.mock("../../src/lib/socketEmitter", () => ({ emitImageStatus: jest.fn() }));

jest.mock("../../src/services/storageService", () => ({
  buildStorageKey: jest.fn((prefix: string) => `${prefix}/fixed-key.jpg`),
  downloadObject: jest.fn().mockResolvedValue(Buffer.from("original-bytes")),
  uploadObject: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../src/services/imageProcessingService", () => ({
  decodeAndNormalize: jest.fn().mockResolvedValue({ buffer: Buffer.from("decoded"), format: "jpeg", width: 800, height: 800 }),
  generateThumbnail: jest.fn().mockResolvedValue(Buffer.from("thumb")),
}));

jest.mock("../../src/services/hashService", () => ({ computeDifferenceHash: jest.fn().mockResolvedValue("0".repeat(64)) }));
jest.mock("../../src/services/blurService", () => ({ computeBlurVariance: jest.fn().mockResolvedValue(999) }));
jest.mock("../../src/services/faceDetectionService", () => ({ detectFaces: jest.fn().mockResolvedValue([]) }));

jest.mock("../../src/validation/rules/formatRule", () => ({
  evaluateFormatRule: jest.fn().mockResolvedValue({
    rule: ValidationRule.FORMAT,
    passed: true,
    message: "ok",
    metadata: { detectedMimeType: "image/jpeg" },
  }),
}));
jest.mock("../../src/validation/rules/resolutionRule", () => ({
  evaluateResolutionRule: jest.fn().mockReturnValue({ rule: ValidationRule.RESOLUTION, passed: true, message: "ok" }),
}));
jest.mock("../../src/validation/rules/duplicateRule", () => ({
  findClosestDuplicate: jest.fn().mockResolvedValue(null),
  evaluateDuplicateRule: jest.fn().mockReturnValue({ rule: ValidationRule.DUPLICATE, passed: true, message: "ok" }),
}));
jest.mock("../../src/validation/rules/blurRule", () => ({
  evaluateBlurRule: jest.fn().mockReturnValue({ rule: ValidationRule.BLUR, passed: true, message: "ok" }),
}));
jest.mock("../../src/validation/rules/multipleFacesRule", () => ({
  evaluateMultipleFacesRule: jest.fn().mockReturnValue({ rule: ValidationRule.MULTIPLE_FACES, passed: true, message: "ok" }),
}));
jest.mock("../../src/validation/rules/faceSizeRule", () => ({
  evaluateFaceSizeRule: jest.fn().mockReturnValue({ rule: ValidationRule.FACE_SIZE, passed: true, message: "ok" }),
}));

import { prisma } from "../../src/lib/prisma";
import { emitImageStatus } from "../../src/lib/socketEmitter";
import { downloadObject, uploadObject } from "../../src/services/storageService";
import { decodeAndNormalize } from "../../src/services/imageProcessingService";
import { computeDifferenceHash } from "../../src/services/hashService";
import { computeBlurVariance } from "../../src/services/blurService";
import { detectFaces } from "../../src/services/faceDetectionService";
import { evaluateFormatRule } from "../../src/validation/rules/formatRule";
import { evaluateResolutionRule } from "../../src/validation/rules/resolutionRule";
import { processImage } from "../../src/validation/pipeline";

const mockedPrisma = prisma as unknown as {
  image: { findUniqueOrThrow: jest.Mock; update: jest.Mock };
  validationResult: { createMany: jest.Mock };
};

function baseImage() {
  return {
    id: "img-1",
    sourceId: "session-1",
    mimeType: "image/jpeg",
    fileSizeBytes: 50_000,
    originalStorageKey: "originals/img-1.jpg",
  };
}

beforeEach(() => {
  mockedPrisma.image.findUniqueOrThrow.mockResolvedValue(baseImage());
});

describe("processImage", () => {
  it("accepts an image when every rule passes, persisting artifacts and emitting ACCEPTED", async () => {
    await processImage("img-1");

    expect(downloadObject).toHaveBeenCalledWith("originals/img-1.jpg");
    expect(decodeAndNormalize).toHaveBeenCalledWith(Buffer.from("original-bytes"), "image/jpeg");
    expect(computeDifferenceHash).toHaveBeenCalled();
    expect(computeBlurVariance).toHaveBeenCalled();
    expect(detectFaces).toHaveBeenCalled();
    expect(uploadObject).toHaveBeenCalledTimes(2); // processed + thumbnail

    expect(mockedPrisma.image.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "img-1" }, data: { status: ImageStatus.PROCESSING } })
    );
    expect(emitImageStatus).toHaveBeenCalledWith({ imageId: "img-1", sourceId: "session-1", status: "PROCESSING" });
    expect(emitImageStatus).toHaveBeenLastCalledWith({ imageId: "img-1", sourceId: "session-1", status: "ACCEPTED" });
  });

  it("short-circuits on the first failing rule and never runs the remaining, more expensive rules", async () => {
    (evaluateResolutionRule as jest.Mock).mockReturnValueOnce({
      rule: ValidationRule.RESOLUTION,
      passed: false,
      message: "Image resolution 10x10 is below the minimum of 400x400.",
    });

    await processImage("img-1");

    // Resolution fails right after decode, so the still-more-expensive
    // duplicate/blur/face steps should never run.
    expect(computeDifferenceHash).not.toHaveBeenCalled();
    expect(computeBlurVariance).not.toHaveBeenCalled();
    expect(detectFaces).not.toHaveBeenCalled();

    expect(emitImageStatus).toHaveBeenLastCalledWith({
      imageId: "img-1",
      sourceId: "session-1",
      status: "REJECTED",
      rejectionReason: "Image resolution 10x10 is below the minimum of 400x400.",
    });
  });

  it("rejects on an unsupported format without ever attempting to decode the file", async () => {
    (evaluateFormatRule as jest.Mock).mockResolvedValueOnce({
      rule: ValidationRule.FORMAT,
      passed: false,
      message: 'Unsupported format "image/gif".',
    });

    await processImage("img-1");

    expect(decodeAndNormalize).not.toHaveBeenCalled();
    expect(uploadObject).not.toHaveBeenCalled();
    expect(emitImageStatus).toHaveBeenLastCalledWith({
      imageId: "img-1",
      sourceId: "session-1",
      status: "REJECTED",
      rejectionReason: 'Unsupported format "image/gif".',
    });
  });

  it("still generates a viewable thumbnail for a rejected image, so the UI can preview it", async () => {
    (evaluateResolutionRule as jest.Mock).mockReturnValueOnce({
      rule: ValidationRule.RESOLUTION,
      passed: false,
      message: "too small",
    });

    await processImage("img-1");

    expect(uploadObject).toHaveBeenCalledTimes(2); // processed + thumbnail still generated
    expect(mockedPrisma.image.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ImageStatus.REJECTED,
          thumbnailStorageKey: "thumbnails/fixed-key.jpg",
        }),
      })
    );
  });

  it("propagates a downstream failure (e.g. storage outage) so the queue can retry the job", async () => {
    (downloadObject as jest.Mock).mockRejectedValueOnce(new Error("MinIO unreachable"));

    await expect(processImage("img-1")).rejects.toThrow("MinIO unreachable");
  });
});
