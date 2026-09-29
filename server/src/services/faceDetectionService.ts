import * as tf from "@tensorflow/tfjs-node";
import * as faceapi from "@vladmandic/face-api";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import type { FaceDetection } from "../types/domain";

let modelsLoadedPromise: Promise<void> | null = null;

/**
 * Loads the tiny-face-detector weights once per process. Using
 * @vladmandic/face-api's tfjs-node backend with raw tensors (instead of the
 * browser-oriented face-api.js + `canvas` combo) avoids a native `canvas`
 * build entirely, which is a common source of broken installs on macOS/CI.
 */
export function loadFaceModels(): Promise<void> {
  if (!modelsLoadedPromise) {
    modelsLoadedPromise = faceapi.nets.tinyFaceDetector
      .loadFromDisk(env.FACE_MODEL_PATH)
      .then(() => {
        logger.info({ path: env.FACE_MODEL_PATH }, "face detection model loaded");
      })
      .catch((error) => {
        // Reset so a transient failure (e.g. models not downloaded yet) can be retried
        // on the next job instead of permanently wedging the worker process.
        modelsLoadedPromise = null;
        throw error;
      });
  }
  return modelsLoadedPromise;
}

export async function detectFaces(imageBuffer: Buffer): Promise<FaceDetection[]> {
  await loadFaceModels();

  const tensor = tf.node.decodeImage(imageBuffer, 3) as tf.Tensor3D;
  try {
    const detections = await faceapi.detectAllFaces(
      tensor as unknown as faceapi.TNetInput,
      new faceapi.TinyFaceDetectorOptions()
    );
    return detections.map((detection) => ({
      x: detection.box.x,
      y: detection.box.y,
      width: detection.box.width,
      height: detection.box.height,
    }));
  } finally {
    tensor.dispose();
  }
}
