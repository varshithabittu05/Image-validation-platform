import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useImageUpload } from "../src/hooks/useImageUpload";
import type { ImageDto } from "../src/types";

vi.mock("../src/api/client", () => ({
  uploadImage: vi.fn(),
  listImages: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  getImage: vi.fn(),
  deleteImage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/utils/fileValidation", () => ({
  validateImageFile: vi.fn().mockResolvedValue({ valid: true, detectedFormat: "image/jpeg" }),
}));

import { deleteImage, getImage, listImages, uploadImage } from "../src/api/client";
import { validateImageFile } from "../src/utils/fileValidation";

function acceptedDto(overrides: Partial<ImageDto> = {}): ImageDto {
  return {
    id: "server-id-1",
    originalFilename: "photo.jpg",
    mimeType: "image/jpeg",
    fileSizeBytes: 12345,
    width: 800,
    height: 800,
    status: "PENDING",
    rejectionReason: null,
    thumbnailUrl: null,
    previewUrl: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeFile(name = "photo.jpg"): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff])], name, { type: "image/jpeg" });
}

beforeEach(() => {
  vi.clearAllMocks();
  (listImages as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ items: [], nextCursor: null });
  (deleteImage as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
});

describe("useImageUpload", () => {
  it("hydrates the gallery with previously accepted/rejected images on mount", async () => {
    const priorAccepted = acceptedDto({ id: "old-1", status: "ACCEPTED", thumbnailUrl: "https://cdn/old-1.jpg" });
    (listImages as unknown as ReturnType<typeof vi.fn>).mockImplementation(async ({ status }: { status: string }) =>
      status === "ACCEPTED" ? { items: [priorAccepted], nextCursor: null } : { items: [], nextCursor: null }
    );

    const { result } = renderHook(() => useImageUpload("session-1"));

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0]?.id).toBe("old-1");
    expect(result.current.items[0]?.status).toBe("ACCEPTED");
  });

  it("moves a valid file through VALIDATING -> UPLOADING -> the server's returned status", async () => {
    (uploadImage as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(acceptedDto({ status: "PENDING" }));
    const { result } = renderHook(() => useImageUpload("session-1"));

    let addPromise!: Promise<void>;
    act(() => {
      addPromise = result.current.addFiles([makeFile()]);
    });
    await act(async () => {
      await addPromise;
    });

    expect(validateImageFile).toHaveBeenCalledTimes(1);
    expect(uploadImage).toHaveBeenCalledWith(expect.any(File), "session-1");
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]?.id).toBe("server-id-1");
    expect(result.current.items[0]?.status).toBe("PENDING");
  });

  it("marks a client-invalid file as INVALID and never calls the upload API", async () => {
    (validateImageFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      valid: false,
      reason: "Unsupported format. Please upload a PNG, JPG, or HEIC image.",
    });
    const { result } = renderHook(() => useImageUpload("session-1"));

    await act(async () => {
      await result.current.addFiles([makeFile("virus.exe")]);
    });

    expect(uploadImage).not.toHaveBeenCalled();
    expect(result.current.items[0]?.status).toBe("INVALID");
    expect(result.current.items[0]?.reason).toMatch(/PNG, JPG, or HEIC/);
  });

  it("marks the item UPLOAD_FAILED when the network request itself fails", async () => {
    (uploadImage as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error: could not reach the server."));
    const { result } = renderHook(() => useImageUpload("session-1"));

    await act(async () => {
      await result.current.addFiles([makeFile()]);
    });

    expect(result.current.items[0]?.status).toBe("UPLOAD_FAILED");
    expect(result.current.items[0]?.reason).toMatch(/network error/i);
  });

  it("applies a status event to the matching item and refetches its full record", async () => {
    (uploadImage as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(acceptedDto({ status: "PENDING" }));
    (getImage as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      acceptedDto({ status: "ACCEPTED", thumbnailUrl: "https://cdn/server-id-1.jpg" })
    );

    const { result } = renderHook(() => useImageUpload("session-1"));
    await act(async () => {
      await result.current.addFiles([makeFile()]);
    });

    act(() => {
      result.current.handleStatusEvent({ imageId: "server-id-1", sourceId: "session-1", status: "ACCEPTED" });
    });

    await waitFor(() => expect(result.current.items[0]?.status).toBe("ACCEPTED"));
    await waitFor(() => expect(result.current.items[0]?.previewUrl).toBe("https://cdn/server-id-1.jpg"));
  });

  it("ignores a status event for an image this session never uploaded", async () => {
    const { result } = renderHook(() => useImageUpload("session-1"));

    act(() => {
      result.current.handleStatusEvent({ imageId: "unknown-id", sourceId: "session-1", status: "ACCEPTED" });
    });

    expect(result.current.items).toHaveLength(0);
    expect(getImage).not.toHaveBeenCalled();
  });

  it("removes an item locally and best-effort deletes it server-side", async () => {
    (uploadImage as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(acceptedDto({ status: "PENDING" }));
    const { result } = renderHook(() => useImageUpload("session-1"));

    await act(async () => {
      await result.current.addFiles([makeFile()]);
    });

    await act(async () => {
      await result.current.removeItem("server-id-1");
    });

    expect(result.current.items).toHaveLength(0);
    expect(deleteImage).toHaveBeenCalledWith("server-id-1");
  });

  it("does not call deleteImage for an item the server never accepted (e.g. INVALID)", async () => {
    (validateImageFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ valid: false, reason: "bad" });
    const { result } = renderHook(() => useImageUpload("session-1"));

    await act(async () => {
      await result.current.addFiles([makeFile()]);
    });
    const invalidId = result.current.items[0]?.id as string;

    await act(async () => {
      await result.current.removeItem(invalidId);
    });

    expect(deleteImage).not.toHaveBeenCalled();
  });
});
