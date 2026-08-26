/* ── Slot grid for one vehicle placed in the order ────────────────── */

import { useRef, useState } from "react";
import ItemSlot from "./ItemSlot";
import { TooltipBubble } from "../common/Tooltip";
import UserAvatar from "../common/UserAvatar";
import type { CatalogItem, LogisticsOrderItem, LogisticsOrderVehicle } from "../../types/models";
import type { UserInfo } from "../../utils/userNames";
import type { DragPayload } from "./dragPayload";

interface Props {
  vehicle: LogisticsOrderVehicle;
  vehicleTypeName: string;
  slotCount: number;
  slotCols: number;
  items: LogisticsOrderItem[]; // already filtered to this vehicle
  catalogById: Map<number, CatalogItem>;
  userInfoById: Map<string, UserInfo>;
  selectedIds: Set<string>;
  dragDisabled: boolean;
  onSelectItem: (orderItemId: string) => void;
  onShiftMouseDownItem: (orderItemId: string) => void;
  onPaintHoverItem: (orderItemId: string) => void;
  onGetDragPayload: (orderItemId: string) => DragPayload;
  onDropAtSlot: (slotIndex: number, payload: DragPayload) => void;
  onDropOnGrid: (payload: DragPayload) => void;
  onRemoveItem: (orderItemId: string) => void;
  onRemoveVehicle: () => void;
  vehicleSelected: boolean;
  onSelectVehicle: (additive: boolean) => void;
}

export default function VehicleSlotGrid({
  vehicle,
  vehicleTypeName,
  slotCount,
  slotCols,
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
  onDropOnGrid,
  onRemoveItem,
  onRemoveVehicle,
  vehicleSelected,
  onSelectVehicle,
}: Props) {
  const bySlot = new Map(items.map((i) => [i.slot_index, i]));
  const assignedInfo = vehicle.assigned_to ? userInfoById.get(vehicle.assigned_to) : undefined;
  const hasBadge = vehicle.completed || !!vehicle.assigned_to;

  const [showHeaderTooltip, setShowHeaderTooltip] = useState(false);
  const headerTooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  return (
    <div
      id={`vehicle-grid-${vehicle.id}`}
      className="card"
      style={{
        margin: "0 0 12px",
        border: vehicleSelected ? "1px solid var(--color-primary)" : undefined,
      }}
    >
      <div
        onClick={(e) => onSelectVehicle(e.shiftKey)}
        onMouseEnter={() => {
          if (!hasBadge) return;
          if (headerTooltipTimeoutRef.current) clearTimeout(headerTooltipTimeoutRef.current);
          headerTooltipTimeoutRef.current = setTimeout(() => setShowHeaderTooltip(true), 1000);
        }}
        onMouseLeave={() => {
          if (headerTooltipTimeoutRef.current) clearTimeout(headerTooltipTimeoutRef.current);
          setShowHeaderTooltip(false);
        }}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderBottom: "1px solid rgba(219,218,216,0.08)",
          cursor: "pointer",
          background: vehicleSelected ? "rgba(36,86,130,0.10)" : undefined,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {vehicle.completed && (
            <i
              className="material-icons"
              style={{ fontSize: 16, color: "var(--color-success, #3a7d44)" }}
            >
              check_circle
            </i>
          )}
          {!vehicle.completed && vehicle.assigned_to && (
            <UserAvatar avatarUrl={assignedInfo?.avatarUrl} size={16} color="#4a9cd6" />
          )}
          <span style={{ color: "var(--color-light)", fontSize: 14 }}>
            {vehicle.display_name}
          </span>
          <span style={{ color: "var(--color-text-dim)", fontSize: 12 }}>
            — {vehicleTypeName}
          </span>
        </div>
        {hasBadge && showHeaderTooltip && (
          <TooltipBubble
            content={`${vehicle.completed ? "Completed by" : "Assigned to"} ${assignedInfo?.name ?? "Unknown"}`}
          />
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemoveVehicle();
          }}
          title="Remove vehicle"
          style={{
            background: "none",
            border: "none",
            color: "var(--color-text-dim)",
            cursor: "pointer",
            padding: 0,
            opacity: 0.6,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = "1";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--color-danger)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = "0.6";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-dim)";
          }}
        >
          <i className="material-icons" style={{ fontSize: 16 }}>
            delete
          </i>
        </button>
      </div>

      <div
        role="grid"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const raw = e.dataTransfer.getData("application/json");
          if (!raw) return;
          try {
            onDropOnGrid(JSON.parse(raw) as DragPayload);
          } catch {
            // ignore
          }
        }}
        style={{
          padding: 10,
          display: "grid",
          gridTemplateColumns: `repeat(${slotCols}, 48px)`,
          gap: 4,
        }}
      >
        {Array.from({ length: slotCount }, (_, slotIndex) => {
          const oi = bySlot.get(slotIndex);
          return (
            <ItemSlot
              key={slotIndex}
              placement={
                oi
                  ? {
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
                    }
                  : undefined
              }
              selected={oi ? selectedIds.has(oi.id) : false}
              dragDisabled={dragDisabled}
              onDrop={(payload) => onDropAtSlot(slotIndex, payload)}
              onGetDragPayload={oi ? () => onGetDragPayload(oi.id) : undefined}
              onSelect={oi ? () => onSelectItem(oi.id) : undefined}
              onShiftMouseDown={oi ? () => onShiftMouseDownItem(oi.id) : undefined}
              onPaintHover={oi ? () => onPaintHoverItem(oi.id) : undefined}
              onRemove={oi ? () => onRemoveItem(oi.id) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
