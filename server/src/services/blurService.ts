import sharp from "sharp";

// Standard 3x3 Laplacian kernel: an edge-detection operator whose output
// variance is a well-established sharpness proxy (Pech-Pacheco et al., 2000).
// A sharp, in-focus image has strong edges -> high-variance Laplacian
// response; a blurry image's edges are smeared -> low variance.
const LAPLACIAN_KERNEL = {
  width: 3,
  height: 3,
  kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0],
};

/**
 * Returns the variance of the Laplacian response of the grayscale image.
 * Lower values indicate a blurrier image. Threshold is empirical and
 * exposed via BLUR_VARIANCE_THRESHOLD so it can be tuned per deployment
 * without a code change.
 *
 * KNOWN LIMITATION (found during QA): this measures texture/edge density
 * across the *whole frame*, so it can false-positive on genuinely sharp
 * photos with low overall texture -- e.g. a studio portrait with a smooth
 * gradient backdrop and soft, evenly-lit skin scored 27.65 here, *below* an
 * actual motion-blurred photo's 40.03. No single threshold can separate
 * that pair correctly (whichever way you move it, one of the two
 * misclassifies). Restricting the measurement to the detected face region
 * and/or contrast-normalizing the variance were tried and did not reliably
 * fix it either. Left conservative (reject-leaning) deliberately: letting
 * an actually-blurry photo through is worse for downstream use than
 * occasionally rejecting a sharp low-texture portrait. A real fix would
 * need frequency-domain analysis or a learned blur classifier.
 */
export async function computeBlurVariance(imageBuffer: Buffer): Promise<number> {
  const { data, info } = await sharp(imageBuffer)
    .grayscale()
    // Downscale first: convolution cost is O(pixels), and sharpness on a
    // photo doesn't need full resolution to detect -- this keeps large
    // uploads from dominating worker CPU time.
    .resize(600, 600, { fit: "inside", withoutEnlargement: true })
    .convolve(LAPLACIAN_KERNEL)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelCount = info.width * info.height;
  if (pixelCount === 0) return 0;

  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i] as number;
  }
  const mean = sum / pixelCount;

  let squaredDiffSum = 0;
  for (let i = 0; i < data.length; i++) {
    const diff = (data[i] as number) - mean;
    squaredDiffSum += diff * diff;
  }
  return squaredDiffSum / pixelCount;
}
