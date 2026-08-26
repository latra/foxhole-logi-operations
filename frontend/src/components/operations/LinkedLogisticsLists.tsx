/* ── Logistics lists linked to an operation ───────────────────────── */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import StatusBadge from "../common/StatusBadge";
import LoadingSpinner from "../common/LoadingSpinner";
import { toastSuccess, toastError } from "../common/Toast";
import { listOrders, listOrdersByOperation, updateOrder } from "../../api/logistics";
import type { Operation, LogisticsOrder } from "../../types/models";

interface Props {
  operation: Operation;
  /** Officer/Owner of the operation's group — gates link/unlink actions. */
  canManage: boolean;
}

export default function LinkedLogisticsLists({ operation, canManage }: Props) {
  const navigate = useNavigate();
  const [linked, setLinked] = useState<LogisticsOrder[]>([]);
  const [unlinked, setUnlinked] = useState<LogisticsOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedToLink, setSelectedToLink] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const [linkedOrders, groupOrders] = await Promise.all([
        listOrdersByOperation(operation.id),
        listOrders(operation.group_id),
      ]);
      setLinked(linkedOrders);
      setUnlinked(groupOrders.filter((o) => o.operation_id == null));
    } catch {
      toastError("Failed to load this operation's logistics lists.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operation.id]);

  const handleLink = async () => {
    if (!selectedToLink) return;
    setBusy(true);
    try {
      await updateOrder(selectedToLink, { operation_id: operation.id });
      toastSuccess("Logistics list linked");
      setSelectedToLink("");
      await reload();
    } catch {
      toastError("Failed to link logistics list");
    } finally {
      setBusy(false);
    }
  };

  const handleUnlink = async (orderId: string) => {
    setBusy(true);
    try {
      await updateOrder(orderId, { operation_id: null });
      toastSuccess("Logistics list unlinked");
      await reload();
    } catch {
      toastError("Failed to unlink logistics list");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-content">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: "var(--color-text-dim)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <i className="material-icons" style={{ fontSize: 16 }}>
              local_shipping
            </i>
            Logistics Lists
          </span>
          <button
            className="btn-flat"
            style={{
              padding: "0 8px",
              height: 24,
              lineHeight: "24px",
              fontSize: 11,
              color: "var(--color-text-dim)",
              minWidth: "auto",
            }}
            onClick={() => navigate(`/logistics?newForOperation=${operation.id}`)}
          >
            <i className="material-icons" style={{ fontSize: 14, verticalAlign: "middle" }}>
              add
            </i>{" "}
            New list
          </button>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            {linked.length === 0 ? (
              <p
                style={{
                  color: "var(--color-text-dim)",
                  fontSize: 13,
                  fontStyle: "italic",
                  margin: "0 0 10px",
                }}
              >
                No logistics lists linked yet.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                {linked.map((order) => (
                  <div
                    key={order.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      borderRadius: "var(--radius)",
                      background: "rgba(219,218,216,0.03)",
                    }}
                  >
                    <span
                      onClick={() => navigate(`/logistics?order=${order.id}`)}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        cursor: "pointer",
                        color: "var(--color-text)",
                        fontSize: 13,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title="Open in Logistics"
                    >
                      {order.name}
                    </span>
                    <StatusBadge status={order.status} variant="logistics" />
                    {canManage && (
                      <button
                        onClick={() => handleUnlink(order.id)}
                        disabled={busy}
                        title="Unlink"
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--color-text-dim)",
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        <i className="material-icons" style={{ fontSize: 16 }}>
                          link_off
                        </i>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canManage && unlinked.length > 0 && (
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  className="browser-default"
                  value={selectedToLink}
                  onChange={(e) => setSelectedToLink(e.target.value)}
                  style={{ flex: 1, fontSize: 12 }}
                >
                  <option value="">Link an existing list...</option>
                  {unlinked.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn-small btn-secondary"
                  disabled={!selectedToLink || busy}
                  onClick={handleLink}
                >
                  <i className="material-icons left" style={{ fontSize: 14 }}>
                    link
                  </i>
                  Link
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
