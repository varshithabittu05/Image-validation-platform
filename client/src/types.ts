export type ImageStatus = "PENDING" | "PROCESSING" | "ACCEPTED" | "REJECTED";

export interface ValidationResultDto {
  rule: string;
  passed: boolean;
  message: string;
  metadata: unknown;
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
  validationResults?: ValidationResultDto[];
}

export interface ImageStatusEvent {
  imageId: string;
  sourceId: string | null;
  status: "PROCESSING" | "ACCEPTED" | "REJECTED";
  rejectionReason?: string;
}

export type GalleryItemStatus =
  | "VALIDATING" // sniffing magic bytes client-side, pre-upload
  | "INVALID" // failed client-side format/size validation, never uploaded
  | "UPLOADING" // multipart request in flight
  | "UPLOAD_FAILED" // network/server error on the upload request itself
  | ImageStatus; // PENDING/PROCESSING/ACCEPTED/REJECTED, mirrored from the server

/** Unifies a freshly-picked local file and a server-persisted image into one
 * renderable row, so gallery components don't need to branch on "is this
 * still local or does the server know about it yet". */
export interface GalleryItem {
  id: string; // client-generated id until the server assigns one, then the server id
  filename: string;
  status: GalleryItemStatus;
  reason?: string;
  previewUrl: string; // local blob: URL until the server thumbnail is ready
  serverImage?: ImageDto;
}
