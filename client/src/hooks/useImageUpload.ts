import { useCallback, useEffect, useRef, useState } from "react";
import { deleteImage, getImage, listImages, uploadImage } from "../api/client";
import { validateImageFile } from "../utils/fileValidation";
import type { GalleryItem, ImageDto, ImageStatusEvent } from "../types";

function toGalleryItem(image: ImageDto, fallbackPreviewUrl: string): GalleryItem {
  return {
    id: image.id,
    filename: image.originalFilename,
    status: image.status,
    reason: image.rejectionReason ?? undefined,
    // The server thumbnail is the only thing guaranteed to render for a
    // HEIC upload (browsers other than Safari can't decode HEIC in an
    // <img> tag), so prefer it the moment it exists; keep the local blob
    // as a fallback for the brief window before processing starts.
    previewUrl: image.thumbnailUrl ?? fallbackPreviewUrl,
    serverImage: image,
  };
}

export interface UseImageUploadResult {
  items: GalleryItem[];
  addFiles: (files: File[]) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  handleStatusEvent: (event: ImageStatusEvent) => void;
}

export function useImageUpload(sourceId: string): UseImageUploadResult {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Hydrate the gallery with images uploaded in earlier sessions so a page
  // reload doesn't look like an empty slate.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [accepted, rejected] = await Promise.all([
          listImages({ status: "ACCEPTED", limit: 50 }),
          listImages({ status: "REJECTED", limit: 50 }),
        ]);
        if (cancelled) return;

        setItems((current) => {
          const existingIds = new Set(current.map((item) => item.id));
          const hydrated = [...accepted.items, ...rejected.items]
            .filter((image) => !existingIds.has(image.id))
            .map((image) => toGalleryItem(image, ""));
          return [...current, ...hydrated];
        });
      } catch {
        // A failed initial fetch just means the gallery starts empty; the
        // upload flow itself doesn't depend on this succeeding.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<GalleryItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const addFiles = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        const clientId = crypto.randomUUID();
        const previewUrl = URL.createObjectURL(file);

        setItems((current) => [{ id: clientId, filename: file.name, status: "VALIDATING", previewUrl }, ...current]);

        const validation = await validateImageFile(file);
        if (!validation.valid) {
          updateItem(clientId, { status: "INVALID", reason: validation.reason });
          continue;
        }

        updateItem(clientId, { status: "UPLOADING" });
        try {
          const image = await uploadImage(file, sourceId);
          // Swap the temporary client id for the server id so later socket
          // events (keyed by server id) resolve to this row.
          setItems((current) =>
            current.map((item) => (item.id === clientId ? toGalleryItem(image, previewUrl) : item))
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Upload failed. Please try again.";
          updateItem(clientId, { status: "UPLOAD_FAILED", reason: message });
        }
      }
    },
    [sourceId, updateItem]
  );

  const handleStatusEvent = useCallback(
    (event: ImageStatusEvent) => {
      const current = itemsRef.current.find((item) => item.id === event.imageId);
      if (!current) return; // event for an image from a different tab/session sharing this sourceId

      updateItem(event.imageId, { status: event.status, reason: event.rejectionReason });

      // The status push doesn't carry the thumbnail URL, so refetch the
      // full record once a preview is actually likely to exist (i.e. past
      // PENDING) rather than on every event.
      void getImage(event.imageId)
        .then((image) => updateItem(event.imageId, toGalleryItem(image, current.previewUrl)))
        .catch(() => {
          // Keep the status-only update; the preview will just lag until the next event.
        });
    },
    [updateItem]
  );

  const removeItem = useCallback(async (id: string) => {
    const item = itemsRef.current.find((entry) => entry.id === id);
    setItems((current) => current.filter((entry) => entry.id !== id));

    if (item?.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(item.previewUrl);
    }
    if (item?.serverImage) {
      try {
        await deleteImage(item.serverImage.id);
      } catch {
        // Best-effort: the item is already gone from the UI; a stray
        // orphaned object in storage is preferable to blocking the user's
        // delete action on a transient network error.
      }
    }
  }, []);

  return { items, addFiles, removeItem, handleStatusEvent };
}
