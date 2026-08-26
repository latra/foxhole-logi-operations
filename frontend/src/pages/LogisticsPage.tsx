/* ── Logistics Page — master-detail layout ────────────────────────── */

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageShell from "../components/layout/PageShell";
import LogisticsListSidebar from "../components/logistics/LogisticsListSidebar";
import LogisticsEditor from "../components/logistics/LogisticsEditor";
import EmptyState from "../components/common/EmptyState";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { useLogisticsStore } from "../stores/logisticsStore";
import { useGroupStore } from "../stores/groupStore";
import { useAuthStore } from "../stores/authStore";
import { useCurrentWar } from "../hooks/useCurrentWar";
import { toastSuccess, toastError } from "../components/common/Toast";
import { listMembers } from "../api/groups";
import type { GroupMembership } from "../types/models";

export default function LogisticsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Deep link from e.g. an Operation's linked logistics lists (?order=<id>)
  const deepLinkOrderId = searchParams.get("order");
  const user = useAuthStore((s) => s.user);
  const activeGroup = useGroupStore((s) => s.activeGroup);
  const memberships = useGroupStore((s) => s.memberships);
  const { fetchGroups, fetchMemberships } = useGroupStore();
  const { war } = useCurrentWar();

  const {
    orders,
    activeOrderId,
    stockpiles,
    loading,
    catalogLoading,
    fetchOrders,
    selectOrder,
    createNewOrder,
    fetchStockpiles,
    fetchCatalogData,
  } = useLogisticsStore();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrderName, setNewOrderName] = useState("");
  const [newOrderDestination, setNewOrderDestination] = useState("");
  const [groupMembers, setGroupMembers] = useState<GroupMembership[]>([]);

  // Ensure memberships are loaded
  useEffect(() => {
    if (user && memberships.length === 0) {
      fetchGroups().then(() => fetchMemberships(user.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Full member roster of the active group — used to resolve assigned_to
  // user ids to display names (e.g. tooltips, summary badges).
  useEffect(() => {
    if (!activeGroup) {
      setGroupMembers([]);
      return;
    }
    listMembers(activeGroup.id)
      .then(setGroupMembers)
      .catch(() => setGroupMembers([]));
  }, [activeGroup]);

  // Fetch catalog data once
  useEffect(() => {
    fetchCatalogData();
  }, [fetchCatalogData]);

  // Fetch orders and stockpiles when group + war are available
  useEffect(() => {
    if (activeGroup) {
      fetchOrders(activeGroup.id);
    }
  }, [activeGroup, fetchOrders]);

  useEffect(() => {
    if (activeGroup && war) {
      fetchStockpiles(activeGroup.id, war.id);
    }
  }, [activeGroup, war, fetchStockpiles]);

  // Deep link takes priority over auto-select (e.g. opened from an Operation)
  useEffect(() => {
    if (deepLinkOrderId) {
      selectOrder(deepLinkOrderId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkOrderId]);

  // Auto-select first order
  useEffect(() => {
    if (!deepLinkOrderId && orders.length > 0 && !activeOrderId) {
      selectOrder(orders[0].id);
    }
  }, [orders, activeOrderId, selectOrder, deepLinkOrderId]);

  // Set default destination when stockpiles load
  useEffect(() => {
    if (stockpiles.length > 0 && !newOrderDestination) {
      setNewOrderDestination(stockpiles[0].id);
    }
  }, [stockpiles, newOrderDestination]);

  const handleCreateOrder = async () => {
    if (!activeGroup || !newOrderDestination) return;
    const name = newOrderName.trim() || `Order ${orders.length + 1}`;
    const newOrder = await createNewOrder(
      activeGroup.id,
      name,
      newOrderDestination,
    );
    if (newOrder) {
      selectOrder(newOrder.id);
      toastSuccess("Order created");
      setShowCreateModal(false);
      setNewOrderName("");
    }
  };

  const handleNewOrderClick = () => {
    if (stockpiles.length === 0) {
      toastError(
        "No stockpiles available. Create a stockpile for your group first.",
      );
      navigate("/stockpiles");
      return;
    }
    setNewOrderName(`Order ${orders.length + 1}`);
    setNewOrderDestination(stockpiles[0]?.id ?? "");
    setShowCreateModal(true);
  };

  const activeOrder = orders.find((o) => o.id === activeOrderId);

  if (!activeGroup) {
    return (
      <PageShell>
        <EmptyState
          icon="group"
          title="No group selected"
          subtitle="Join or create a group from the Home page first."
          action={
            <button className="btn btn-small" onClick={() => navigate("/")}>
              Go Home
            </button>
          }
        />
      </PageShell>
    );
  }

  if (catalogLoading && orders.length === 0) {
    return (
      <PageShell>
        <LoadingSpinner />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div
        style={{
          display: "flex",
          gap: 16,
          height: "calc(100vh - 120px)",
          margin: 0,
        }}
      >
        {/* Left sidebar — list of orders */}
        <LogisticsListSidebar
          orders={orders}
          stockpiles={stockpiles}
          activeOrderId={activeOrderId}
          onSelect={selectOrder}
          onCreate={handleNewOrderClick}
          loading={loading}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
        />

        {/* Main area — editor */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {activeOrder ? (
            <LogisticsEditor
              order={activeOrder}
              faction={activeGroup.faction}
              groupMembers={groupMembers}
            />
          ) : (
            <EmptyState
              icon="local_shipping"
              title="Select an order or create a new one"
              subtitle="Use the sidebar to manage your logistics orders."
            />
          )}
        </div>
      </div>

      {/* Create order modal */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--color-surface)",
              borderRadius: "var(--radius)",
              padding: 24,
              width: "100%",
              maxWidth: 420,
              border: "1px solid rgba(219,218,216,0.12)",
            }}
          >
            <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>
              New Logistics Order
            </h3>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "var(--color-text-dim)" }}>
                Order Name
              </label>
              <input
                type="text"
                value={newOrderName}
                onChange={(e) => setNewOrderName(e.target.value)}
                placeholder="Order name"
                autoFocus
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: "var(--color-text-dim)" }}>
                Destination Stockpile *
              </label>
              <select
                className="browser-default"
                value={newOrderDestination}
                onChange={(e) => setNewOrderDestination(e.target.value)}
                style={{ width: "100%", fontSize: 13 }}
              >
                {stockpiles.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.structure_type.replace(/_/g, " ")})
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <button
                className="btn btn-secondary btn-small"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-small"
                onClick={handleCreateOrder}
                disabled={!newOrderDestination}
              >
                Create Order
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
