/* ── Grid of slots for one vehicle ────────────────────────────────── */

import { useState } from "react";
import ItemSlot from "./ItemSlot";
import type {
  LogisticsListItem,
  VehicleDefinition,
  FoxholeItem,
} from "../../types/models";

interface Props {
  vehicleId: string;
  vehicleName: string;
  definition: VehicleDefinition;
  items: LogisticsListItem[];
  itemCatalog: FoxholeItem[];
  onRemoveItem: (itemId: string) => void;
  onDragStart: (e: React.DragEvent, itemId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDrop: (vehicleId: string) => void;
}

export default function VehicleSlotGrid({
  vehicleId,
  vehicleName,
  definition,
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
    onDrop(vehicleId);
  };

  // Build slot array: filled + empty to match slotCount
  const slots: (LogisticsListItem | null)[] = [];
  const sortedItems = [...items].sort((a, b) => a.slot_index - b.slot_index);
  for (let i = 0; i < definition.slotCount; i++) {
    const item = sortedItems.find((it) => it.slot_index === i);
    slots.push(item ?? null);
  }
  // If items have slot_index beyond slotCount (shouldn't happen, safety)
  const extraItems = sortedItems.filter(
    (it) => it.slot_index >= definition.slotCount,
  );
  for (const extra of extraItems) {
    slots.push(extra);
  }

  const catalogMap = new Map(itemCatalog.map((c) => [c.displayId, c]));

  return (
    <div
      style={{
        background: "var(--color-surface)",
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
      {/* Header */}
      <div style={{ marginBottom: 8 }}>
        <span style={{ color: "var(--color-light)", fontSize: 14 }}>
          {vehicleName}
        </span>
        <span
          style={{
            color: "var(--color-text-dim)",
            fontSize: 12,
            marginLeft: 8,
          }}
        >
          — {definition.name}
        </span>
        <span
          style={{
            color: "var(--color-text-dim)",
            fontSize: 11,
            marginLeft: 12,
          }}
        >
          {items.length}/{definition.slotCount}
        </span>
      </div>

      {/* Slot grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${definition.slotCols}, 48px)`,
          gap: 4,
        }}
      >
        {slots.map((slot, i) => {
          const foxItem = slot ? catalogMap.get(slot.item_id) : undefined;
          return (
            <ItemSlot
              key={slot?.id ?? `empty-${i}`}
              item={foxItem}
              itemId={slot?.id}
              onRemove={slot ? () => onRemoveItem(slot.id) : undefined}
              onDragStart={
                slot ? (e) => onDragStart(e, slot.id) : undefined
              }
              onDragEnd={onDragEnd}
            />
          );
        })}
      </div>
    </div>
  );
}
