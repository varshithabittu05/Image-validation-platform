import multer from "multer";
import { env } from "../config/env";
import { SUPPORTED_MIME_TYPES } from "../config/constants";

// Memory storage is fine at this size cap: the buffer is only held briefly
// before being streamed to S3/MinIO, and it lets multer's fileFilter run
// before anything touches disk. This is a *cheap, first-pass* filter on the
// client-declared MIME type for fast UX feedback -- the pipeline's format
// rule re-verifies via magic bytes and is the actual security boundary.
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!(SUPPORTED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      callback(new Error(`Unsupported content type: ${file.mimetype}`));
      return;
    }
    callback(null, true);
  },
}).single("image");
