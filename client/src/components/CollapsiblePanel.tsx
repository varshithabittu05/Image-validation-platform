import { useState } from "react";
import type { ReactNode } from "react";

interface CollapsiblePanelProps {
  variant: "accepted" | "rejected" | "pending";
  title: string;
  subtitle: string;
  count: number;
  emptyMessage: string;
  children: ReactNode;
}

export function CollapsiblePanel({ variant, title, subtitle, count, emptyMessage, children }: CollapsiblePanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (count === 0) return null;

  return (
    <section className={`panel panel--${variant}`}>
      <div className="panel__header" onClick={() => setIsExpanded((value) => !value)}>
        <div>
          <h3 className="panel__heading">
            {title} ({count})
          </h3>
          <p className="panel__subtitle">{subtitle}</p>
        </div>
        <button
          type="button"
          className="panel__toggle"
          aria-label={isExpanded ? "Collapse section" : "Expand section"}
          onClick={(event) => {
            event.stopPropagation();
            setIsExpanded((value) => !value);
          }}
        >
          {isExpanded ? "▲" : "▼"}
        </button>
      </div>

      {isExpanded ? (
        count > 0 ? (
          <div className="panel__grid">{children}</div>
        ) : (
          <p className="panel__empty">{emptyMessage}</p>
        )
      ) : null}
    </section>
  );
}
