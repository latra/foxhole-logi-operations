/* ── Hover tooltip — shows after a short delay, matches popover styling ── */

import { useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

/** The floating bubble itself — presentational only, no hover tracking.
 *  Exported so callers that need a custom hover region (e.g. "show while
 *  hovering anywhere over this whole card", not just over these children)
 *  can drive its visibility themselves instead of wrapping with <Tooltip>. */
export function TooltipBubble({ content }: { content: string }) {
  return (
    <span
      style={{
        position: "absolute",
        bottom: "100%",
        left: "50%",
        transform: "translateX(-50%)",
        marginBottom: 6,
        background: "var(--color-surface)",
        border: "1px solid rgba(219,218,216,0.12)",
        borderRadius: "var(--radius)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
        padding: "4px 8px",
        fontSize: 11,
        color: "var(--color-text)",
        whiteSpace: "nowrap",
        zIndex: 200,
        pointerEvents: "none",
      }}
    >
      {content}
    </span>
  );
}

interface Props {
  /** Tooltip text. When empty/null, the tooltip is disabled (children render plain). */
  content: string | null | undefined;
  children: ReactNode;
  delayMs?: number;
  /** Extra styles for the wrapping span — e.g. to place it absolutely within a parent. */
  style?: CSSProperties;
}

export default function Tooltip({ content, children, delayMs = 1000, style }: Props) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (!content) return <>{children}</>;

  const clearPendingTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  };

  return (
    <span
      style={{ position: "relative", display: "inline-flex", ...style }}
      onMouseEnter={() => {
        clearPendingTimeout();
        timeoutRef.current = setTimeout(() => setVisible(true), delayMs);
      }}
      onMouseLeave={() => {
        clearPendingTimeout();
        setVisible(false);
      }}
    >
      {children}
      {visible && <TooltipBubble content={content} />}
    </span>
  );
}
