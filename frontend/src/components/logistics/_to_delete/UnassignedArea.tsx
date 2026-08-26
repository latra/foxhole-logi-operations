/* ── "Not assigned into a vehicle" slot grid ─────────────────────── */

import { useState } from "react";
import ItemSlot from "./ItemSlot";
import type { LogisticsListItem, FoxholeItem } from "../../types/models";

interface Props {
  items: LogisticsListItem[];
  itemCatalog: FoxholeItem[];
  onRemoveItem: (itemId: string) => void;
  onDragStart: (e: React.DragEvent, itemId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDrop: () => void;
}

export default function UnassignedArea({
  items,
  itemCatalog,
  onRemoveItem,
  onDragStart,
  onDragEnd,
  onDrop,
}: Props) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    onDrop();
  };

  const sortedItems = [...items].sort((a, b) => a.slot_index - b.slot_index);
  const catalogMap = new Map(itemCatalog.map((c) => [c.displayId, c]));

  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderTop: dragOver
          ? "2px solid var(--color-primary)"
          : "2px dashed rgba(219,218,216,0.12)",
        border: dragOver
          ? "1px solid var(--color-primary)"
          : "1px solid rgba(219,218,216,0.08)",
        borderRadius: "var(--radius)",
        padding: 12,
        marginBottom: 12,
        transition: "border-color 150ms ease",
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        style={{
          color: "var(--color-text-dim)",
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 8,
        }}
      >
        Not assigned into a vehicle
        <span style={{ marginLeft: 8, fontSize: 11 }}>
          ({sortedItems.length})
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          minHeight: 52,
        }}
      >
        {sortedItems.map((slot) => {
          const foxItem = catalogMap.get(slot.item_id);
          return (
            <ItemSlot
              key={slot.id}
              item={foxItem}
              itemId={slot.id}
              onRemove={() => onRemoveItem(slot.id)}
              onDragStart={(e) => onDragStart(e, slot.id)}
              onDragEnd={onDragEnd}
            />
          );
        })}
        {/* Ghost slot indicating more can be added */}
        <div
          style={{
            width: 48,
            height: 48,
            background: "transparent",
            border: "1px dashed rgba(219,218,216,0.08)",
            borderRadius: "var(--radius)",
          }}
        />
      </div>
    </div>
  );
}
