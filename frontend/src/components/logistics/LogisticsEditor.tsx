/* ── Main logistics order editor — slot-grid layout ───────────────── */

import { useEffect, useMemo, useRef, useState } from "react";
import LogisticsHeader from "./LogisticsHeader";
import VehicleSidebar from "./VehicleSidebar";
import VehicleSlotGrid from "./VehicleSlotGrid";
import UnassignedArea from "./UnassignedArea";
import ItemCatalog from "./ItemCatalog";
import LogisticsSummary from "./LogisticsSummary";
import ConfirmModal from "../common/ConfirmModal";
import { useLogisticsStore } from "../../stores/logisticsStore";
import { useAuthStore } from "../../stores/authStore";
import { useLogisticsOrderSocket } from "../../hooks/useLogisticsOrderSocket";
import { toastError } from "../common/Toast";
import { buildUserInfoMap } from "../../utils/userNames";
import type { GroupMembership, LogisticsOrder, LogisticsOrderVehicle } from "../../types/models";
import type { DragPayload } from "./dragPayload";

interface Props {
  order: LogisticsOrder;
  faction: "COLONIAL" | "WARDEN" | "NEUTRAL";
  /** Active group's member roster — resolves assigned_to ids to display names. */
  groupMembers: GroupMembership[];
}

const DEFAULT_SLOT_COLS = 5;

type PendingConfirm =
  | { kind: "assign-items" | "complete-items"; ids: string[] }
  | { kind: "assign-vehicles" | "complete-vehicles"; ids: string[] };

