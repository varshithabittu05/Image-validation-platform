import sharp from "sharp";

const HASH_WIDTH = 9; // one extra column so each row yields 8 pairwise comparisons
const HASH_HEIGHT = 8; // 8 rows * 8 comparisons/row = 64 bits

/**
 * Computes a 64-bit difference hash (dHash): shrink to a tiny grayscale
 * grid, then record whether each pixel is brighter than its right-hand
 * neighbor. dHash is chosen over a byte-for-byte or MD5 comparison because
 * it is robust to re-encoding, minor resizing, and compression artifacts --
 * exactly the kind of "near duplicate" the spec asks us to catch.
 *
 * Returned as a 64-character string of '0'/'1' (Postgres bit-string literal
 * form) so it can be stored directly in a BIT(64) column and compared with
 * bit_count(a # b) in SQL instead of pulling every row into the app.
 */
export async function computeDifferenceHash(imageBuffer: Buffer): Promise<string> {
  const { data } = await sharp(imageBuffer)
    .grayscale()
    .resize(HASH_WIDTH, HASH_HEIGHT, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let bits = "";
  for (let row = 0; row < HASH_HEIGHT; row++) {
    for (let col = 0; col < HASH_WIDTH - 1; col++) {
      const left = data[row * HASH_WIDTH + col] as number;
      const right = data[row * HASH_WIDTH + col + 1] as number;
      bits += left < right ? "1" : "0";
    }
  }
  return bits;
}

/** Pure-JS fallback used by unit tests and any in-process comparison; the
 * hot path (comparing against every existing image) runs in Postgres via
 * bit_count() instead of loading all hashes into the app. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) {
    throw new Error(`Cannot compare hashes of different lengths: ${a.length} vs ${b.length}`);
  }
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) distance++;
  }
  return distance;
}
