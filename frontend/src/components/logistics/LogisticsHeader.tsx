/* ── List header — name, store in, code (matches the slot-grid editor spec) ── */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import StatusBadge from "../common/StatusBadge";
import StockpileMapPicker from "../stockpiles/StockpileMapPicker";
import type { LogisticsOrder, Stockpile } from "../../types/models";
import type { OrderStatus, Priority } from "../../types/enums";

interface Props {
  order: LogisticsOrder;
  stockpiles: Stockpile[];
  onUpdate: (data: {
    name?: string;
    destination_stockpile_id?: string;
    source_stockpile_id?: string | null;
    priority?: Priority;
    status?: OrderStatus;
    notes?: string | null;
  }) => void;
}

const ORDER_STATUSES: OrderStatus[] = ["DRAFT", "OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const PRIORITIES: Priority[] = ["CRITICAL", "REQUIRED", "PREFERRED", "OPTIONAL"];

export default function LogisticsHeader({ order, stockpiles, onUpdate }: Props) {
  const navigate = useNavigate();
  const [name, setName] = useState(order.name);
  const [showMap, setShowMap] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setName(order.name);
  }, [order.id, order.name]);

  const debouncedNameUpdate = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdate({ name: value });
    }, 600);
  };

  const destination = stockpiles.find((s) => s.id === order.destination_stockpile_id);

  return (
    <div className="card" style={{ margin: "0 0 16px" }}>
      <div className="card-content" style={{ padding: "14px 16px" }}>
        {/* Primary row — name / store in / code */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            gap: 12,
          }}
        >
          <div style={{ flex: "1 1 220px", minWidth: 160 }}>
            <label style={{ fontSize: 11, color: "var(--color-text-dim)" }}>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                debouncedNameUpdate(e.target.value);
              }}
              onBlur={() => {
                if (name !== order.name) onUpdate({ name });
              }}
              style={{ width: "100%", fontSize: 15 }}
            />
          </div>

          <div style={{ flex: "1 1 220px", minWidth: 180 }}>
            <label style={{ fontSize: 11, color: "var(--color-text-dim)" }}>Store in</label>
            <select
              className="browser-default"
              value={order.destination_stockpile_id}
              onChange={(e) => onUpdate({ destination_stockpile_id: e.target.value })}
              style={{ width: "100%", fontSize: 13 }}
            >
              {stockpiles.length === 0 && <option value="">No stockpiles</option>}
              {stockpiles.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.structure_type.replace(/_/g, " ")})
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: "0 1 140px", minWidth: 110 }}>
            <label style={{ fontSize: 11, color: "var(--color-text-dim)" }}>Code</label>
            <input
              type="text"
              value={destination?.code_6digit ?? ""}
              readOnly
              disabled
              placeholder="—"
              title="Access code of the selected stockpile"
              style={{ width: "100%", fontSize: 13, opacity: 0.8 }}
            />
          </div>

          <div style={{ flex: "0 0 auto" }}>
            <label style={{ fontSize: 11, color: "var(--color-text-dim)", display: "block" }}>&nbsp;</label>
            <button
              type="button"
              className="btn-flat"
              onClick={() => {
                if (destination?.map_hex) setShowMap(true);
                else navigate("/map");
              }}
              title={
                destination?.map_hex
                  ? "View this stockpile on the map"
                  : "View the map (this stockpile has no exact location picked)"
              }
              style={{ height: 36, padding: "0 10px", color: "var(--color-text-dim)" }}
            >
              <i className="material-icons" style={{ fontSize: 18, verticalAlign: "middle" }}>map</i>
            </button>
          </div>
        </div>

        {/* Secondary row — status, priority, optional source stockpile */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 14,
            marginTop: 12,
            paddingTop: 10,
            borderTop: "1px solid rgba(219,218,216,0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <StatusBadge status={order.status} variant="logistics" />
            <select
              className="browser-default"
              value={order.status}
              onChange={(e) => onUpdate({ status: e.target.value as OrderStatus })}
              style={{ fontSize: 11 }}
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <StatusBadge status={order.priority} variant="priority" />
            <select
              className="browser-default"
              value={order.priority}
              onChange={(e) => onUpdate({ priority: e.target.value as Priority })}
              style={{ fontSize: 11 }}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {showMap && destination?.map_hex && destination.map_x != null && destination.map_y != null && (
        <StockpileMapPicker
          mode="view"
          location={{ hex: destination.map_hex, x: destination.map_x, y: destination.map_y }}
          onClose={() => setShowMap(false)}
        />
      )}
    </div>
  );
}
