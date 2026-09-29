import { useCallback, useMemo } from "react";
import { UploadDropzone } from "./components/UploadDropzone";
import { ImageGallery } from "./components/ImageGallery";
import { GuidelinesPanel } from "./components/GuidelinesPanel";
import { ToastStack } from "./components/ToastStack";
import { useImageUpload } from "./hooks/useImageUpload";
import { useSocket } from "./hooks/useSocket";
import { useToasts } from "./hooks/useToasts";
import { getOrCreateSourceId } from "./utils/sourceId";
import type { ImageStatusEvent } from "./types";

const sourceId = getOrCreateSourceId();

export function App() {
  const { items, addFiles, removeItem, handleStatusEvent } = useImageUpload(sourceId);
  const { toasts, push, dismiss } = useToasts();

  const onStatusEvent = useCallback(
    (event: ImageStatusEvent) => {
      handleStatusEvent(event);
      if (event.status === "ACCEPTED") {
        push("success", "Photo accepted!");
      } else if (event.status === "REJECTED") {
        push("error", event.rejectionReason ?? "Photo was rejected.");
      }
    },
    [handleStatusEvent, push]
  );

  useSocket(sourceId, onStatusEvent);

  const acceptedCount = useMemo(() => items.filter((item) => item.status === "ACCEPTED").length, [items]);
  const progressPercent = items.length === 0 ? 0 : Math.round((acceptedCount / items.length) * 100);

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="top-bar__logo">
          <span className="top-bar__logo-mark" />
          PixelCheck
        </div>
        <div className="top-bar__progress-track">
          <div className="top-bar__progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar__badge">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="sidebar__title">Upload photos</h1>
          <p className="sidebar__description">
            Upload PNG, JPG, or HEIC photos. Each one is automatically checked for resolution, sharpness, duplicates,
            and face visibility -- you&apos;ll see the result here in real time.
          </p>
          <UploadDropzone onFilesSelected={addFiles} />
        </aside>

        <main className="main-content">
          <div className="section-header">
            <h2 className="section-header__title">Uploaded Images</h2>
            <span className="section-header__count">
              {acceptedCount} accepted / {items.length} total
            </span>
          </div>

          <ImageGallery items={items} onRemove={removeItem} />

          <GuidelinesPanel
            variant="requirements"
            title="Photo Requirements"
            items={[
              "JPEG, PNG, or HEIC format",
              "At least 400x400 pixels",
              "Sharp and in focus",
              "A single, clearly visible face, not too far from the camera",
            ]}
          />
          <GuidelinesPanel
            variant="restrictions"
            title="Photo Restrictions"
            items={[
              "No blurry or out-of-focus photos",
              "No duplicate or near-identical photos already uploaded",
              "No photos with more than one person in them",
              "No unsupported file formats (only JPEG, PNG, and HEIC)",
            ]}
          />
        </main>
      </div>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
