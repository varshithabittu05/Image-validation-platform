import type { GalleryItem } from "../types";
import { ErrorCircleIcon, TrashIcon } from "./icons";

const PROCESSING_LABEL: Record<string, string> = {
  VALIDATING: "Checking file...",
  UPLOADING: "Uploading...",
  PENDING: "Queued...",
  PROCESSING: "Analyzing...",
};

const NEEDS_ATTENTION_STATUSES = new Set(["INVALID", "REJECTED", "UPLOAD_FAILED"]);

interface GalleryItemCardProps {
  item: GalleryItem;
  onRemove: (id: string) => void;
}

export function GalleryItemCard({ item, onRemove }: GalleryItemCardProps) {
  const processingLabel = PROCESSING_LABEL[item.status];
  const showTooltip = NEEDS_ATTENTION_STATUSES.has(item.status) && Boolean(item.reason);

  return (
    <div className="thumb-wrapper">
      <div className="thumb">
        {item.previewUrl ? (
          <img className="thumb__image" src={item.previewUrl} alt={item.filename} />
        ) : (
          <div className="thumb__placeholder">{item.filename}</div>
        )}

        {processingLabel ? (
          <div className="thumb__overlay" aria-label={processingLabel}>
            <div className="thumb__spinner" />
          </div>
        ) : null}

        <button
          type="button"
          className="thumb__delete"
          aria-label={`Remove ${item.filename}`}
          onClick={() => onRemove(item.id)}
        >
          <TrashIcon />
        </button>
      </div>

      {/* Rendered as a sibling of .thumb, not a child -- .thumb has
          overflow: hidden (to clip the image to its rounded corners), which
          would otherwise clip this tooltip since it's positioned above the
          thumb's own box via `bottom: calc(100% + ...)`. */}
      {showTooltip ? (
        <div className="thumb__tooltip" role="tooltip">
          <div className="thumb__tooltip-title">
            <span className="thumb__tooltip-icon">
              <ErrorCircleIcon />
            </span>
            Try again
          </div>
          {item.reason}
        </div>
      ) : null}

      {showTooltip ? <span className="thumb__caption">{item.reason}</span> : null}
    </div>
  );
}
