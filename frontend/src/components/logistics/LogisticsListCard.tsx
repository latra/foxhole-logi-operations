/* ── Single order entry in the sidebar ────────────────────────────── */

import StatusBadge from "../common/StatusBadge";
import type { LogisticsOrder, Stockpile } from "../../types/models";

interface Props {
  order: LogisticsOrder;
  stockpiles: Stockpile[];
  isSelected: boolean;
  onSelect: () => void;
}

export default function LogisticsListCard({
  order,
  stockpiles,
  isSelected,
  onSelect,
}: Props) {
  const destStockpile = stockpiles.find(
    (s) => s.id === order.destination_stockpile_id,
  );

  return (
    <div
      onClick={onSelect}
      style={{
        padding: "10px 12px",
        borderLeft: isSelected
          ? "3px solid var(--color-primary)"
          : "3px solid transparent",
        background: isSelected ? "rgba(36,86,130,0.08)" : "transparent",
        borderRadius: "0 var(--radius) var(--radius) 0",
        cursor: "pointer",
        transition: "background 150ms ease",
        marginBottom: 2,
      }}
      onMouseEnter={(e) => {
        if (!isSelected)
          (e.currentTarget as HTMLDivElement).style.background =
            "rgba(219,218,216,0.04)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected)
          (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 4,
        }}
      >
        <span
          style={{
            color: "var(--color-light)",
            fontSize: 14,
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {order.name}
        </span>
        <StatusBadge status={order.status} variant="logistics" />
      </div>
      {destStockpile && (
        <div
          style={{
            color: "var(--color-text-dim)",
            fontSize: 12,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {destStockpile.name}
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 4,
        }}
      >
        <StatusBadge status={order.priority} variant="priority" />
      </div>
    </div>
  );
}