export default function LogisticsEditor({ order, faction, groupMembers }: Props) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const userInfoById = useMemo(() => buildUserInfoMap(groupMembers), [groupMembers]);
  const {
    stockpiles,
    vehicleDefinitions,
    itemCatalog,
    backendItems,
    backendVehicleTypes,
    catalogFilter,
    orderVehicles,
    orderItems,
    updateActiveOrder,
    deleteActiveOrder,
    setCatalogFilter,
    resolveItemId,
    addSlotItem,
    moveSlotItem,
    removeSlotItem,
    removeSlotVehicle,
    assignSlotItem,
    unassignSlotItem,
    completeSlotItem,
    uncompleteSlotItem,
    assignSlotVehicle,
    unassignSlotVehicle,
    completeSlotVehicle,
    uncompleteSlotVehicle,
    refetchOrder,
    refetchOrderItems,
    refetchOrderVehicles,
  } = useLogisticsStore();

  // Live updates from other people editing this same order — see
  // backend/api/ws_manager.py for the per-order isolation this relies on.
  useLogisticsOrderSocket(order.id, (event) => {
    if (event === "items_changed") refetchOrderItems(order.id);
    else if (event === "vehicles_changed") refetchOrderVehicles(order.id);
    else if (event === "order_changed") refetchOrder(order.id);
  });

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "summary">("grid");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<Set<string>>(new Set());
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [shiftHeld, setShiftHeld] = useState(false);
  const isPaintingRef = useRef(false);
  const paintAddRef = useRef(true);

  // Selection is per-order — drop it when switching orders
  useEffect(() => {
    setSelectedIds(new Set());
    setSelectedVehicleIds(new Set());
  }, [order.id]);

  // Track Shift globally: while held, slots stop being native drag sources
  // so a shift+drag gesture can paint-select across them instead of moving one.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(false);
    };
    const handleMouseUp = () => {
      isPaintingRef.current = false;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const catalogById = new Map(backendItems.map((bi) => [bi.id, bi]));
  const itemCatalogByDisplayId = new Map(itemCatalog.map((i) => [i.displayId, i]));
  const vehicleTypeNameById = new Map(backendVehicleTypes.map((bt) => [bt.id, bt.name]));
  const vehicleTypeById = new Map(backendVehicleTypes.map((bt) => [bt.id, bt]));

  const resolveGridInfo = (ov: LogisticsOrderVehicle) => {
    const bt = backendVehicleTypes.find((t) => t.id === ov.vehicle_type_id);
    const localDef = bt ? vehicleDefinitions.find((d) => d.id === bt.code) : undefined;
    return {
      typeName: localDef?.name ?? bt?.name ?? `Vehicle Type #${ov.vehicle_type_id}`,
      slotCount: localDef?.slotCount ?? bt?.cargo_slots ?? 0,
      slotCols: localDef?.slotCols ?? DEFAULT_SLOT_COLS,
    };
  };

  /* ── Selection ────────────────────────────────────────────────────── */

  // Plain click (no shift): select just this one, or clear if it's the sole selection
  const handleSelect = (orderItemId: string) => {
    setSelectedIds((prev) => {
      if (prev.size === 1 && prev.has(orderItemId)) return new Set();
      return new Set([orderItemId]);
    });
  };

  // Shift+mousedown: toggles this slot, and starts a paint-select drag that
  // repeats whatever this toggle just did (add or remove) on every slot hovered.
  const handleShiftMouseDown = (orderItemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderItemId)) {
        next.delete(orderItemId);
        paintAddRef.current = false;
      } else {
        next.add(orderItemId);
        paintAddRef.current = true;
      }
      return next;
    });
    isPaintingRef.current = true;
  };

  // Mouse entered a slot while a shift+drag paint-select gesture is active
  const handlePaintHover = (orderItemId: string) => {
    if (!isPaintingRef.current) return;
    setSelectedIds((prev) => {
      const has = prev.has(orderItemId);
      if (has === paintAddRef.current) return prev;
      const next = new Set(prev);
      if (paintAddRef.current) next.add(orderItemId);
      else next.delete(orderItemId);
      return next;
    });
  };

  const buildDragPayloadFor = (orderItemId: string): DragPayload => {
    if (selectedIds.has(orderItemId) && selectedIds.size > 1) {
      return { kind: "existing-multi", orderItemIds: [...selectedIds] };
    }
    return { kind: "existing", orderItemId };
  };

  // Vehicles have their own, simpler selection (click / shift+click only — no drag-paint)
  const handleSelectVehicle = (vehicleId: string, additive: boolean) => {
    setSelectedVehicleIds((prev) => {
      if (!additive) {
        if (prev.size === 1 && prev.has(vehicleId)) return new Set();
        return new Set([vehicleId]);
      }
      const next = new Set(prev);
      if (next.has(vehicleId)) next.delete(vehicleId);
      else next.add(vehicleId);
      return next;
    });
  };

  /* ── Slot placement ───────────────────────────────────────────────── */

  const computeFreeSlot = (vehicleId: string | null, excludeIds: string[] = []): number => {
    const used = new Set(
      orderItems
        .filter((i) => i.vehicle_id === vehicleId && !excludeIds.includes(i.id))
        .map((i) => i.slot_index),
    );
    let slot = 0;
    while (used.has(slot)) slot++;
    return slot;
  };

  const handleDropAtSlot = async (
    vehicleId: string | null,
    slotIndex: number,
    payload: DragPayload,
  ) => {
    if (payload.kind === "existing-multi") {
      let slot = slotIndex;
      const used = new Set(
        orderItems
          .filter((i) => i.vehicle_id === vehicleId && !payload.orderItemIds.includes(i.id))
          .map((i) => i.slot_index),
      );
      for (const id of payload.orderItemIds) {
        while (used.has(slot)) slot++;
        used.add(slot);
        await moveSlotItem(id, vehicleId, slot);
        slot++;
      }
      setSelectedIds(new Set());
      return;
    }

    if (payload.kind === "existing") {
      await moveSlotItem(payload.orderItemId, vehicleId, slotIndex);
      return;
    }

    const foxItem = itemCatalogByDisplayId.get(payload.displayId);
    if (!foxItem) return;
    const itemId = await resolveItemId(foxItem);
    if (itemId == null) {
      toastError(`Couldn't register "${foxItem.itemName}" in the catalog.`);
      return;
    }
    await addSlotItem(itemId, vehicleId, slotIndex);
  };

  const handleDropOnArea = async (vehicleId: string | null, payload: DragPayload) => {
    const excludeIds = payload.kind === "existing-multi" ? payload.orderItemIds : [];
    await handleDropAtSlot(vehicleId, computeFreeSlot(vehicleId, excludeIds), payload);
  };

  /* ── Removal (single or bulk) ────────────────────────────────────── */

  const handleRemove = async (orderItemId: string) => {
    if (selectedIds.has(orderItemId) && selectedIds.size > 1) {
      const ids = [...selectedIds];
      setSelectedIds(new Set());
      for (const id of ids) await removeSlotItem(id);
      return;
    }
    await removeSlotItem(orderItemId);
  };

  const handleRemoveSelected = async () => {
    const ids = [...selectedIds];
    setSelectedIds(new Set());
    for (const id of ids) await removeSlotItem(id);
  };

  const handleRemoveSelectedVehicles = async () => {
    const ids = [...selectedVehicleIds];
    setSelectedVehicleIds(new Set());
    for (const id of ids) await removeSlotVehicle(id);
  };

  /* ── Assign / complete (items) ────────────────────────────────────── */

  const runAssignItems = async (ids: string[]) => {
    if (!currentUserId) return;
    setSelectedIds(new Set());
    for (const id of ids) await assignSlotItem(id, currentUserId);
  };

  const runCompleteItems = async (ids: string[]) => {
    if (!currentUserId) return;
    setSelectedIds(new Set());
    for (const id of ids) await completeSlotItem(id, currentUserId);
  };

  const handleAssignSelected = () => {
    const ids = [...selectedIds];
    const hasConflict = ids.some((id) => {
      const oi = orderItems.find((i) => i.id === id);
      return oi && (oi.assigned_to != null || oi.completed);
    });
    if (hasConflict) {
      setPendingConfirm({ kind: "assign-items", ids });
      return;
    }
    runAssignItems(ids);
  };

  const handleCompleteSelected = () => {
    const ids = [...selectedIds];
    const hasConflict = ids.some((id) => {
      const oi = orderItems.find((i) => i.id === id);
      return oi && oi.assigned_to !== currentUserId;
    });
    if (hasConflict) {
      setPendingConfirm({ kind: "complete-items", ids });
      return;
    }
    runCompleteItems(ids);
  };

  const handleUncompleteSelected = async () => {
    const ids = [...selectedIds];
    setSelectedIds(new Set());
    for (const id of ids) await uncompleteSlotItem(id);
  };

  const handleUnassignSelected = async () => {
    const ids = [...selectedIds];
    setSelectedIds(new Set());
    for (const id of ids) await unassignSlotItem(id);
  };

  /* ── Assign / complete (vehicles) ─────────────────────────────────── */

  const runAssignVehicles = async (ids: string[]) => {
    if (!currentUserId) return;
    setSelectedVehicleIds(new Set());
    for (const id of ids) await assignSlotVehicle(id, currentUserId);
  };

  const runCompleteVehicles = async (ids: string[]) => {
    if (!currentUserId) return;
    setSelectedVehicleIds(new Set());
    for (const id of ids) await completeSlotVehicle(id, currentUserId);
  };

  const handleAssignSelectedVehicles = () => {
    const ids = [...selectedVehicleIds];
    const hasConflict = ids.some((id) => {
      const ov = orderVehicles.find((v) => v.id === id);
      return ov && (ov.assigned_to != null || ov.completed);
    });
    if (hasConflict) {
      setPendingConfirm({ kind: "assign-vehicles", ids });
      return;
    }
    runAssignVehicles(ids);
  };

  const handleCompleteSelectedVehicles = () => {
    const ids = [...selectedVehicleIds];
    const hasConflict = ids.some((id) => {
      const ov = orderVehicles.find((v) => v.id === id);
      return ov && ov.assigned_to !== currentUserId;
    });
    if (hasConflict) {
      setPendingConfirm({ kind: "complete-vehicles", ids });
      return;
    }
    runCompleteVehicles(ids);
  };

  const handleUncompleteSelectedVehicles = async () => {
    const ids = [...selectedVehicleIds];
    setSelectedVehicleIds(new Set());
    for (const id of ids) await uncompleteSlotVehicle(id);
  };

  const handleUnassignSelectedVehicles = async () => {
    const ids = [...selectedVehicleIds];
    setSelectedVehicleIds(new Set());
    for (const id of ids) await unassignSlotVehicle(id);
  };

  const handleConfirmPending = () => {
    if (!pendingConfirm) return;
    const { kind, ids } = pendingConfirm;
    setPendingConfirm(null);
    if (kind === "assign-items") runAssignItems(ids);
    else if (kind === "complete-items") runCompleteItems(ids);
    else if (kind === "assign-vehicles") runAssignVehicles(ids);
    else runCompleteVehicles(ids);
  };

  // Delete/Backspace deletes the current selection, unless focus is in a text field
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIds.size === 0 && selectedVehicleIds.size === 0) return;
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      e.preventDefault();
      if (selectedIds.size > 0) handleRemoveSelected();
      if (selectedVehicleIds.size > 0) handleRemoveSelectedVehicles();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, selectedVehicleIds]);

  const unassignedItems = orderItems.filter((i) => i.vehicle_id === null);
  const vehiclesWithGrids = orderVehicles.filter((ov) => resolveGridInfo(ov).slotCount > 0);

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
      {/* Header */}
      <LogisticsHeader
        order={order}
        stockpiles={stockpiles}
        onUpdate={(data) => updateActiveOrder(data)}
      />

      {/* View toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginBottom: 8,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            border: "1px solid rgba(219,218,216,0.12)",
            borderRadius: "var(--radius)",
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => setViewMode("grid")}
            style={{
              padding: "4px 10px",
              fontSize: 11,
              border: "none",
              cursor: "pointer",
              background: viewMode === "grid" ? "rgba(36,86,130,0.20)" : "transparent",
              color: viewMode === "grid" ? "var(--color-light)" : "var(--color-text-dim)",
            }}
          >
            <i className="material-icons" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }}>
              grid_view
            </i>
            Grid
          </button>
          <button
            onClick={() => setViewMode("summary")}
            style={{
              padding: "4px 10px",
              fontSize: 11,
              border: "none",
              cursor: "pointer",
              background: viewMode === "summary" ? "rgba(36,86,130,0.20)" : "transparent",
              color: viewMode === "summary" ? "var(--color-light)" : "var(--color-text-dim)",
            }}
          >
            <i className="material-icons" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }}>
              summarize
            </i>
            Summary
          </button>
        </div>
      </div>

      {viewMode === "summary" ? (
        <LogisticsSummary
          orderItems={orderItems}
          orderVehicles={orderVehicles}
          catalogById={catalogById}
          vehicleTypeById={vehicleTypeById}
          userInfoById={userInfoById}
        />
      ) : (
        <>
          {/* Vehicle sidebar + slot grids */}
          <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
            <VehicleSidebar
              vehicles={orderVehicles}
              vehicleTypeNameById={vehicleTypeNameById}
              faction={faction}
              onRemove={removeSlotVehicle}
              userInfoById={userInfoById}
            />

            <div style={{ flex: 1, minWidth: 0, overflowY: "auto", paddingRight: 4 }}>
              <UnassignedArea
                items={unassignedItems}
                catalogById={catalogById}
                userInfoById={userInfoById}
                selectedIds={selectedIds}
                dragDisabled={shiftHeld}
                onSelectItem={handleSelect}
                onShiftMouseDownItem={handleShiftMouseDown}
                onPaintHoverItem={handlePaintHover}
                onGetDragPayload={buildDragPayloadFor}
                onDropAtSlot={(slotIndex, payload) => handleDropAtSlot(null, slotIndex, payload)}
                onDropOnArea={(payload) => handleDropOnArea(null, payload)}
                onRemoveItem={handleRemove}
              />

              {vehiclesWithGrids.map((ov) => {
                const info = resolveGridInfo(ov);
                return (
                  <VehicleSlotGrid
                    key={ov.id}
                    vehicle={ov}
                    vehicleTypeName={info.typeName}
                    slotCount={info.slotCount}
                    slotCols={info.slotCols}
                    items={orderItems.filter((i) => i.vehicle_id === ov.id)}
                    catalogById={catalogById}
                    userInfoById={userInfoById}
                    selectedIds={selectedIds}
                    dragDisabled={shiftHeld}
                    onSelectItem={handleSelect}
                    onShiftMouseDownItem={handleShiftMouseDown}
                    onPaintHoverItem={handlePaintHover}
                    onGetDragPayload={buildDragPayloadFor}
                    onDropAtSlot={(slotIndex, payload) => handleDropAtSlot(ov.id, slotIndex, payload)}
                    onDropOnGrid={(payload) => handleDropOnArea(ov.id, payload)}
                    onRemoveItem={handleRemove}
                    onRemoveVehicle={() => removeSlotVehicle(ov.id)}
                    vehicleSelected={selectedVehicleIds.has(ov.id)}
                    onSelectVehicle={(additive) => handleSelectVehicle(ov.id, additive)}
                  />
                );
              })}
            </div>
          </div>

          {/* Item catalog panel */}
          <div style={{ marginTop: 12, flexShrink: 0 }}>
            <ItemCatalog
              itemCatalog={itemCatalog}
              faction={faction}
              catalogFilter={catalogFilter}
              onFilterChange={setCatalogFilter}
            />
          </div>
        </>
      )}

      {/* Delete order button */}
      <div
        style={{
          borderTop: "1px solid rgba(219,218,216,0.08)",
          paddingTop: 12,
          marginTop: 12,
          display: "flex",
          justifyContent: "flex-end",
          flexShrink: 0,
        }}
      >
        <button
          className="btn btn-small"
          style={{
            background: "transparent",
            color: "var(--color-danger, #b33a3a)",
            border: "1px solid rgba(179,58,58,0.3)",
            fontSize: 12,
          }}
          onClick={() => setConfirmDelete(true)}
        >
          <i
            className="material-icons"
            style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }}
          >
            delete
          </i>
          Delete Order
        </button>
      </div>
      </div>

      {/* Selection actions — vertical menu, to the right of everything else */}
      {viewMode === "grid" && (selectedIds.size > 0 || selectedVehicleIds.size > 0) && (
        <div
          style={{
            width: 160,
            flexShrink: 0,
            marginLeft: 10,
            paddingLeft: 10,
            borderLeft: "1px solid rgba(219,218,216,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            overflowY: "auto",
          }}
        >
          {selectedIds.size > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                padding: "8px",
                border: "1px solid rgba(219,218,216,0.08)",
                borderRadius: "var(--radius)",
                fontSize: 11,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <i className="material-icons" style={{ fontSize: 13, color: "var(--color-secondary)" }}>
                  check_box
                </i>
                <span style={{ color: "var(--color-light)" }}>
                  {selectedIds.size} item{selectedIds.size > 1 ? "s" : ""} selected
                </span>
              </div>
              <span style={{ color: "var(--color-text-dim)", fontSize: 10 }}>
                Drag any of them to move together
              </span>

              <button
                className="btn-flat"
                style={{ width: "100%", textAlign: "left", fontSize: 11, color: "#4a9cd6", marginTop: 4 }}
                onClick={handleAssignSelected}
              >
                <i className="material-icons" style={{ fontSize: 13, verticalAlign: "middle", marginRight: 4 }}>
                  person_add
                </i>
                Assign
              </button>
              <button
                className="btn-flat"
                style={{ width: "100%", textAlign: "left", fontSize: 11, color: "var(--color-text-dim)" }}
                onClick={handleUnassignSelected}
              >
                <i className="material-icons" style={{ fontSize: 13, verticalAlign: "middle", marginRight: 4 }}>
                  person_off
                </i>
                Unassign
              </button>
              <button
                className="btn-flat"
                style={{ width: "100%", textAlign: "left", fontSize: 11, color: "var(--color-success, #3a7d44)" }}
                onClick={handleCompleteSelected}
              >
                <i className="material-icons" style={{ fontSize: 13, verticalAlign: "middle", marginRight: 4 }}>
                  check_circle
                </i>
              Completed
              </button>
              <button
                className="btn-flat"
                style={{ width: "100%", textAlign: "left", fontSize: 11, color: "var(--color-text-dim)" }}
                onClick={handleUncompleteSelected}
              >
                <i className="material-icons" style={{ fontSize: 13, verticalAlign: "middle", marginRight: 4 }}>
                  remove_done
                </i>
                Uncomplete
              </button>
              <button
                className="btn-flat"
                style={{ width: "100%", textAlign: "left", fontSize: 11, color: "var(--color-danger)" }}
                onClick={handleRemoveSelected}
              >
                <i className="material-icons" style={{ fontSize: 13, verticalAlign: "middle", marginRight: 4 }}>
                  delete
                </i>
                Delete
              </button>
              <button
                className="btn-flat"
                style={{ width: "100%", textAlign: "left", fontSize: 11, color: "var(--color-text-dim)" }}
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </button>
            </div>
          )}

          {selectedVehicleIds.size > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                padding: "8px",
                border: "1px solid rgba(219,218,216,0.08)",
                borderRadius: "var(--radius)",
                fontSize: 11,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <i className="material-icons" style={{ fontSize: 13, color: "var(--color-secondary)" }}>
                  local_shipping
                </i>
                <span style={{ color: "var(--color-light)" }}>
                  {selectedVehicleIds.size} vehicle{selectedVehicleIds.size > 1 ? "s" : ""} selected
                </span>
              </div>

              <button
                className="btn-flat"
                style={{ width: "100%", textAlign: "left", fontSize: 11, color: "#4a9cd6", marginTop: 4 }}
                onClick={handleAssignSelectedVehicles}
              >
                <i className="material-icons" style={{ fontSize: 13, verticalAlign: "middle", marginRight: 4 }}>
                  person_add
                </i>
                Assign all to me
              </button>
              <button
                className="btn-flat"
                style={{ width: "100%", textAlign: "left", fontSize: 11, color: "var(--color-text-dim)" }}
                onClick={handleUnassignSelectedVehicles}
              >
                <i className="material-icons" style={{ fontSize: 13, verticalAlign: "middle", marginRight: 4 }}>
                  person_off
                </i>
                Unassign
              </button>
              <button
                className="btn-flat"
                style={{ width: "100%", textAlign: "left", fontSize: 11, color: "var(--color-success, #3a7d44)" }}
                onClick={handleCompleteSelectedVehicles}
              >
                <i className="material-icons" style={{ fontSize: 13, verticalAlign: "middle", marginRight: 4 }}>
                  check_circle
                </i>
                Mark as completed
              </button>
              <button
                className="btn-flat"
                style={{ width: "100%", textAlign: "left", fontSize: 11, color: "var(--color-text-dim)" }}
                onClick={handleUncompleteSelectedVehicles}
              >
                <i className="material-icons" style={{ fontSize: 13, verticalAlign: "middle", marginRight: 4 }}>
                  remove_done
                </i>
                Unmark completed
              </button>
              <button
                className="btn-flat"
                style={{ width: "100%", textAlign: "left", fontSize: 11, color: "var(--color-danger)" }}
                onClick={handleRemoveSelectedVehicles}
              >
                <i className="material-icons" style={{ fontSize: 13, verticalAlign: "middle", marginRight: 4 }}>
                  delete
                </i>
                Delete
              </button>
              <button
                className="btn-flat"
                style={{ width: "100%", textAlign: "left", fontSize: 11, color: "var(--color-text-dim)" }}
                onClick={() => setSelectedVehicleIds(new Set())}
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {/* Confirm delete */}
      <ConfirmModal
        open={confirmDelete}
        title={`Delete "${order.name}"?`}
        message="This order and everything placed in it will be permanently deleted."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          deleteActiveOrder(order.id);
          setConfirmDelete(false);
        }}
        onCancel={() => setConfirmDelete(false)}
      />

      {/* Confirm assign/complete when the selection looks like it might be a mistake */}
      <ConfirmModal
        open={pendingConfirm !== null}
        title={
          pendingConfirm?.kind.startsWith("assign")
            ? "Reassign to yourself?"
            : "Mark as completed?"
        }
        message={
          pendingConfirm?.kind.startsWith("assign")
            ? "Some of these are already assigned to someone (possibly you) or already marked as completed. Assign them to yourself anyway?"
            : "Some of these aren't currently assigned to you. Mark them as completed anyway?"
        }
        confirmLabel={pendingConfirm?.kind.startsWith("assign") ? "Assign to me" : "Mark completed"}
        onConfirm={handleConfirmPending}
        onCancel={() => setPendingConfirm(null)}
      />
    </div>
  );
}
