import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * A reference in running text. The card's contents mount only while it is hovered or focused,
 * so the server is asked for the record on first hover and keeps it current while it shows.
 *
 * The card is rendered into <body> with fixed positioning, next to the word: every frame and
 * parchment page is its own stacking layer, so a card inside one would slide under the next.
 * It opens below the word, or above when there is no room, and stays inside the window.
 */
export function HoverCard({ label, className, card }: { label: ReactNode; className?: string; card: () => ReactNode }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <span
      ref={anchor}
      className={`ref ${className ?? ""}`}
      tabIndex={0}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {label}
      {open && anchor.current && createPortal(<FloatingCard anchor={anchor.current}>{card()}</FloatingCard>, document.body)}
    </span>
  );
}

const GAP = 8;
const MARGIN = 8;

function FloatingCard({ anchor, children }: { anchor: HTMLElement; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // re-measure on every render: the card grows as the record and its stats arrive
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const a = anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = Math.max(MARGIN, Math.min(a.left - 6, window.innerWidth - w - MARGIN));
    const below = a.bottom + GAP;
    const top = below + h > window.innerHeight - MARGIN && a.top - GAP - h > MARGIN ? a.top - GAP - h : below;
    if (!pos || pos.left !== left || pos.top !== top) setPos({ left, top });
  });

  return (
    <div
      ref={box}
      className="card"
      role="tooltip"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos ? "visible" : "hidden" }}
    >
      {children}
    </div>
  );
}
