/* ── Single item in the catalog grid ──────────────────────────────── */

import type { FoxholeItem } from "../../types/models";

interface Props {
  item: FoxholeItem;
  onClick: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
}

export default function ItemCatalogEntry({
  item,
  onClick,
  onDragStart,
}: Props) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      title={`${item.itemName}\n${item.description ?? ""}\nClick: add 1 · Shift+Click: add 4`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: 6,
        borderRadius: "var(--radius)",
        cursor: "pointer",
        transition: "background 150ms ease",
        width: 64,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background =
          "rgba(36,86,130,0.10)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
    >
      {item.iconPath ? (
        <img
          src={item.iconPath}
          alt={item.itemName}
          style={{
            width: 40,
            height: 40,
            objectFit: "contain",
            pointerEvents: "none",
          }}
        />
      ) : (
        <div
          style={{
            width: 40,
            height: 40,
            background: "var(--color-surface-alt)",
            borderRadius: "var(--radius)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 8,
            color: "var(--color-text-dim)",
            textAlign: "center",
            padding: 2,
          }}
        >
          {item.itemName.slice(0, 12)}
        </div>
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
          maxWidth: "100%",
          wordBreak: "break-word",
        }}
      >
        {item.itemName}
      </span>
    </div>
  );
}
