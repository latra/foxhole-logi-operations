/* ── Home Page — group list / group dashboard ────────────────────── */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "../components/layout/PageShell";
import GroupCard from "../components/groups/GroupCard";
import CreateGroupForm from "../components/groups/CreateGroupForm";
import EmptyState from "../components/common/EmptyState";
import LoadingSpinner from "../components/common/LoadingSpinner";
import StatusBadge from "../components/common/StatusBadge";
import { useGroupStore } from "../stores/groupStore";
import { useAuthStore } from "../stores/authStore";
import { listOperations } from "../api/operations";
import type { Operation } from "../types/models";

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const {
    groups,
    memberships,
    activeGroup,
    loading,
    fetchGroups,
    fetchMemberships,
  } = useGroupStore();
  const navigate = useNavigate();
  const [recentOps, setRecentOps] = useState<Operation[]>([]);

  const reload = async () => {
    await fetchGroups();
    if (user) await fetchMemberships(user.id);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /* Fetch recent ops for active group */
  useEffect(() => {
    if (!activeGroup) return;
    listOperations(activeGroup.id)
      .then((ops) => setRecentOps(ops.slice(0, 5)))
      .catch(() => {});
  }, [activeGroup]);

  if (loading) return <PageShell><LoadingSpinner /></PageShell>;

  const memberStatusMap = new Map<string, "ACTIVE" | "PENDING">();
  for (const m of memberships) {
    if (m.status === "ACTIVE" || m.status === "PENDING") {
      const existing = memberStatusMap.get(m.group_id);
      if (!existing || m.status === "ACTIVE") memberStatusMap.set(m.group_id, m.status);
    }
  }
  const hasGroup = memberships.some((m) => m.status === "ACTIVE");

  // Incoming operations: only PLANNED, sorted by nearest date
  const incomingOps = recentOps
    .filter((op) => op.status === "PLANNED")
    .sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    );

  /* ── No group: show list + create form ─────────────────────────── */
  if (!hasGroup) {
    return (
      <PageShell>
        <div className="row">
          <div className="col s12 l6">
            <h2 className="section-heading">Available Groups</h2>
            {groups.length === 0 ? (
              <EmptyState
                icon="group"
                title="No groups yet"
                subtitle="Create the first group for your regiment."
              />
            ) : (
              groups.map((g) => (
                <GroupCard
                  key={g.id}
                  group={g}
                  memberStatus={memberStatusMap.get(g.id) ?? null}
                  onJoined={reload}
                />
              ))
            )}
          </div>
          <div className="col s12 l6">
            <h2 className="section-heading">Create Group</h2>
            <CreateGroupForm onCreated={reload} />
          </div>
        </div>
      </PageShell>
    );
  }

  /* ── Has group: group dashboard ────────────────────────────────── */
  return (
    <PageShell>
      {activeGroup && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div
            className="card-content"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 500,
                    color: "var(--color-light)",
                  }}
                >
                  {activeGroup.name}
                </span>
                <span style={{ color: "var(--color-text-dim)", fontSize: 14 }}>
                  [{activeGroup.tag}]
                </span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--color-text-dim)",
                  marginTop: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background:
                      activeGroup.faction === "WARDEN" ? "#245682" : "#516b30",
                    display: "inline-block",
                  }}
                />
                {activeGroup.faction}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-small btn-secondary"
                onClick={() => navigate(`/groups/${activeGroup.id}/members`)}
              >
                Members
              </button>
              <button
                className="btn btn-small"
                onClick={() => navigate("/operations")}
              >
                Operations
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incoming Operations (PLANNED only) */}
      <h2 className="section-heading">Incoming Operations</h2>
      {incomingOps.length === 0 ? (
        <EmptyState
          icon="event"
          title="No incoming operations"
          subtitle="There are no planned operations at the moment."
          action={
            <button
              className="btn btn-small"
              onClick={() => navigate("/operations")}
            >
              Go to Operations
            </button>
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {incomingOps.map((op) => {
            const scheduledDate = new Date(op.scheduled_at);
            const now = new Date();
            const diffMs = scheduledDate.getTime() - now.getTime();
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            let timeLabel: string;
            if (diffMs < 0) {
              timeLabel = "Starting now";
            } else if (diffHours < 1) {
              timeLabel = "Less than 1h";
            } else if (diffHours < 24) {
              timeLabel = `In ${diffHours}h`;
            } else {
              timeLabel = `In ${diffDays}d`;
            }

            const isUrgent = diffMs > 0 && diffHours < 6;

            return (
              <div
                key={op.id}
                className="card"
                style={{
                  margin: 0,
                  cursor: "pointer",
                  borderLeft: `3px solid ${isUrgent ? "#e65100" : "#245682"}`,
                  transition: "background 0.15s",
                }}
                onClick={() => navigate(`/operations/${op.id}`)}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(36,86,130,0.08)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "")
                }
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
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 2,
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
                          {op.name}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          fontSize: 12,
                          color: "var(--color-text-dim)",
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <i className="material-icons" style={{ fontSize: 14 }}>
                            schedule
                          </i>
                          {scheduledDate.toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })}{" "}
                          {scheduledDate.toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {op.duration_minutes && (
                          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            <i className="material-icons" style={{ fontSize: 14 }}>
                              timer
                            </i>
                            {Math.floor(op.duration_minutes / 60)}h
                            {op.duration_minutes % 60 > 0 &&
                              ` ${op.duration_minutes % 60}m`}
                          </span>
                        )}
                        {op.invited_groups && op.invited_groups.length > 1 && (
                          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            <i className="material-icons" style={{ fontSize: 14 }}>
                              groups
                            </i>
                            {op.invited_groups.length} groups
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 3,
                          fontSize: 11,
                          fontWeight: 600,
                          background: isUrgent
                            ? "rgba(230,81,0,0.15)"
                            : "rgba(36,86,130,0.12)",
                          color: isUrgent ? "#ff9800" : "var(--color-secondary)",
                        }}
                      >
                        {timeLabel}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent Operations (all statuses) */}
      <h2 className="section-heading" style={{ marginTop: 28 }}>
        Recent Operations
      </h2>
      {recentOps.length === 0 ? (
        <EmptyState
          icon="event"
          title="No operations yet"
          subtitle="Create your first operation from the Operations page."
          action={
            <button
              className="btn btn-small"
              onClick={() => navigate("/operations")}
            >
              Go to Operations
            </button>
          }
        />
      ) : (
        recentOps.map((op) => (
          <div
            key={op.id}
            className="card"
            style={{ marginBottom: 8, cursor: "pointer" }}
            onClick={() => navigate(`/operations/${op.id}`)}
          >
            <div
              className="card-content"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
              }}
            >
              <div>
                <span
                  style={{
                    color: "var(--color-light)",
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  {op.name}
                </span>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-dim)",
                    marginTop: 2,
                  }}
                >
                  {new Date(op.scheduled_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
              <StatusBadge status={op.status} />
            </div>
          </div>
        ))
      )}
    </PageShell>
  );
}
