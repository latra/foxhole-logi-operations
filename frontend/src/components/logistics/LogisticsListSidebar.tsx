/* ── Group's logistics orders sidebar ─────────────────────────────── */

import LogisticsListCard from "./LogisticsListCard";
import type { LogisticsOrder, Stockpile } from "../../types/models";

interface Props {
  orders: LogisticsOrder[];
  stockpiles: Stockpile[];
  activeOrderId: string | null;
  onSelect: (orderId: string) => void;
  onCreate: () => void;
  loading: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export default function LogisticsListSidebar({
  orders,
  stockpiles,
  activeOrderId,
  onSelect,
  onCreate,
  loading,
  collapsed,
  onToggleCollapsed,
}: Props) {
  if (collapsed) {
    return (
      <div
        style={{
          flexShrink: 0,
          borderRight: "1px solid rgba(219,218,216,0.08)",
          paddingRight: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 2,
        }}
      >
        <button
          className="btn-flat"
          style={{ padding: 4, minWidth: "auto", color: "var(--color-text-dim)" }}
          title="Expand orders list"
          onClick={onToggleCollapsed}
        >
          <i className="material-icons" style={{ fontSize: 18 }}>
            chevron_right
          </i>
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        width: 180,
        flexShrink: 0,
        borderRight: "1px solid rgba(219,218,216,0.08)",
        paddingRight: 12,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <h2 className="section-heading" style={{ margin: 0 }}>
          Orders
        </h2>
        <button
          className="btn-flat"
          style={{ padding: 2, minWidth: "auto", color: "var(--color-text-dim)" }}
          title="Collapse"
          onClick={onToggleCollapsed}
        >
          <i className="material-icons" style={{ fontSize: 16 }}>
            chevron_left
          </i>
        </button>
      </div>

      {/* List entries */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          marginBottom: 12,
        }}
      >
        {loading ? (
          <div
            style={{
              color: "var(--color-text-dim)",
              fontSize: 13,
              padding: 16,
              textAlign: "center",
            }}
          >
            Loading...
          </div>
        ) : orders.length === 0 ? (
          <div
            style={{
              color: "var(--color-text-dim)",
              fontSize: 13,
              padding: 16,
              textAlign: "center",
            }}
          >
            No orders yet. Create one to start planning.
          </div>
        ) : (
          orders.map((order) => (
            <LogisticsListCard
              key={order.id}
              order={order}
              stockpiles={stockpiles}
              isSelected={activeOrderId === order.id}
              onSelect={() => onSelect(order.id)}
            />
          ))
        )}
      </div>

      {/* New order button */}
      <button
        className="btn btn-secondary btn-small"
        onClick={onCreate}
        style={{ width: "100%" }}
      >
        <i
          className="material-icons"
          style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }}
        >
          add
        </i>
        New Order
      </button>
    </div>
  );
}
