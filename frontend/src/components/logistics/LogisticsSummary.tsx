/* ── Summary view — total unit counts per item/vehicle type ───────── */

import { useState } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useLogisticsStore } from "../../stores/logisticsStore";
import { toastError, toastSuccess } from "../common/Toast";
import ConfirmModal from "../common/ConfirmModal";
import Tooltip from "../common/Tooltip";
import UserAvatar from "../common/UserAvatar";
import type { UserInfo } from "../../utils/userNames";
import type {
  CatalogItem,
  CatalogVehicleType,
  LogisticsOrderItem,
  LogisticsOrderVehicle,
} from "../../types/models";

interface Props {
  orderItems: LogisticsOrderItem[];
  orderVehicles: LogisticsOrderVehicle[];
  catalogById: Map<number, CatalogItem>;
  vehicleTypeById: Map<number, CatalogVehicleType>;
  userInfoById: Map<string, UserInfo>;
}

/** Per-person instance counts, e.g. { userId: 3 } — built from a row's instances. */
function countByUser(instances: Trackable[], completed: boolean): Map<string, number> {
  const counts = new Map<string, number>();
  for (const inst of instances) {
    if (inst.completed !== completed || !inst.assigned_to) continue;
    counts.set(inst.assigned_to, (counts.get(inst.assigned_to) ?? 0) + 1);
  }
  return counts;
}

/** "Alice: 3, Bob: 2" — used for both the text badges and the facepile tooltips. */
function formatBreakdown(counts: Map<string, number>, userInfoById: Map<string, UserInfo>): string {
  return [...counts.entries()]
    .map(([userId, count]) => `${userInfoById.get(userId)?.name ?? "Unknown"}: ${count}`)
    .join(", ");
}

/** The fields the summary's bulk actions need — shared by items and vehicles. */
interface Trackable {
  id: string;
  assigned_to: string | null;
  completed: boolean;
}

interface SummaryRowData {
  key: number;
  name: string;
  subtitle?: string;
  iconUrl?: string | null;
  fallbackIcon: string;
  count: number;
  /** Actual material units this row's crates unpack to (count × crate_size). */
  materialCount?: number;
  instances: Trackable[];
}

/** 1000+ shown as "1.2K" (one decimal, dropped when whole); below that, as-is. */
function formatCount(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${Number.isInteger(k) ? k : k.toFixed(1)}K`;
}

/** Bag of store actions a row menu needs — passed in so item/vehicle rows share one UI. */
interface RowActions {
  assign: (id: string, userId: string) => Promise<void>;
  unassign: (id: string) => Promise<void>;
  complete: (id: string, userId: string) => Promise<void>;
  uncomplete: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export default function LogisticsSummary({
  orderItems,
  orderVehicles,
  catalogById,
  vehicleTypeById,
  userInfoById,
}: Props) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const {
    assignSlotItem,
    unassignSlotItem,
    completeSlotItem,
    uncompleteSlotItem,
    removeSlotItem,
    assignSlotVehicle,
    unassignSlotVehicle,
    completeSlotVehicle,
    uncompleteSlotVehicle,
    removeSlotVehicle,
  } = useLogisticsStore();

  const itemActions: RowActions = {
    assign: assignSlotItem,
    unassign: unassignSlotItem,
    complete: completeSlotItem,
    uncomplete: uncompleteSlotItem,
    remove: removeSlotItem,
  };
  const vehicleActions: RowActions = {
    assign: assignSlotVehicle,
    unassign: unassignSlotVehicle,
    complete: completeSlotVehicle,
    uncomplete: uncompleteSlotVehicle,
    remove: removeSlotVehicle,
  };

  const itemGroups = new Map<number, LogisticsOrderItem[]>();
  for (const oi of orderItems) {
    const arr = itemGroups.get(oi.item_id) ?? [];
    arr.push(oi);
    itemGroups.set(oi.item_id, arr);
  }
  const itemRows: SummaryRowData[] = [...itemGroups.entries()]
    .map(([itemId, instances]) => {
      const catalogItem = catalogById.get(itemId);
      return {
        key: itemId,
        name: catalogItem?.name ?? `Item #${itemId}`,
        subtitle: catalogItem?.category,
        iconUrl: catalogItem?.icon_url,
        fallbackIcon: "inventory_2",
        count: instances.length,
        materialCount: catalogItem ? instances.length * catalogItem.crate_size : undefined,
        instances,
      };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const vehicleGroups = new Map<number, LogisticsOrderVehicle[]>();
  for (const ov of orderVehicles) {
    const arr = vehicleGroups.get(ov.vehicle_type_id) ?? [];
    arr.push(ov);
    vehicleGroups.set(ov.vehicle_type_id, arr);
  }
  const vehicleRows: SummaryRowData[] = [...vehicleGroups.entries()]
    .map(([typeId, instances]) => {
      const vt = vehicleTypeById.get(typeId);
      return {
        key: typeId,
        name: vt?.name ?? `Vehicle Type #${typeId}`,
        subtitle: vt?.category,
        iconUrl: vt?.icon_url,
        fallbackIcon: "local_shipping",
        count: instances.length,
        instances,
      };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const totalItemUnits = orderItems.length;
  const totalVehicles = orderVehicles.length;

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <SummarySection
        icon="inventory_2"
        title={`Items — ${formatCount(totalItemUnits)} crate${totalItemUnits === 1 ? "" : "s"}, ${itemRows.length} type${itemRows.length === 1 ? "" : "s"}`}
        rows={itemRows}
        emptyText="No items added yet."
        unitLabel="crate"
        actions={itemActions}
        currentUserId={currentUserId}
        userInfoById={userInfoById}
      />
      <SummarySection
        icon="local_shipping"
        title={`Vehicles — ${totalVehicles} vehicle${totalVehicles === 1 ? "" : "s"}, ${vehicleRows.length} type${vehicleRows.length === 1 ? "" : "s"}`}
        rows={vehicleRows}
        emptyText="No vehicles added yet."
        actions={vehicleActions}
        currentUserId={currentUserId}
        userInfoById={userInfoById}
      />
    </div>
  );
}

