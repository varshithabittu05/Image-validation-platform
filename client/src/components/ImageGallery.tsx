import { useMemo } from "react";
import type { GalleryItem } from "../types";
import { CollapsiblePanel } from "./CollapsiblePanel";
import { GalleryItemCard } from "./GalleryItemCard";

const IN_PROGRESS_STATUSES = new Set(["VALIDATING", "UPLOADING", "PENDING", "PROCESSING"]);
const NEEDS_ATTENTION_STATUSES = new Set(["INVALID", "REJECTED", "UPLOAD_FAILED"]);

interface ImageGalleryProps {
  items: GalleryItem[];
  onRemove: (id: string) => void;
}

export function ImageGallery({ items, onRemove }: ImageGalleryProps) {
  const { inProgress, accepted, needsAttention } = useMemo(() => {
    const inProgress: GalleryItem[] = [];
    const accepted: GalleryItem[] = [];
    const needsAttention: GalleryItem[] = [];

    for (const item of items) {
      if (IN_PROGRESS_STATUSES.has(item.status)) inProgress.push(item);
      else if (item.status === "ACCEPTED") accepted.push(item);
      else if (NEEDS_ATTENTION_STATUSES.has(item.status)) needsAttention.push(item);
    }
    return { inProgress, accepted, needsAttention };
  }, [items]);

  if (items.length === 0) {
    return <p className="panel__empty">No photos uploaded yet. Add some to get started.</p>;
  }

  return (
    <>
      <CollapsiblePanel
        variant="pending"
        title="In Progress"
        subtitle="These photos are being checked."
        count={inProgress.length}
        emptyMessage="Nothing in progress."
      >
        {inProgress.map((item) => (
          <GalleryItemCard key={item.id} item={item} onRemove={onRemove} />
        ))}
      </CollapsiblePanel>

      <CollapsiblePanel
        variant="accepted"
        title="Accepted Photos"
        subtitle="These images passed every validation check."
        count={accepted.length}
        emptyMessage="No accepted photos yet."
      >
        {accepted.map((item) => (
          <GalleryItemCard key={item.id} item={item} onRemove={onRemove} />
        ))}
      </CollapsiblePanel>

      <CollapsiblePanel
        variant="rejected"
        title="Needs Attention"
        subtitle="These photos didn't meet the requirements. Hover a photo for details."
        count={needsAttention.length}
        emptyMessage="Nothing needs attention."
      >
        {needsAttention.map((item) => (
          <GalleryItemCard key={item.id} item={item} onRemove={onRemove} />
        ))}
      </CollapsiblePanel>
    </>
  );
}
