import * as imageStore from "../lib/imageStore";
import { buildStorageKey, getPublicObjectUrl, deleteObject, uploadObject } from "./storageService";
import { enqueueImageProcessing } from "../queue/imageProcessingQueue";
import { extensionForMimeType } from "../utils/mime";
import { HttpError } from "../utils/httpError";
import type { ImageRecord, ImageStatus } from "../types/domain";

export interface CreateImageParams {
  buffer: Buffer;
  originalFilename: string;
  mimeType: string;
  sourceId: string | null;
}

export async function createImage(params: CreateImageParams): Promise<ImageRecord> {
  const originalStorageKey = buildStorageKey("originals", extensionForMimeType(params.mimeType));
  await uploadObject(originalStorageKey, params.buffer);

  const image = await imageStore.createImage({
    sourceId: params.sourceId,
    originalFilename: params.originalFilename,
    mimeType: params.mimeType,
    fileSizeBytes: params.buffer.length,
    originalStorageKey,
  });

  await enqueueImageProcessing(image.id);
  return image;
}

export interface ListImagesParams {
  status?: ImageStatus;
  cursor?: string;
  limit?: number;
}

export async function listImages(params: ListImagesParams): Promise<imageStore.ListImagesResult> {
  return imageStore.listImages(params);
}

export async function getImageOrThrow(id: string): Promise<ImageRecord> {
  const image = await imageStore.getImage(id);
  if (!image) {
    throw new HttpError(404, `Image ${id} not found`);
  }
  return image;
}

export async function deleteImage(id: string): Promise<void> {
  const image = await imageStore.getImage(id);
  if (!image) {
    throw new HttpError(404, `Image ${id} not found`);
  }

  const keys = [image.originalStorageKey, image.processedStorageKey, image.thumbnailStorageKey].filter(
    (key): key is string => Boolean(key)
  );
  await Promise.all(keys.map((key) => deleteObject(key)));

  // Storage deletion above is best-effort ordering; the DB row is the
  // source of truth for whether the image "exists" from the API's
  // perspective, so it's removed last (cascades to its validation rows).
  await imageStore.deleteImage(id);
}

export interface ImageDto {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  width: number | null;
  height: number | null;
  status: ImageStatus;
  rejectionReason: string | null;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  createdAt: string;
  validationResults?: Array<{
    rule: string;
    passed: boolean;
    message: string;
    metadata: unknown;
  }>;
}

export async function toImageDto(image: ImageRecord, includeValidationResults = false): Promise<ImageDto> {
  const thumbnailUrl = image.thumbnailStorageKey ? getPublicObjectUrl(image.thumbnailStorageKey) : null;
  const previewUrl = image.processedStorageKey ? getPublicObjectUrl(image.processedStorageKey) : null;

  return {
    id: image.id,
    originalFilename: image.originalFilename,
    mimeType: image.mimeType,
    fileSizeBytes: image.fileSizeBytes,
    width: image.width,
    height: image.height,
    status: image.status,
    rejectionReason: image.rejectionReason,
    thumbnailUrl,
    previewUrl,
    createdAt: image.createdAt.toISOString(),
    ...(includeValidationResults
      ? {
          validationResults: image.validationResults.map((result) => ({
            rule: result.rule,
            passed: result.passed,
            message: result.message,
            metadata: result.metadata,
          })),
        }
      : {}),
  };
}
