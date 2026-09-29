jest.mock("../../src/validation/pipeline", () => ({ processImage: jest.fn() }));
jest.mock("../../src/lib/socketEmitter", () => ({ emitImageStatus: jest.fn() }));
jest.mock("../../src/lib/prisma", () => ({
  prisma: { image: { update: jest.fn() } },
}));

import { ImageStatus } from "@prisma/client";
import { processImage } from "../../src/validation/pipeline";
import { emitImageStatus } from "../../src/lib/socketEmitter";
import { prisma } from "../../src/lib/prisma";
import { enqueueImageProcessing } from "../../src/queue/imageProcessingQueue";

const mockedPrisma = prisma as unknown as { image: { update: jest.Mock } };

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("enqueueImageProcessing (in-process queue)", () => {
  it("never runs more than the configured concurrency at once", async () => {
    const gates = Array.from({ length: 6 }, () => deferred<void>());
    let concurrentCount = 0;
    let maxObservedConcurrency = 0;

    (processImage as jest.Mock).mockImplementation(async (imageId: string) => {
      concurrentCount++;
      maxObservedConcurrency = Math.max(maxObservedConcurrency, concurrentCount);
      const index = Number(imageId.split("-")[1]);
      await gates[index]?.promise;
      concurrentCount--;
    });

    for (let i = 0; i < 6; i++) {
      await enqueueImageProcessing(`image-${i}`);
    }

    // Give the microtask queue a turn so all eligible jobs actually start.
    await Promise.resolve();
    await Promise.resolve();

    expect(maxObservedConcurrency).toBeLessThanOrEqual(4);

    // Release everything so the test doesn't leave dangling handles.
    gates.forEach((gate) => gate.resolve());
    await new Promise((resolve) => setImmediate(resolve));
  });

  it("does not block the caller while the job runs", async () => {
    const gate = deferred<void>();
    (processImage as jest.Mock).mockImplementation(() => gate.promise);

    const start = Date.now();
    await enqueueImageProcessing("slow-image");
    expect(Date.now() - start).toBeLessThan(50);

    gate.resolve();
  });

  it("marks the image REJECTED and emits a status event when processing throws", async () => {
    (processImage as jest.Mock).mockRejectedValueOnce(new Error("model failed to load"));
    mockedPrisma.image.update.mockResolvedValue({
      id: "broken-image",
      sourceId: "session-1",
      rejectionReason: "An internal error occurred while processing this image.",
    });

    await enqueueImageProcessing("broken-image");
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockedPrisma.image.update).toHaveBeenCalledWith({
      where: { id: "broken-image" },
      data: { status: ImageStatus.REJECTED, rejectionReason: "An internal error occurred while processing this image." },
    });
    expect(emitImageStatus).toHaveBeenCalledWith({
      imageId: "broken-image",
      sourceId: "session-1",
      status: "REJECTED",
      rejectionReason: "An internal error occurred while processing this image.",
    });
  });

  it("never throws out of the failure fallback even if the DB update itself fails", async () => {
    (processImage as jest.Mock).mockRejectedValueOnce(new Error("model failed to load"));
    mockedPrisma.image.update.mockRejectedValueOnce(new Error("connection terminated"));

    await expect(enqueueImageProcessing("double-failure-image")).resolves.toBeUndefined();
    await new Promise((resolve) => setImmediate(resolve));
    // No assertion beyond "didn't throw" -- an unhandled rejection here would fail the test suite.
  });
});
