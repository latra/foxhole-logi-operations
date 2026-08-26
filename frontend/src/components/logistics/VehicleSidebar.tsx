/* ── Vehicle sidebar within the editor — list + add vehicle ───────── */

import { useRef, useState } from "react";
import { useLogisticsStore } from "../../stores/logisticsStore";
import { useAuthStore } from "../../stores/authStore";
import { toastError } from "../common/Toast";
import { TooltipBubble } from "../common/Tooltip";
import UserAvatar from "../common/UserAvatar";
import type { LogisticsOrderVehicle, VehicleDefinition } from "../../types/models";
import type { UserInfo } from "../../utils/userNames";
import type { CSSProperties } from "react";

interface Props {
  vehicles: LogisticsOrderVehicle[];
  vehicleTypeNameById: Map<number, string>;
  faction: "COLONIAL" | "WARDEN" | "NEUTRAL";
  onRemove: (vehicleId: string) => void;
  userInfoById: Map<string, UserInfo>;
}

const CATEGORY_ICON: Record<string, string> = {
  truck: "local_shipping",
  ship: "directions_boat",
  train: "tram",
  crane: "construction",
  motorcycle: "two_wheeler",
  armored_car: "directions_car",
  half_track: "airport_shuttle",
  tank: "shield",
  other: "commute",
};

const CATEGORY_LABEL: Record<string, string> = {
  truck: "Trucks",
  ship: "Ships",
  train: "Trains",
  crane: "Cranes",
  motorcycle: "Scout / Motorcycles",
  armored_car: "Armored Cars",
  half_track: "Half-Tracks",
  tank: "Tanks",
  other: "Other",
};

