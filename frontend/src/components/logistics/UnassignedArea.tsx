/* ── "Not assigned into a vehicle" slot area — unlimited, flex-wrap ─── */

import ItemSlot from "./ItemSlot";
import type { CatalogItem, LogisticsOrderItem } from "../../types/models";
import type { UserInfo } from "../../utils/userNames";
import type { DragPayload } from "./dragPayload";

interface Props {
  items: LogisticsOrderItem[]; // already filtered to vehicle_id === null
  catalogById: Map<number, CatalogItem>;
  userInfoById: Map<string, UserInfo>;
  selectedIds: Set<string>;
  dragDisabled: boolean;
  onSelectItem: (orderItemId: string) => void;
  onShiftMouseDownItem: (orderItemId: string) => void;
  onPaintHoverItem: (orderItemId: string) => void;
  onGetDragPayload: (orderItemId: string) => DragPayload;
  onDropAtSlot: (slotIndex: number, payload: DragPayload) => void;
  onDropOnArea: (payload: DragPayload) => void;
  onRemoveItem: (orderItemId: string) => void;
}

export default function UnassignedArea({
  items,
  catalogById,
  userInfoById,
  selectedIds,
  dragDisabled,
  onSelectItem,
  onShiftMouseDownItem,
  onPaintHoverItem,
  onGetDragPayload,
  onDropAtSlot,
  onDropOnArea,
  onRemoveItem,
}: Props) {
  // `items` arrives pre-sorted from the backend (grouped by item type, then
  // by assignee, then by slot) — no client-side sort needed.
  return (
    <div
      className="card"
      style={{
        margin: "0 0 16px",
        borderTop: "2px dashed rgba(219,218,216,0.12)",
      }}
    >
      <div
        style={{
          padding: "8px 12px 0",
          color: "var(--color-text-dim)",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        Not assigned into a vehicle
      </div>

      <div
        role="grid"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const raw = e.dataTransfer.getData("application/json");
          if (!raw) return;
          try {
            onDropOnArea(JSON.parse(raw) as DragPayload);
          } catch {
            // ignore
          }
        }}
        style={{
          padding: 10,
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          minHeight: 48,
        }}
      >
        {items.map((oi) => (
          <ItemSlot
            key={oi.id}
            placement={{
              orderItemId: oi.id,
              catalogItem: catalogById.get(oi.item_id),
              assignedTo: oi.assigned_to,
              assignedToName: oi.assigned_to
                ? (userInfoById.get(oi.assigned_to)?.name ?? "Unknown")
                : undefined,
              assignedToAvatarUrl: oi.assigned_to
                ? (userInfoById.get(oi.assigned_to)?.avatarUrl ?? null)
                : undefined,
              completed: oi.completed,
            }}
            selected={selectedIds.has(oi.id)}
            dragDisabled={dragDisabled}
            onDrop={(payload) => onDropAtSlot(oi.slot_index, payload)}
            onGetDragPayload={() => onGetDragPayload(oi.id)}
            onSelect={() => onSelectItem(oi.id)}
            onShiftMouseDown={() => onShiftMouseDownItem(oi.id)}
            onPaintHover={() => onPaintHoverItem(oi.id)}
            onRemove={() => onRemoveItem(oi.id)}
          />
        ))}
        {/* Trailing empty "ghost" slot — signals more can be dropped/added here */}
        <ItemSlot onDrop={onDropOnArea} />
      </div>
    </div>
  );
}
