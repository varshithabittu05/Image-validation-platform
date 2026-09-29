import { createWriteStream, existsSync, mkdirSync } from "fs";
import { pipeline } from "stream/promises";
import path from "path";

// Model weights are binary artifacts, not source -- fetched on setup rather
// than committed, mirroring how the vladmandic/face-api repo itself
// distributes them. Only the tiny-face-detector is needed: it's the
// lightest model that still gives per-face bounding boxes, which is all the
// "face too small" / "multiple faces" rules require.
const MODEL_BASE_URL = "https://raw.githubusercontent.com/vladmandic/face-api/master/model";
const MODEL_FILES = ["tiny_face_detector_model-weights_manifest.json", "tiny_face_detector_model.bin"];

async function downloadFile(fileName: string, destDir: string): Promise<void> {
  const url = `${MODEL_BASE_URL}/${fileName}`;
  const destPath = path.join(destDir, fileName);

  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }

  await pipeline(response.body as unknown as NodeJS.ReadableStream, createWriteStream(destPath));
  console.log(`Downloaded ${fileName} -> ${destPath}`);
}

async function main(): Promise<void> {
  const destDir = path.resolve(__dirname, "..", "models");
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  for (const fileName of MODEL_FILES) {
    await downloadFile(fileName, destDir);
  }

  console.log("Face detection models ready.");
}

main().catch((error) => {
  console.error("Model download failed:", error);
  process.exitCode = 1;
});
