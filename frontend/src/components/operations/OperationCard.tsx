/* ── Compact operation card for the sidebar list ─────────────────── */

import { formatDistanceToNow } from "date-fns";
import type { Operation } from "../../types/models";
import StatusBadge from "../common/StatusBadge";

interface Props {
  operation: Operation;
  isSelected: boolean;
  regionName?: string;
  onSelect: () => void;
}

export default function OperationCard({
  operation,
  isSelected,
  regionName,
  onSelect,
}: Props) {
  const relativeDate = formatDistanceToNow(new Date(operation.scheduled_at), {
    addSuffix: true,
  });

  return (
    <div
      className="card"
      onClick={onSelect}
      style={{
        marginBottom: 8,
        cursor: "pointer",
        borderLeft: isSelected
          ? "3px solid var(--color-primary)"
          : "3px solid transparent",
        background: isSelected
          ? "rgba(36,86,130,0.08)"
          : "var(--color-surface)",
      }}
    >
      <div
        className="card-content"
        style={{ padding: "10px 14px" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
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
              flex: 1,
            }}
          >
            {operation.name}
          </span>
          <StatusBadge status={operation.status} />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 4,
            fontSize: 12,
            color: "var(--color-text-dim)",
          }}
        >
          <span>{relativeDate}</span>
          {regionName && <span>{regionName}</span>}
        </div>
      </div>
    </div>
  );
}
