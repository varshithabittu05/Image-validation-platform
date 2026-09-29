import { listAcceptedImages } from "../../lib/imageStore";
import { hammingDistance } from "../../services/hashService";
import { env } from "../../config/env";
import type { RuleOutcome } from "../../types/domain";

interface DuplicateMatch {
  imageId: string;
  hammingDistance: number;
}

/**
 * Finds the closest previously-accepted image (if any) within the
 * configured Hamming-distance threshold. This compares against every
 * accepted image (fine at demo scale, fetched once per check); at real
 * scale this comparison should move into SQL via Postgres's `bit_count()`
 * on the `BIT(64)` column instead of pulling every row into the app -- see
 * README "Scaling the duplicate check".
 */
export async function findClosestDuplicate(perceptualHash: string, excludeImageId: string): Promise<DuplicateMatch | null> {
  let closest: DuplicateMatch | null = null;

  for (const image of await listAcceptedImages()) {
    if (image.id === excludeImageId || !image.perceptualHash) continue;

    const distance = hammingDistance(perceptualHash, image.perceptualHash);
    if (!closest || distance < closest.hammingDistance) {
      closest = { imageId: image.id, hammingDistance: distance };
    }
  }

  if (!closest || closest.hammingDistance > env.DUPLICATE_HAMMING_DISTANCE_THRESHOLD) {
    return null;
  }
  return closest;
}

export function evaluateDuplicateRule(match: DuplicateMatch | null): RuleOutcome {
  if (match) {
    return {
      rule: "DUPLICATE",
      passed: false,
      message: "This image is too similar to one already uploaded.",
      metadata: { matchedImageId: match.imageId, hammingDistance: match.hammingDistance },
    };
  }

  return {
    rule: "DUPLICATE",
    passed: true,
    message: "No sufficiently similar image found.",
  };
}