export default function VehicleSidebar({
  vehicles,
  vehicleTypeNameById,
  faction,
  onRemove,
  userInfoById,
}: Props) {
  const {
    vehicleDefinitions,
    resolveVehicleTypeId,
    addSlotVehicle,
    assignSlotVehicle,
    unassignSlotVehicle,
    completeSlotVehicle,
    uncompleteSlotVehicle,
  } = useLogisticsStore();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addingCode, setAddingCode] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [tooltipRowId, setTooltipRowId] = useState<string | null>(null);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const isSearching = searchTerm.trim() !== "";

  const availableDefs = vehicleDefinitions.filter(
    (d) => d.faction === faction || d.faction === "NEUTRAL",
  );
  const filteredDefs = availableDefs.filter(
    (d) => !isSearching || d.name.toLowerCase().includes(searchTerm.trim().toLowerCase()),
  );
  const groupedDefs = new Map<string, VehicleDefinition[]>();
  for (const d of filteredDefs) {
    const group = groupedDefs.get(d.category) ?? [];
    group.push(d);
    groupedDefs.set(d.category, group);
  }

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const handlePick = async (def: VehicleDefinition) => {
    if (addingCode) return;
    setAddingCode(def.id);
    try {
      const vehicleTypeId = await resolveVehicleTypeId(def);
      if (vehicleTypeId == null) {
        toastError(`Couldn't register "${def.name}" in the catalog.`);
        return;
      }
      await addSlotVehicle(vehicleTypeId);
      setShowAddMenu(false);
    } finally {
      setAddingCode(null);
    }
  };

  const handleAssign = (vehicleId: string) => {
    if (currentUserId) assignSlotVehicle(vehicleId, currentUserId);
  };
  const handleUnassign = (vehicleId: string) => unassignSlotVehicle(vehicleId);
  const handleComplete = (vehicleId: string) => {
    if (currentUserId) completeSlotVehicle(vehicleId, currentUserId);
  };
  const handleUncomplete = (vehicleId: string) => uncompleteSlotVehicle(vehicleId);

  return (
    <div
      style={{
        width: 160,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        borderRight: "1px solid rgba(219,218,216,0.08)",
        paddingRight: 10,
        marginRight: 10,
      }}
    >
      <div
        style={{
          color: "var(--color-text-dim)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 4,
        }}
      >
        Vehicles
      </div>

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {vehicles.length === 0 && (
          <div style={{ fontSize: 11, color: "var(--color-text-dim)", padding: "4px 2px" }}>
            No vehicles yet.
          </div>
        )}
        {vehicles.map((v) => (
          <div
            key={v.id}
            className="vehicle-sidebar-entry"
            onClick={() => {
              document
                .getElementById(`vehicle-grid-${v.id}`)
                ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 4,
              padding: "6px 8px",
              borderRadius: "var(--radius)",
              cursor: "pointer",
              marginBottom: 2,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = "rgba(219,218,216,0.04)";
              const btn = e.currentTarget.querySelector<HTMLButtonElement>(".remove-btn");
              if (btn) btn.style.opacity = "1";
              if (v.completed || v.assigned_to) {
                if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
                tooltipTimeoutRef.current = setTimeout(() => setTooltipRowId(v.id), 1000);
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = "transparent";
              const btn = e.currentTarget.querySelector<HTMLButtonElement>(".remove-btn");
              if (btn) btn.style.opacity = "0";
              if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
              setTooltipRowId((id) => (id === v.id ? null : id));
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--color-light)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {v.completed && (
                  <i
                    className="material-icons"
                    style={{ fontSize: 13, color: "var(--color-success, #3a7d44)", flexShrink: 0 }}
                  >
                    check_circle
                  </i>
                )}
                {!v.completed && v.assigned_to && (
                  <UserAvatar
                    avatarUrl={userInfoById.get(v.assigned_to)?.avatarUrl}
                    size={13}
                    color="#4a9cd6"
                  />
                )}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {v.display_name}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--color-text-dim)" }}>
                {vehicleTypeNameById.get(v.vehicle_type_id) ?? "Unknown"}
              </div>
            </div>
            {(v.completed || v.assigned_to) && tooltipRowId === v.id && (
              <TooltipBubble
                content={`${v.completed ? "Completed by" : "Assigned to"} ${
                  v.assigned_to ? (userInfoById.get(v.assigned_to)?.name ?? "Unknown") : "Unknown"
                }`}
              />
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
              <div style={{ position: "relative" }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(openMenuId === v.id ? null : v.id);
                  }}
                  title="Vehicle actions"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--color-text-dim)",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <i className="material-icons" style={{ fontSize: 15 }}>
                    more_vert
                  </i>
                </button>

                {openMenuId === v.id && (
                  <>
                    <div
                      style={{ position: "fixed", inset: 0, zIndex: 90 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(null);
                      }}
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
                        minWidth: 150,
                        padding: 4,
                      }}
                    >
                      <button
                        className="btn-flat"
                        style={vehicleMenuButtonStyle("#4a9cd6")}
                        onClick={() => {
                          handleAssign(v.id);
                          setOpenMenuId(null);
                        }}
                      >
                        <i className="material-icons" style={{ fontSize: 14 }}>person_add</i>
                        Assign to me
                      </button>
                      <button
                        className="btn-flat"
                        style={vehicleMenuButtonStyle("var(--color-text-dim)")}
                        onClick={() => {
                          handleUnassign(v.id);
                          setOpenMenuId(null);
                        }}
                      >
                        <i className="material-icons" style={{ fontSize: 14 }}>person_off</i>
                        Unassign
                      </button>
                      <button
                        className="btn-flat"
                        style={vehicleMenuButtonStyle("var(--color-success, #3a7d44)")}
                        onClick={() => {
                          handleComplete(v.id);
                          setOpenMenuId(null);
                        }}
                      >
                        <i className="material-icons" style={{ fontSize: 14 }}>check_circle</i>
                        Mark as completed
                      </button>
                      <button
                        className="btn-flat"
                        style={vehicleMenuButtonStyle("var(--color-text-dim)")}
                        onClick={() => {
                          handleUncomplete(v.id);
                          setOpenMenuId(null);
                        }}
                      >
                        <i className="material-icons" style={{ fontSize: 14 }}>remove_done</i>
                        Unmark completed
                      </button>
                    </div>
                  </>
                )}
              </div>

              <button
                className="remove-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(v.id);
                }}
                title="Remove vehicle"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--color-danger, #b33a3a)",
                  cursor: "pointer",
                  padding: 0,
                  opacity: 0,
                  transition: "opacity 150ms ease",
                  flexShrink: 0,
                }}
              >
                <i className="material-icons" style={{ fontSize: 15 }}>
                  close
                </i>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ position: "relative" }}>
        <button
          className="btn btn-secondary btn-small"
          onClick={() => setShowAddMenu(!showAddMenu)}
          style={{ width: "100%", fontSize: 11 }}
        >
          <i
            className="material-icons"
            style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }}
          >
            {showAddMenu ? "close" : "add"}
          </i>
          {showAddMenu ? "Close" : "Add vehicle"}
        </button>

        {showAddMenu && (
          <div
            style={{
              position: "absolute",
              bottom: "100%",
              left: 0,
              background: "var(--color-surface)",
              border: "1px solid rgba(219,218,216,0.12)",
              borderRadius: "var(--radius)",
              zIndex: 50,
              marginBottom: 4,
              minWidth: 240,
              maxHeight: 420,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ padding: 8, borderBottom: "1px solid rgba(219,218,216,0.08)" }}>
              <input
                type="text"
                autoFocus
                placeholder="Search vehicles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: "100%", fontSize: 12 }}
              />
            </div>

            <div style={{ overflowY: "auto" }}>
              {filteredDefs.length === 0 && (
                <div style={{ padding: 12, fontSize: 12, color: "var(--color-text-dim)" }}>
                  No vehicles match.
                </div>
              )}
              {[...groupedDefs.entries()].map(([category, defs]) => {
                // While searching, every matching category is force-expanded
                // so results are visible without having to open each one.
                const isOpen = isSearching || expandedCategories.has(category);
                return (
                  <div key={category}>
                    <button
                      type="button"
                      onClick={() => !isSearching && toggleCategory(category)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 10px",
                        background: "rgba(219,218,216,0.03)",
                        border: "none",
                        borderTop: "1px solid rgba(219,218,216,0.06)",
                        cursor: isSearching ? "default" : "pointer",
                        textAlign: "left",
                      }}
                    >
                      <i
                        className="material-icons"
                        style={{ fontSize: 16, color: "var(--color-text-dim)" }}
                      >
                        {isOpen ? "expand_more" : "chevron_right"}
                      </i>
                      <i
                        className="material-icons"
                        style={{ fontSize: 15, color: "var(--color-text-dim)" }}
                      >
                        {CATEGORY_ICON[category] ?? "commute"}
                      </i>
                      <span
                        style={{
                          flex: 1,
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                          color: "var(--color-text)",
                        }}
                      >
                        {CATEGORY_LABEL[category] ?? category}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--color-text-dim)" }}>
                        {defs.length}
                      </span>
                    </button>

                    {isOpen &&
                      defs.map((def) => {
                        const isAdding = addingCode === def.id;
                        return (
                          <div
                            key={def.id}
                            onClick={() => handlePick(def)}
                            style={{
                              padding: "6px 10px 6px 32px",
                              fontSize: 12,
                              color: "var(--color-text)",
                              cursor: addingCode ? "default" : "pointer",
                              opacity: isAdding ? 0.5 : 1,
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                            onMouseEnter={(e) => {
                              if (addingCode) return;
                              (e.currentTarget as HTMLDivElement).style.background =
                                "rgba(36,86,130,0.10)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLDivElement).style.background =
                                "transparent";
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div>{def.name}</div>
                              <div style={{ color: "var(--color-text-dim)", fontSize: 10 }}>
                                {def.slotCount === 0 ? "No cargo slots" : `${def.slotCount} slots`}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function vehicleMenuButtonStyle(color: string): CSSProperties {
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
    fontSize: 11,
    color,
    borderRadius: "var(--radius)",
  };
}
