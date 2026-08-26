/* ── Operations Page — two-panel layout ───────────────────────────── */

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageShell from "../components/layout/PageShell";
import OperationCard from "../components/operations/OperationCard";
import OperationDetail from "../components/operations/OperationDetail";
import CreateOperationForm from "../components/operations/CreateOperationForm";
import EmptyState from "../components/common/EmptyState";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { useOperationStore } from "../stores/operationStore";
import { useGroupStore } from "../stores/groupStore";
import { useAuthStore } from "../stores/authStore";
import { useCurrentWar } from "../hooks/useCurrentWar";
import { useRegions } from "../hooks/useRegions";
import { useOperationsSocket } from "../hooks/useOperationsSocket";
import { listSignups } from "../api/operations";

export default function OperationsPage() {
  const { operationId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const activeGroup = useGroupStore((s) => s.activeGroup);
  const memberships = useGroupStore((s) => s.memberships);
  const {
    operations,
    selectedOperation,
    signups,
    loading,
    signupsLoading,
    fetchOperations,
    selectOperation,
    clearSelection,
  } = useOperationStore();

  const { war, loading: warLoading } = useCurrentWar();
  const { regions } = useRegions(war?.id);
  const { fetchGroups, fetchMemberships } = useGroupStore();

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showCreate, setShowCreate] = useState(false);

  // Ensure memberships are loaded (in case user navigated here directly)
  useEffect(() => {
    if (user && memberships.length === 0) {
      fetchGroups().then(() => fetchMemberships(user.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Check if user is Officer/Owner in their active group
  const activeGroupMembership = memberships.find(
    (m) => m.group_id === activeGroup?.id && m.status === "ACTIVE"
  );
  const canCreate =
    activeGroupMembership?.role === "OWNER" ||
    activeGroupMembership?.role === "OFFICER";

  // Check if user is Officer/Owner in the selected operation's group
  const selectedOpGroupMembership = selectedOperation
    ? memberships.find(
        (m) => m.group_id === selectedOperation.group_id && m.status === "ACTIVE"
      )
    : null;
  const isOfficerForSelectedOp =
    selectedOpGroupMembership?.role === "OWNER" ||
    selectedOpGroupMembership?.role === "OFFICER";

  // Editing the operation (details + plan) is broader than status changes:
  // Officer/Owner in ANY invited group, not just the creator group.
  const invitedGroupIds = selectedOperation
    ? new Set(selectedOperation.invited_groups.map((g) => g.id).concat(selectedOperation.group_id))
    : new Set<string>();
  const canEditOperation = memberships.some(
    (m) =>
      m.status === "ACTIVE" &&
      (m.role === "OWNER" || m.role === "OFFICER") &&
      invitedGroupIds.has(m.group_id)
  );

  /* Fetch ops visible to the user (across all their groups) */
  useEffect(() => {
    if (user) {
      fetchOperations(); // no group_id = all visible to user
    }
  }, [user, fetchOperations]);

  /* Auto-select from URL param */
  useEffect(() => {
    if (operationId && operations.length > 0) {
      const op = operations.find((o) => o.id === operationId);
      if (op) selectOperation(op);
    }
  }, [operationId, operations, selectOperation]);

  const handleSelectOp = (op: (typeof operations)[number]) => {
    setShowCreate(false);
    selectOperation(op);
    navigate(`/operations/${op.id}`, { replace: true });
  };

  const handleSignupChanged = async () => {
    if (selectedOperation) {
      const fresh = await listSignups(selectedOperation.id);
      useOperationStore.setState({ signups: fresh });
    }
  };

  /** Re-fetch the list and, if the currently-open operation is still in it,
   *  re-select the fresh copy so the detail view picks up the new fields
   *  too (status, debrief, invited groups, ...). If it's gone (deleted, or
   *  this user's group lost its invite), fall back to the list. */
  const refreshOperations = async () => {
    await fetchOperations();
    const fresh = useOperationStore.getState().operations;
    const current = useOperationStore.getState().selectedOperation;
    if (!current) return;
    const stillVisible = fresh.find((o) => o.id === current.id);
    if (stillVisible) {
      selectOperation(stillVisible);
    } else {
      clearSelection();
      navigate("/operations", { replace: true });
    }
  };

  // Live updates: created / changed / cancelled / deleted operations, for
  // any group this user belongs to — see backend/api/ws_manager.py.
  const wsStatus = useOperationsSocket(() => {
    refreshOperations();
  });

  const handleOperationUpdated = () => {
    refreshOperations();
  };

  const filteredOps =
    statusFilter === "ALL"
      ? operations
      : operations.filter((o) => o.status === statusFilter);

  const regionMap = new Map(regions.map((r) => [r.id, r.name]));

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

  return (
    <PageShell>
      {wsStatus === "disconnected" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            marginBottom: 12,
            background: "var(--color-surface)",
            border: "1px solid rgba(196,155,42,0.3)",
            borderLeft: "3px solid var(--color-warning)",
            borderRadius: 4,
            fontSize: 12,
            color: "var(--color-warning)",
          }}
        >
          <i className="material-icons" style={{ fontSize: 16 }}>wifi_off</i>
          Live updates disconnected — reconnecting…
        </div>
      )}
      <div className="row" style={{ display: "flex", gap: 24, margin: 0 }}>
        {/* Left panel — operations list */}
        <div style={{ width: 340, minWidth: 280, flexShrink: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <h2 className="section-heading" style={{ margin: 0 }}>
              Operations
            </h2>
            {canCreate && (
              <button
                className="btn btn-small"
                onClick={() => {
                  setShowCreate(true);
                  clearSelection();
                  navigate("/operations", { replace: true });
                }}
              >
                New
              </button>
            )}
          </div>

          {/* Status filter */}
          <select
            className="browser-default"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: "100%", marginBottom: 12, fontSize: 12 }}
          >
            <option value="ALL">All Statuses</option>
            <option value="PLANNED">Planned</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Operations list */}
          <div style={{ maxHeight: "calc(100vh - 240px)", overflowY: "auto" }}>
            {loading ? (
              <LoadingSpinner />
            ) : filteredOps.length === 0 ? (
              <EmptyState
                icon="event"
                title="No operations"
                subtitle={
                  statusFilter !== "ALL"
                    ? "No operations match this filter."
                    : "No operations available yet."
                }
              />
            ) : (
              filteredOps.map((op) => (
                <OperationCard
                  key={op.id}
                  operation={op}
                  isSelected={selectedOperation?.id === op.id}
                  regionName={
                    op.region_id ? regionMap.get(op.region_id) : undefined
                  }
                  onSelect={() => handleSelectOp(op)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right panel — detail or create */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {showCreate && canCreate && !war && !warLoading ? (
            <EmptyState
              icon="warning"
              title="No active war"
              subtitle="Cannot create operations without an active war. Ask an admin to set one up via the API."
              action={
                <button className="btn btn-small btn-secondary" onClick={() => setShowCreate(false)}>
                  Back
                </button>
              }
            />
          ) : showCreate && canCreate && war ? (
            <CreateOperationForm
              groupId={activeGroup.id}
              warId={war.id}
              faction={activeGroup.faction}
              regions={regions}
              onCreated={() => {
                setShowCreate(false);
                fetchOperations();
              }}
              onCancel={() => setShowCreate(false)}
            />
          ) : selectedOperation && user ? (
            <OperationDetail
              operation={selectedOperation}
              signups={signups}
              signupsLoading={signupsLoading}
              regions={regions}
              currentUserId={user.id}
              isOfficer={isOfficerForSelectedOp}
              canEditOperation={canEditOperation}
              onSignupChanged={handleSignupChanged}
              onOperationUpdated={handleOperationUpdated}
            />
          ) : (
            <EmptyState
              icon="touch_app"
              title="Select an operation or create a new one"
              subtitle="Use the list on the left to browse operations."
            />
          )}
        </div>
      </div>
    </PageShell>
  );
}
