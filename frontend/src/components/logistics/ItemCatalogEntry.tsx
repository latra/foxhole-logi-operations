/* ── Single item tile in the catalog panel ────────────────────────── */

import type { FoxholeItem } from "../../types/models";
import type { DragPayload } from "./dragPayload";

interface Props {
  item: FoxholeItem;
  disabled?: boolean;
  onPick: (count: number) => void; // count: 1 = click, 4 = shift+click
}

export default function ItemCatalogEntry({ item, disabled, onPick }: Props) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData(
          "application/json",
          JSON.stringify({ kind: "catalog", displayId: item.displayId } as DragPayload),
        );
      }}
      onClick={(e) => onPick(e.shiftKey ? 4 : 1)}
      disabled={disabled}
      title={`${item.itemName} — click to add 1, shift+click to add 4`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: "6px 4px",
        background: "var(--color-surface)",
        border: "1px solid rgba(219,218,216,0.08)",
        borderRadius: "var(--radius)",
        cursor: disabled ? "default" : "grab",
        opacity: disabled ? 0.5 : 1,
        transition: "background 150ms ease, border-color 150ms ease",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLButtonElement).style.background = "rgba(36,86,130,0.10)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(36,86,130,0.35)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(219,218,216,0.08)";
      }}
    >
      {item.iconPath ? (
        <img
          src={item.iconPath}
          alt=""
          style={{ width: 32, height: 32, objectFit: "contain", pointerEvents: "none" }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.visibility = "hidden";
          }}
        />
      ) : (
        <i className="material-icons" style={{ fontSize: 24, color: "var(--color-text-dim)" }}>
          inventory_2
        </i>
      )}
      <span
        style={{
          fontSize: 10,
          color: "var(--color-text-dim)",
          textAlign: "center",
          lineHeight: 1.2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {item.itemName}
      </span>
    </button>
  );
}
