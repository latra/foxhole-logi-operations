/* ── Vehicle list sidebar within the editor ──────────────────────── */

import { useState } from "react";
import type {
  LogisticsListVehicle,
  VehicleDefinition,
} from "../../types/models";

interface Props {
  vehicles: LogisticsListVehicle[];
  vehicleDefinitions: VehicleDefinition[];
  faction: "COLONIAL" | "WARDEN" | "NEUTRAL";
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string | null) => void;
  onAddVehicle: (vehicleDefId: string) => void;
  onRemoveVehicle: (vehicleId: string) => void;
}

export default function VehicleSidebar({
  vehicles,
  vehicleDefinitions,
  faction,
  selectedVehicleId,
  onSelectVehicle,
  onAddVehicle,
  onRemoveVehicle,
}: Props) {
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Filter vehicle definitions by faction
  const availableDefs = vehicleDefinitions.filter(
    (d) => d.faction === faction || d.faction === "NEUTRAL",
  );

  const defMap = new Map(vehicleDefinitions.map((d) => [d.id, d]));

  return (
    <div
      style={{
        width: 160,
        flexShrink: 0,
        borderRight: "1px solid rgba(219,218,216,0.08)",
        paddingRight: 12,
        display: "flex",
        flexDirection: "column",
        gap: 2,
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

      {vehicles.map((v) => {
        const def = defMap.get(v.vehicle_definition_id);
        const isSelected = selectedVehicleId === v.id;
        return (
          <div
            key={v.id}
            onClick={() => onSelectVehicle(isSelected ? null : v.id)}
            style={{
              padding: "6px 8px",
              borderLeft: isSelected
                ? "3px solid var(--color-primary)"
                : "3px solid transparent",
              background: isSelected
                ? "rgba(36,86,130,0.08)"
                : "transparent",
              borderRadius: "0 var(--radius) var(--radius) 0",
              cursor: "pointer",
              transition: "background 150ms ease",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 4,
            }}
            onMouseEnter={(e) => {
              if (!isSelected)
                (e.currentTarget as HTMLDivElement).style.background =
                  "rgba(219,218,216,0.04)";
            }}
            onMouseLeave={(e) => {
              if (!isSelected)
                (e.currentTarget as HTMLDivElement).style.background =
                  "transparent";
            }}
          >
            <div>
              <div
                style={{
                  color: "var(--color-light)",
                  fontSize: 14,
                  lineHeight: 1.3,
                }}
              >
                {v.display_name}
              </div>
              <div
                style={{
                  color: "var(--color-text-dim)",
                  fontSize: 11,
                }}
              >
                {def?.name ?? "Unknown"}
              </div>
            </div>
            {/* Delete on hover */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemoveVehicle(v.id);
              }}
              title="Remove vehicle"
              style={{
                background: "none",
                border: "none",
                color: "var(--color-text-dim)",
                cursor: "pointer",
                fontSize: 16,
                padding: 0,
                lineHeight: 1,
                opacity: 0.5,
                transition: "opacity 150ms ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.opacity = "1";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "var(--color-danger)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.opacity = "0.5";
                (e.currentTarget as HTMLButtonElement).style.color =
                  "var(--color-text-dim)";
              }}
            >
              <i className="material-icons" style={{ fontSize: 16 }}>
                close
              </i>
            </button>
          </div>
        );
      })}

      {/* Add vehicle */}
      <div style={{ position: "relative", marginTop: 8 }}>
        <button
          className="btn btn-secondary btn-small"
          onClick={() => setShowAddMenu(!showAddMenu)}
          style={{ width: "100%", fontSize: 11 }}
        >
          <i
            className="material-icons"
            style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }}
          >
            add
          </i>
          Add vehicle
        </button>

        {showAddMenu && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              background: "var(--color-surface)",
              border: "1px solid rgba(219,218,216,0.12)",
              borderRadius: "var(--radius)",
              zIndex: 50,
              marginTop: 4,
              maxHeight: 240,
              overflowY: "auto",
            }}
          >
            {availableDefs.map((def) => (
              <div
                key={def.id}
                onClick={() => {
                  onAddVehicle(def.id);
                  setShowAddMenu(false);
                }}
                style={{
                  padding: "8px 10px",
                  fontSize: 12,
                  color: "var(--color-text)",
                  cursor: "pointer",
                  transition: "background 150ms ease",
                  borderBottom: "1px solid rgba(219,218,216,0.04)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    "rgba(36,86,130,0.10)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    "transparent";
                }}
              >
                <div style={{ fontWeight: 500 }}>{def.name}</div>
                <div
                  style={{
                    color: "var(--color-text-dim)",
                    fontSize: 11,
                  }}
                >
                  {def.slotCount} slots · {def.faction}
                  {def.category === "crane" ? " · No inventory" : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
