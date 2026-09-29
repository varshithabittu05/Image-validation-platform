import { useState } from "react";
import { CheckCircleIcon, ChevronIcon, NoEntryIcon } from "./icons";

interface GuidelinesPanelProps {
  variant: "requirements" | "restrictions";
  title: string;
  items: string[];
}

/**
 * Static, always-visible reference for what the validation pipeline
 * actually checks -- kept in sync with the six rules by hand, since there's
 * no single source of truth to generate this from without over-engineering
 * a rules-metadata layer for a list that changes rarely.
 */
export function GuidelinesPanel({ variant, title, items }: GuidelinesPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className={`panel panel--${variant === "requirements" ? "accepted" : "rejected"}`}>
      <div className="panel__header" onClick={() => setIsExpanded((value) => !value)}>
        <div className="guidelines-panel__title-row">
          {variant === "requirements" ? <CheckCircleIcon /> : <NoEntryIcon />}
          <h3 className="panel__heading">{title}</h3>
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
          <ChevronIcon direction={isExpanded ? "up" : "down"} />
        </button>
      </div>

      {isExpanded ? (
        <ul className="guidelines-panel__list">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
