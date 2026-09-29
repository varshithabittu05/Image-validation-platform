import { logger } from "../lib/logger";
import { updateImage } from "../lib/imageStore";
import { emitImageStatus } from "../lib/socketEmitter";
import { processImage } from "../validation/pipeline";

// Single-process async queue: an in-memory FIFO with a concurrency cap.
// This is what keeps the upload endpoint responding in milliseconds
// regardless of how long face detection takes, without pulling in Redis --
// the tradeoff (acceptable for a single-instance deployment) is that a job
// mid-flight is lost if the process crashes, and there is no cross-process
// fan-out. Reintroducing BullMQ+Redis is the natural upgrade path if this
// ever needs to run as more than one instance or survive restarts.
const MAX_CONCURRENCY = 4;

const pendingImageIds: string[] = [];
let activeCount = 0;

function drain(): void {
  while (activeCount < MAX_CONCURRENCY && pendingImageIds.length > 0) {
    const imageId = pendingImageIds.shift() as string;
    activeCount++;

    processImage(imageId)
      .catch((error) => handleProcessingFailure(imageId, error))
      .finally(() => {
        activeCount--;
        drain();
      });
  }
}

async function handleProcessingFailure(imageId: string, error: unknown): Promise<void> {
  logger.error({ err: error, imageId }, "image processing failed; marking as rejected");

  // Without a durable retrying queue, a failure has to resolve to a terminal
  // state here -- otherwise the image is stuck showing "Processing..." in
  // the UI forever with no way to recover.
  try {
    const image = await updateImage(imageId, {
      status: "REJECTED",
      rejectionReason: "An internal error occurred while processing this image.",
    });
    emitImageStatus({
      imageId,
      sourceId: image.sourceId,
      status: "REJECTED",
      rejectionReason: image.rejectionReason ?? undefined,
    });
  } catch (updateError) {
    logger.error({ err: updateError, imageId }, "failed to record processing failure");
  }
}

export function enqueueImageProcessing(imageId: string): Promise<void> {
  pendingImageIds.push(imageId);
  drain();
  return Promise.resolve();
}
