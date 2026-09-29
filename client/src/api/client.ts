import type { ImageDto, ImageStatus } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function uploadImage(file: File, sourceId: string, signal?: AbortSignal): Promise<ImageDto> {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("sourceId", sourceId);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/images`, { method: "POST", body: formData, signal });
  } catch {
    // fetch() rejects on network failure (offline, DNS, CORS) with a
    // generic TypeError -- normalize it to the same ApiError shape callers
    // already handle, instead of leaking a fetch-specific error type.
    throw new ApiError("Network error: could not reach the server.", 0);
  }

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }
  return (await response.json()) as ImageDto;
}

export interface ListImagesResult {
  items: ImageDto[];
  nextCursor: string | null;
}

export async function listImages(params: { status?: ImageStatus; cursor?: string; limit?: number } = {}): Promise<ListImagesResult> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.limit) query.set("limit", String(params.limit));

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/images?${query.toString()}`);
  } catch {
    throw new ApiError("Network error: could not reach the server.", 0);
  }

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }
  return (await response.json()) as ListImagesResult;
}

export async function getImage(id: string): Promise<ImageDto> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/images/${id}`);
  } catch {
    throw new ApiError("Network error: could not reach the server.", 0);
  }

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }
  return (await response.json()) as ImageDto;
}

export async function deleteImage(id: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/images/${id}`, { method: "DELETE" });
  } catch {
    throw new ApiError("Network error: could not reach the server.", 0);
  }

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }
}

export { API_BASE_URL };