function SummarySection({
  icon,
  title,
  rows,
  emptyText,
  unitLabel,
  actions,
  currentUserId,
  userInfoById,
}: {
  icon: string;
  title: string;
  rows: SummaryRowData[];
  emptyText: string;
  /** e.g. "crate" — pluralizes onto the count badge ("3 crates"). Omit for a plain "×N". */
  unitLabel?: string;
  actions: RowActions;
  currentUserId: string | undefined;
  userInfoById: Map<string, UserInfo>;
}) {
  const [openKey, setOpenKey] = useState<number | null>(null);
  const [confirmDeleteRow, setConfirmDeleteRow] = useState<SummaryRowData | null>(null);

  return (
    <div className="card" style={{ margin: 0, overflow: "visible" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "10px 12px",
          borderBottom: "1px solid rgba(219,218,216,0.08)",
        }}
      >
        <i className="material-icons" style={{ fontSize: 16, color: "var(--color-text-dim)" }}>
          {icon}
        </i>
        <span
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 1,
            color: "var(--color-text-dim)",
          }}
        >
          {title}
        </span>
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            padding: 16,
            textAlign: "center",
            fontSize: 13,
            color: "var(--color-text-dim)",
          }}
        >
          {emptyText}
        </div>
      ) : (
        <div
          style={{
            padding: 8,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 4,
            overflow: "visible",
          }}
        >
          {rows.map((r) => {
            const assignedByUser = countByUser(r.instances, false);
            const completedByUser = countByUser(r.instances, true);
            const assignedCount = [...assignedByUser.values()].reduce((a, b) => a + b, 0);
            const completedCount = [...completedByUser.values()].reduce((a, b) => a + b, 0);
            const assignedBreakdown = formatBreakdown(assignedByUser, userInfoById);
            const completedBreakdown = formatBreakdown(completedByUser, userInfoById);
            return (
              <div
                key={r.key}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  borderRadius: "var(--radius)",
                  background: "rgba(219,218,216,0.03)",
                }}
              >
                {r.iconUrl ? (
                  <img
                    src={r.iconUrl}
                    alt=""
                    style={{ width: 26, height: 26, objectFit: "contain", flexShrink: 0 }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.visibility = "hidden";
                    }}
                  />
                ) : (
                  <i
                    className="material-icons"
                    style={{ fontSize: 20, color: "var(--color-text-dim)", flexShrink: 0 }}
                  >
                    {r.fallbackIcon}
                  </i>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--color-text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.name}
                  </div>
                  {r.subtitle && (
                    <div style={{ fontSize: 10, color: "var(--color-text-dim)" }}>
                      {r.subtitle}
                    </div>
                  )}
                  {r.materialCount !== undefined && (
                    <div style={{ fontSize: 10, color: "var(--color-text-dim)" }}>
                      = {formatCount(r.materialCount)} materials
                    </div>
                  )}
                  {(completedCount > 0 || assignedCount > 0) && (
                    <div style={{ fontSize: 10, display: "flex", gap: 6, marginTop: 2 }}>
                      {assignedCount > 0 && (
                        <Tooltip content={assignedBreakdown}>
                          <span style={{ color: "#4a9cd6" }}>● {assignedCount} assigned</span>
                        </Tooltip>
                      )}
                      {completedCount > 0 && (
                        <Tooltip content={completedBreakdown}>
                          <span style={{ color: "var(--color-success, #3a7d44)" }}>
                            ● {completedCount} done
                          </span>
                        </Tooltip>
                      )}
                    </div>
                  )}
                </div>
                {(assignedByUser.size > 0 || completedByUser.size > 0) && (
                  <div style={{ position: "absolute", top: -6, right: -6, display: "flex", gap: 3 }}>
                    {assignedByUser.size > 0 && (
                      <Tooltip content={assignedBreakdown}>
                        <FacePile
                          userIds={[...assignedByUser.keys()]}
                          ringColor="#4a9cd6"
                          userInfoById={userInfoById}
                        />
                      </Tooltip>
                    )}
                    {completedByUser.size > 0 && (
                      <Tooltip content={completedBreakdown}>
                        <FacePile
                          userIds={[...completedByUser.keys()]}
                          ringColor="var(--color-success, #3a7d44)"
                          userInfoById={userInfoById}
                        />
                      </Tooltip>
                    )}
                  </div>
                )}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--color-secondary)",
                    background: "rgba(36,86,130,0.15)",
                    borderRadius: 10,
                    padding: "1px 8px",
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  {unitLabel
                    ? `${formatCount(r.count)} ${unitLabel}${r.count === 1 ? "" : "s"}`
                    : `×${formatCount(r.count)}`}
                </span>

                <button
                  onClick={() => setOpenKey(openKey === r.key ? null : r.key)}
                  title="Actions"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--color-text-dim)",
                    cursor: "pointer",
                    padding: 0,
                    flexShrink: 0,
                  }}
                >
                  <i className="material-icons" style={{ fontSize: 18 }}>
                    more_vert
                  </i>
                </button>

                {openKey === r.key && (
                  <RowActionsMenu
                    row={r}
                    actions={actions}
                    currentUserId={currentUserId}
                    unitLabel={unitLabel ?? "item"}
                    onClose={() => setOpenKey(null)}
                    onRequestDeleteAll={() => {
                      setOpenKey(null);
                      setConfirmDeleteRow(r);
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={confirmDeleteRow !== null}
        title={`Delete all "${confirmDeleteRow?.name}"?`}
        message={`This removes all ${confirmDeleteRow?.count} of them from the order.`}
        confirmLabel="Delete all"
        danger
        onConfirm={async () => {
          const row = confirmDeleteRow;
          setConfirmDeleteRow(null);
          if (!row) return;
          for (const inst of row.instances) await actions.remove(inst.id);
        }}
        onCancel={() => setConfirmDeleteRow(null)}
      />
    </div>
  );
}

function RowActionsMenu({
  row,
  actions,
  currentUserId,
  unitLabel,
  onClose,
  onRequestDeleteAll,
}: {
  row: SummaryRowData;
  actions: RowActions;
  currentUserId: string | undefined;
  unitLabel: string;
  onClose: () => void;
  onRequestDeleteAll: () => void;
}) {
  const [qty, setQty] = useState(1);

  const pending = row.instances.filter((i) => i.assigned_to == null);
  const myAssigned = row.instances.filter(
    (i) => !i.completed && i.assigned_to === currentUserId,
  );

  const handleAssignN = async () => {
    if (pending.length < qty) {
      toastError(`Only ${pending.length} unassigned — can't assign ${qty}.`);
      return;
    }
    if (!currentUserId) return;
    for (const inst of pending.slice(0, qty)) await actions.assign(inst.id, currentUserId);
    toastSuccess(`Assigned ${qty} to you`);
    onClose();
  };

  const handleUnassignN = async () => {
    if (myAssigned.length < qty) {
      toastError(`Only ${myAssigned.length} assigned to you — can't unassign ${qty}.`);
      return;
    }
    for (const inst of myAssigned.slice(0, qty)) await actions.unassign(inst.id);
    toastSuccess(`Unassigned ${qty}`);
    onClose();
  };

  const handleCompleteN = async () => {
    if (myAssigned.length < qty) {
      toastError(`Only ${myAssigned.length} assigned to you — can't complete ${qty}.`);
      return;
    }
    if (!currentUserId) return;
    for (const inst of myAssigned.slice(0, qty)) await actions.complete(inst.id, currentUserId);
    toastSuccess(`Completed ${qty}`);
    onClose();
  };

  const handleAssignAll = async () => {
    if (!currentUserId) return;
    for (const inst of row.instances) await actions.assign(inst.id, currentUserId);
    onClose();
  };

  const handleUnassignAll = async () => {
    for (const inst of row.instances.filter((i) => i.assigned_to != null)) {
      await actions.unassign(inst.id);
    }
    onClose();
  };

  const handleCompleteAll = async () => {
    if (!currentUserId) return;
    for (const inst of row.instances) await actions.complete(inst.id, currentUserId);
    onClose();
  };

  const handleUncompleteAll = async () => {
    for (const inst of row.instances.filter((i) => i.completed)) await actions.uncomplete(inst.id);
    onClose();
  };

  return (
    <>
      {/* Click-outside backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 90 }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: "100%",
          right: 0,
          marginTop: 4,
          zIndex: 100,
          background: "var(--color-surface)",
          border: "1px solid rgba(219,218,216,0.12)",
          borderRadius: "var(--radius)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          minWidth: 220,
          padding: 10,
          fontSize: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <label style={{ color: "var(--color-text-dim)", fontSize: 11 }}>Quantity</label>
          <input
            type="number"
            min={1}
            max={row.count}
            value={qty}
            onChange={(e) =>
              setQty(Math.max(1, Math.min(row.count, parseInt(e.target.value) || 1)))
            }
            style={{ width: 56, fontSize: 12, textAlign: "center" }}
          />
          <span style={{ color: "var(--color-text-dim)", fontSize: 11 }}>/ {row.count}</span>
        </div>

        <button
          onClick={handleAssignN}
          style={menuButtonStyle("#4a9cd6")}
        >
          <i className="material-icons" style={menuIconStyle}>person_add</i>
          Assign {qty} to me
        </button>
        <button onClick={handleUnassignN} style={menuButtonStyle("var(--color-text-dim)")}>
          <i className="material-icons" style={menuIconStyle}>person_off</i>
          Unassign {qty}
        </button>
        <button onClick={handleCompleteN} style={menuButtonStyle("var(--color-success, #3a7d44)")}>
          <i className="material-icons" style={menuIconStyle}>check_circle</i>
          Complete {qty}
        </button>

        <div style={{ borderTop: "1px solid rgba(219,218,216,0.08)", margin: "8px 0" }} />

        <button onClick={handleAssignAll} style={menuButtonStyle("#4a9cd6")}>
          <i className="material-icons" style={menuIconStyle}>done_all</i>
          Assign all to me
        </button>
        <button onClick={handleUnassignAll} style={menuButtonStyle("var(--color-text-dim)")}>
          <i className="material-icons" style={menuIconStyle}>person_off</i>
          Unassign all
        </button>
        <button onClick={handleCompleteAll} style={menuButtonStyle("var(--color-success, #3a7d44)")}>
          <i className="material-icons" style={menuIconStyle}>task_alt</i>
          Mark all as completed
        </button>
        <button onClick={handleUncompleteAll} style={menuButtonStyle("var(--color-text-dim)")}>
          <i className="material-icons" style={menuIconStyle}>remove_done</i>
          Unmark all
        </button>
        <button onClick={onRequestDeleteAll} style={menuButtonStyle("var(--color-danger)")}>
          <i className="material-icons" style={menuIconStyle}>delete_sweep</i>
          Delete all {unitLabel}s
        </button>
      </div>
    </>
  );
}

const FACEPILE_MAX = 3;

function FacePile({
  userIds,
  ringColor,
  userInfoById,
}: {
  userIds: string[];
  ringColor: string;
  userInfoById: Map<string, UserInfo>;
}) {
  const shown = userIds.slice(0, FACEPILE_MAX);
  const overflow = userIds.length - shown.length;
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {shown.map((userId, i) => (
        <UserAvatar
          key={userId}
          avatarUrl={userInfoById.get(userId)?.avatarUrl}
          size={16}
          color={ringColor}
          style={{ marginLeft: i === 0 ? 0 : -6, zIndex: shown.length - i }}
        />
      ))}
      {overflow > 0 && (
        <span
          style={{
            marginLeft: -6,
            width: 16,
            height: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            color: "var(--color-text-dim)",
            background: "var(--color-surface)",
            border: `1px solid ${ringColor}`,
            borderRadius: "50%",
          }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

function menuButtonStyle(color: string): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 6,
    width: "100%",
    padding: "6px 6px",
    background: "none",
    border: "none",
    textAlign: "left",
    cursor: "pointer",
    fontSize: 12,
    color,
    borderRadius: "var(--radius)",
  };
}

const menuIconStyle: React.CSSProperties = { fontSize: 15, flexShrink: 0 };
