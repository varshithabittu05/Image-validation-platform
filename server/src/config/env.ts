import "dotenv/config";
import { z } from "zod";

// Fail fast on boot rather than surfacing a confusing runtime error deep in a
// request handler the first time a misconfigured/missing env var is touched.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),

  DATABASE_URL: z.string().min(1),

  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(125 * 1024 * 1024),

  MIN_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(10 * 1024),
  MIN_WIDTH_PX: z.coerce.number().int().positive().default(400),
  MIN_HEIGHT_PX: z.coerce.number().int().positive().default(400),
  BLUR_VARIANCE_THRESHOLD: z.coerce.number().positive().default(60),
  DUPLICATE_HAMMING_DISTANCE_THRESHOLD: z.coerce.number().int().min(0).max(64).default(8),
  MIN_FACE_AREA_RATIO: z.coerce.number().min(0).max(1).default(0.03),

  FACE_MODEL_PATH: z.string().min(1).default("./models"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();
