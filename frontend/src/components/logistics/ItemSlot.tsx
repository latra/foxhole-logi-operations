/* ── Single slot cell — empty, or holding one placed item ─────────── */

import { useRef, useState } from "react";
import { TooltipBubble } from "../common/Tooltip";
import UserAvatar from "../common/UserAvatar";
import type { CatalogItem } from "../../types/models";
import type { DragPayload } from "./dragPayload";

interface Props {
  /** Present when the slot is filled. */
  placement?: {
    orderItemId: string;
    catalogItem?: CatalogItem;
    assignedTo?: string | null;
    /** Resolved display name for assignedTo — shown in the hover tooltip. */
    assignedToName?: string | null;
    /** Resolved avatar for assignedTo — shown instead of the assigned tick. */
    assignedToAvatarUrl?: string | null;
    completed?: boolean;
  };
  selected?: boolean;
  /** True while Shift is held anywhere in the editor — disables native drag
   *  (move) so a shift+drag gesture can paint-select across slots instead. */
  dragDisabled?: boolean;
  onDrop: (payload: DragPayload) => void;
  /** Called on dragstart to build the payload — lets the parent bundle in
   *  the rest of the current multi-selection when this slot is part of it. */
  onGetDragPayload?: () => DragPayload;
  /** Plain click (no shift) — select just this one. */
  onSelect?: () => void;
  /** Shift+mousedown — toggles this slot and starts a paint-select drag. */
  onShiftMouseDown?: () => void;
  /** Mouse entered this slot while a paint-select drag is in progress. */
  onPaintHover?: () => void;
  onRemove?: () => void;
}

const SLOT_SIZE = 48;

export default function ItemSlot({
  placement,
  selected,
  dragDisabled,
  onDrop,
  onGetDragPayload,
  onSelect,
  onShiftMouseDown,
  onPaintHover,
  onRemove,
}: Props) {
  const filled = !!placement;
  const hasBadge = !!placement && (placement.completed || !!placement.assignedTo);

  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    // Without this, the drop event bubbles up to the parent grid/area's own
    // onDrop (auto-slot handler) and the item gets placed twice.
    e.stopPropagation();
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    try {
      onDrop(JSON.parse(raw) as DragPayload);
    } catch {
      // ignore malformed payloads
    }
  };

  return (
    <div
      role="gridcell"
      draggable={filled && !dragDisabled}
      onDragStart={(e) => {
        if (!placement) return;
        e.dataTransfer.effectAllowed = "move";
        const payload: DragPayload =
          onGetDragPayload?.() ?? { kind: "existing", orderItemId: placement.orderItemId };
        e.dataTransfer.setData("application/json", JSON.stringify(payload));
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseDown={(e) => {
        if (!filled || !onShiftMouseDown || !e.shiftKey) return;
        // Stops the browser's native drag / text-selection from starting so
        // the shift+drag gesture is free to paint-select across slots.
        e.preventDefault();
        onShiftMouseDown();
      }}
      onClick={(e) => {
        if (!filled || !onSelect || e.shiftKey) return;
        onSelect();
      }}
      onContextMenu={(e) => {
        if (!filled || !onRemove) return;
        e.preventDefault();
        onRemove();
      }}
      title={
        placement?.catalogItem
          ? `${placement.catalogItem.name}${onSelect ? " — shift+click or shift+drag to multi-select" : ""}${onRemove ? ", right-click to remove" : ""}`
          : undefined
      }
      style={{
        position: "relative",
        width: SLOT_SIZE,
        height: SLOT_SIZE,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius)",
        background: selected
          ? "rgba(36,86,130,0.18)"
          : filled
            ? "var(--color-surface)"
            : "var(--color-surface-alt)",
        border: selected
          ? "1px solid var(--color-primary)"
          : filled
            ? "1px solid rgba(219,218,216,0.12)"
            : "1px solid rgba(219,218,216,0.08)",
        cursor: filled ? "grab" : "default",
        transition: "border-color 150ms ease, background 150ms ease",
      }}
      onMouseEnter={(e) => {
        if (!filled) return;
        onPaintHover?.();
        if (!selected) {
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(219,218,216,0.25)";
        }
        if (hasBadge) {
          if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
          tooltipTimeoutRef.current = setTimeout(() => setShowTooltip(true), 1000);
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLDivElement).style.borderColor = filled
            ? "rgba(219,218,216,0.12)"
            : "rgba(219,218,216,0.08)";
        }
        if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
        setShowTooltip(false);
      }}
    >
      {placement?.catalogItem?.icon_url && (
        <img
          src={placement.catalogItem.icon_url}
          alt=""
          style={{ width: 36, height: 36, objectFit: "contain", pointerEvents: "none" }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.visibility = "hidden";
          }}
        />
      )}
      {placement && !placement.catalogItem?.icon_url && (
        <i
          className="material-icons"
          style={{ fontSize: 22, color: "var(--color-text-dim)", pointerEvents: "none" }}
        >
          inventory_2
        </i>
      )}
      {placement && placement.completed && (
        <i
          className="material-icons"
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            fontSize: 15,
            color: "var(--color-success, #3a7d44)",
            background: "var(--color-surface)",
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        >
          check_circle
        </i>
      )}
      {placement && !placement.completed && placement.assignedTo && (
        <UserAvatar
          avatarUrl={placement.assignedToAvatarUrl}
          size={15}
          color="#4a9cd6"
          style={{ position: "absolute", top: -4, right: -4, pointerEvents: "none" }}
        />
      )}
      {placement && hasBadge && showTooltip && (
        <TooltipBubble
          content={`${placement.completed ? "Completed by" : "Assigned to"} ${placement.assignedToName ?? "Unknown"}`}
        />
      )}
    </div>
  );
}
