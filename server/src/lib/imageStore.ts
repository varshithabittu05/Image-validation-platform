import { prisma } from "./prisma";
import type { ImageRecord, ImageStatus, ValidationResultRecord } from "../types/domain";
import type { Prisma } from "@prisma/client";

/**
 * Thin repository layer over Prisma/Postgres. Kept as a distinct module
 * (rather than calling `prisma` directly from services) so pipeline.ts and
 * imageService.ts don't need to change if the persistence layer ever
 * changes again -- they only know about these function signatures.
 */
export interface CreateImageInput {
  sourceId: string | null;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  originalStorageKey: string;
}

export async function createImage(input: CreateImageInput): Promise<ImageRecord> {
  return prisma.image.create({ data: input, include: { validationResults: true } });
}

export async function getImage(id: string): Promise<ImageRecord | null> {
  return prisma.image.findUnique({ where: { id }, include: { validationResults: true } });
}

export interface UpdateImageInput {
  status?: ImageStatus;
  rejectionReason?: string | null;
  width?: number;
  height?: number;
  processedStorageKey?: string;
  thumbnailStorageKey?: string;
  perceptualHash?: string;
}

export async function updateImage(id: string, patch: UpdateImageInput): Promise<ImageRecord> {
  return prisma.image.update({ where: { id }, data: patch, include: { validationResults: true } });
}

export async function appendValidationResults(
  id: string,
  results: Omit<ValidationResultRecord, "createdAt">[]
): Promise<void> {
  await prisma.validationResult.createMany({
    data: results.map((result) => ({
      imageId: id,
      rule: result.rule,
      passed: result.passed,
      message: result.message,
      metadata: result.metadata ? (result.metadata as Prisma.InputJsonValue) : undefined,
    })),
  });
}

export async function deleteImage(id: string): Promise<boolean> {
  try {
    await prisma.image.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export interface ListImagesParams {
  status?: ImageStatus;
  cursor?: string;
  limit?: number;
}

export interface ListImagesResult {
  items: ImageRecord[];
  nextCursor: string | null;
}

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;

/**
 * Keyset (cursor) pagination on the primary key, ordered by (createdAt, id)
 * desc -- both covered by the composite index on Image, so this stays
 * O(log n + limit) regardless of how many rows precede the page, unlike
 * OFFSET-based pagination which re-scans every skipped row.
 */
export async function listImages(params: ListImagesParams): Promise<ListImagesResult> {
  const limit = Math.min(params.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

  const rows = await prisma.image.findMany({
    where: params.status ? { status: params.status } : undefined,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: { validationResults: true },
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return { items, nextCursor: hasMore && last ? last.id : null };
}

export async function listAcceptedImages(): Promise<ImageRecord[]> {
  return prisma.image.findMany({ where: { status: "ACCEPTED" }, include: { validationResults: true } });
}

// A promise-chained mutex: each call's callback only starts once the
// previous one has settled, serializing the "check for a duplicate, then
// decide" step within this process so two images uploaded at the same
// instant can't both read "no duplicate yet" and both get accepted. This
// only guards against races *within this one server process* -- if this
// ever runs as more than one instance, it would need to become a Postgres
// advisory lock (`pg_advisory_xact_lock`) instead, which serializes across
// processes too.
let lockChain: Promise<unknown> = Promise.resolve();

export function withDuplicateCheckLock<T>(fn: () => Promise<T> | T): Promise<T> {
  const result = lockChain.then(fn, fn);
  lockChain = result.catch(() => undefined);
  return result;
}
