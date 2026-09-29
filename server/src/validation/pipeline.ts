import { getImage, updateImage, withDuplicateCheckLock, appendValidationResults } from "../lib/imageStore";
import { logger } from "../lib/logger";
import { emitImageStatus } from "../lib/socketEmitter";
import { buildStorageKey, downloadObject, uploadObject } from "../services/storageService";
import { decodeAndNormalize, generateThumbnail } from "../services/imageProcessingService";
import { computeDifferenceHash } from "../services/hashService";
import { computeBlurVariance } from "../services/blurService";
import { detectFaces } from "../services/faceDetectionService";
import { evaluateFormatRule } from "./rules/formatRule";
import { evaluateResolutionRule } from "./rules/resolutionRule";
import { evaluateDuplicateRule, findClosestDuplicate } from "./rules/duplicateRule";
import { evaluateBlurRule } from "./rules/blurRule";
import { evaluateMultipleFacesRule } from "./rules/multipleFacesRule";
import { evaluateFaceSizeRule } from "./rules/faceSizeRule";
import type { RuleOutcome } from "../types/domain";

interface FinalizeParams {
  imageId: string;
  sourceId: string | null;
  outcomes: RuleOutcome[];
  status: "ACCEPTED" | "REJECTED";
  rejectionReason: string | null;
  width?: number;
  height?: number;
  processedStorageKey?: string;
  thumbnailStorageKey?: string;
  perceptualHash?: string;
}

/**
 * Runs the full validation pipeline for one image and persists the outcome.
 * Rules run cheapest-and-safest-first: format must be verified before we
 * ever attempt to decode the file (decoding an unverified, possibly
 * malicious buffer as an image is itself a risk), resolution is checked
 * before the more expensive perceptual-hash/blur/ML steps, and evaluation
 * short-circuits on the first failing rule since the UI only ever surfaces
 * one rejection reason per image.
 */
export async function processImage(imageId: string): Promise<void> {
  const image = await getImage(imageId);
  if (!image) {
    throw new Error(`Image ${imageId} not found`);
  }

  await updateImage(imageId, { status: "PROCESSING" });
  emitImageStatus({ imageId, sourceId: image.sourceId, status: "PROCESSING" });

  const outcomes: RuleOutcome[] = [];

  try {
    const originalBuffer = await downloadObject(image.originalStorageKey);

    const formatOutcome = await evaluateFormatRule(originalBuffer);
    outcomes.push(formatOutcome);
    if (!formatOutcome.passed) {
      // Can't decode an unverified/unsupported buffer, so there is no
      // thumbnail to show -- the frontend falls back to a generic icon.
      await finalize({
        imageId,
        sourceId: image.sourceId,
        outcomes,
        status: "REJECTED",
        rejectionReason: formatOutcome.message,
      });
      return;
    }
    const detectedMimeType = (formatOutcome.metadata?.detectedMimeType as string | undefined) ?? image.mimeType;

    const decoded = await decodeAndNormalize(originalBuffer, detectedMimeType);

    // Generate viewable artifacts as soon as the image is decodable, before
    // any pass/fail rule runs, so a rejected photo can still be previewed
    // in the "Needs attention" gallery instead of showing a blank tile.
    const thumbnailBuffer = await generateThumbnail(decoded.buffer);
    const processedStorageKey = buildStorageKey("processed", "jpg");
    const thumbnailStorageKey = buildStorageKey("thumbnails", "jpg");
    await Promise.all([
      uploadObject(processedStorageKey, decoded.buffer),
      uploadObject(thumbnailStorageKey, thumbnailBuffer),
    ]);
    const artifacts = { width: decoded.width, height: decoded.height, processedStorageKey, thumbnailStorageKey };

    const resolutionOutcome = evaluateResolutionRule(image.fileSizeBytes, decoded.width, decoded.height);
    outcomes.push(resolutionOutcome);
    if (!resolutionOutcome.passed) {
      await finalize({
        imageId,
        sourceId: image.sourceId,
        outcomes,
        status: "REJECTED",
        rejectionReason: resolutionOutcome.message,
        ...artifacts,
      });
      return;
    }

    const perceptualHash = await computeDifferenceHash(decoded.buffer);

    const duplicateOutcome = await withDuplicateCheckLock(async () => {
      const match = await findClosestDuplicate(perceptualHash, imageId);
      return evaluateDuplicateRule(match);
    });
    outcomes.push(duplicateOutcome);
    if (!duplicateOutcome.passed) {
      await finalize({
        imageId,
        sourceId: image.sourceId,
        outcomes,
        status: "REJECTED",
        rejectionReason: duplicateOutcome.message,
        ...artifacts,
        perceptualHash,
      });
      return;
    }

    const blurVariance = await computeBlurVariance(decoded.buffer);
    const blurOutcome = evaluateBlurRule(blurVariance);
    outcomes.push(blurOutcome);
    if (!blurOutcome.passed) {
      await finalize({
        imageId,
        sourceId: image.sourceId,
        outcomes,
        status: "REJECTED",
        rejectionReason: blurOutcome.message,
        ...artifacts,
        perceptualHash,
      });
      return;
    }

    const faces = await detectFaces(decoded.buffer);

    const multipleFacesOutcome = evaluateMultipleFacesRule(faces);
    outcomes.push(multipleFacesOutcome);
    if (!multipleFacesOutcome.passed) {
      await finalize({
        imageId,
        sourceId: image.sourceId,
        outcomes,
        status: "REJECTED",
        rejectionReason: multipleFacesOutcome.message,
        ...artifacts,
        perceptualHash,
      });
      return;
    }

    const faceSizeOutcome = evaluateFaceSizeRule(faces, decoded.width, decoded.height);
    outcomes.push(faceSizeOutcome);
    if (!faceSizeOutcome.passed) {
      await finalize({
        imageId,
        sourceId: image.sourceId,
        outcomes,
        status: "REJECTED",
        rejectionReason: faceSizeOutcome.message,
        ...artifacts,
        perceptualHash,
      });
      return;
    }

    await finalize({
      imageId,
      sourceId: image.sourceId,
      outcomes,
      status: "ACCEPTED",
      rejectionReason: null,
      ...artifacts,
      perceptualHash,
    });
  } catch (error) {
    logger.error({ err: error, imageId }, "image processing pipeline failed");
    throw error; // rethrow so the in-process queue's failure handler can mark the image REJECTED
  }
}

async function finalize(params: FinalizeParams): Promise<void> {
  await updateImage(params.imageId, {
    status: params.status,
    rejectionReason: params.rejectionReason,
    width: params.width,
    height: params.height,
    processedStorageKey: params.processedStorageKey,
    thumbnailStorageKey: params.thumbnailStorageKey,
    perceptualHash: params.perceptualHash,
  });
  await appendValidationResults(params.imageId, params.outcomes);

  emitImageStatus({
    imageId: params.imageId,
    sourceId: params.sourceId,
    status: params.status,
    ...(params.rejectionReason ? { rejectionReason: params.rejectionReason } : {}),
  });
}
