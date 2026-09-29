export const IMAGE_STATUSES = ["PENDING", "PROCESSING", "ACCEPTED", "REJECTED"] as const;
export type ImageStatus = (typeof IMAGE_STATUSES)[number];

export const VALIDATION_RULES = ["FORMAT", "RESOLUTION", "DUPLICATE", "BLUR", "FACE_SIZE", "MULTIPLE_FACES"] as const;
export type ValidationRuleName = (typeof VALIDATION_RULES)[number];

/** Result of a single validation rule run against one image. */
export interface RuleOutcome {
  rule: ValidationRuleName;
  passed: boolean;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface ValidationResultRecord {
  rule: ValidationRuleName;
  passed: boolean;
  message: string;
  // `unknown` (not `Record<string, unknown>`) because this describes data
  // read back from Prisma's Json column, which is typed as the broader
  // JsonValue union (including null) -- nothing here inspects its shape,
  // it's opaque data forwarded straight through to the API response.
  metadata?: unknown;
  createdAt: Date;
}

export interface ImageRecord {
  id: string;
  sourceId: string | null;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  width: number | null;
  height: number | null;
  originalStorageKey: string;
  processedStorageKey: string | null;
  thumbnailStorageKey: string | null;
  perceptualHash: string | null;
  status: ImageStatus;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  validationResults: ValidationResultRecord[];
}

/** Decoded, in-memory representation of an image mid-pipeline. */
export interface DecodedImage {
  /** Always a browser-displayable format (JPEG/PNG) -- HEIC is converted upstream. */
  buffer: Buffer;
  format: "jpeg" | "png";
  width: number;
  height: number;
}

export interface FaceDetection {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageStatusEvent {
  imageId: string;
  sourceId: string | null;
  status: "PROCESSING" | "ACCEPTED" | "REJECTED";
  rejectionReason?: string;
}
