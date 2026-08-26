/* ── Single inventory slot cell ───────────────────────────────────── */

import { useRef } from "react";
import type { FoxholeItem } from "../../types/models";

interface Props {
  item?: FoxholeItem;
  itemId?: string;
  onRemove?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
}

export default function ItemSlot({
  item,
  itemId,
  onRemove,
  onDragStart,
  onDragEnd,
  isDragging,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (item && onRemove) onRemove();
  };

  return (
    <div
      ref={ref}
      draggable={!!item}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onContextMenu={handleContextMenu}
      title={item?.itemName ?? "Empty slot"}
      style={{
        width: 48,
        height: 48,
        background: item
          ? "var(--color-surface)"
          : "var(--color-surface-alt)",
        border: `1px solid rgba(219,218,216,${item ? "0.12" : "0.08"})`,
        borderRadius: "var(--radius)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: item ? "grab" : "default",
        opacity: isDragging ? 0.4 : 1,
        transition: "border-color 150ms ease, opacity 150ms ease",
        overflow: "hidden",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        if (item)
          (e.currentTarget as HTMLDivElement).style.borderColor =
            "rgba(219,218,216,0.25)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = `rgba(219,218,216,${item ? "0.12" : "0.08"})`;
      }}
    >
      {item && item.iconPath ? (
        <img
          src={item.iconPath}
          alt={item.itemName}
          style={{
            width: 36,
            height: 36,
            objectFit: "contain",
            pointerEvents: "none",
          }}
        />
      ) : item ? (
        <span
          style={{
            fontSize: 9,
            color: "var(--color-text-dim)",
            textAlign: "center",
            lineHeight: 1.1,
            padding: 2,
            wordBreak: "break-word",
          }}
        >
          {item.itemName}
        </span>
      ) : null}
    </div>
  );
}
