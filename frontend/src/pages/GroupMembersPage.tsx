/* ── Group Members Page ────────────────────────────────────────────── */

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageShell from "../components/layout/PageShell";
import LoadingSpinner from "../components/common/LoadingSpinner";
import EmptyState from "../components/common/EmptyState";
import { toastSuccess, toastError } from "../components/common/Toast";
import { useAuthStore } from "../stores/authStore";
import {
  getGroup,
  listMembers,
  acceptMember,
  rejectMember,
  removeMember,
  updateMemberRole,
  deleteGroup,
} from "../api/groups";
import type { Group, GroupMembership } from "../types/models";

const ASSIGNABLE_ROLES = ["OFFICER", "MEMBER"] as const;

export default function GroupMembersPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const reload = async () => {
    if (!groupId) return;
    try {
      const [g, m] = await Promise.all([getGroup(groupId), listMembers(groupId)]);
      setGroup(g);
      setMembers(m);
    } catch {
      toastError("Failed to load group data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  if (loading) return <PageShell><LoadingSpinner /></PageShell>;
  if (!group) {
    return (
      <PageShell>
        <EmptyState icon="error" title="Group not found" subtitle="This group does not exist." />
      </PageShell>
    );
  }

  const myMembership = members.find((m) => m.user_id === user?.id && m.status === "ACTIVE");
  const isOwner = myMembership?.role === "OWNER";
  const isOfficer = myMembership?.role === "OFFICER";
  const canManageRequests = isOwner || isOfficer;

  const activeMembers = members.filter((m) => m.status === "ACTIVE");
  const pendingRequests = members.filter((m) => m.status === "PENDING");

  /* ── Actions ──────────────────────────────────────────────────────── */

  const handleAccept = async (membershipId: string) => {
    try {
      await acceptMember(groupId!, membershipId);
      toastSuccess("Member accepted.");
      reload();
    } catch {
      toastError("Failed to accept member.");
    }
  };

  const handleReject = async (membershipId: string) => {
    try {
      await rejectMember(groupId!, membershipId);
      toastSuccess("Request rejected.");
      reload();
    } catch {
      toastError("Failed to reject request.");
    }
  };

  const handleRemove = async (membershipId: string) => {
    try {
      await removeMember(groupId!, membershipId);
      toastSuccess("Member removed.");
      reload();
    } catch {
      toastError("Failed to remove member.");
    }
  };

  const handleRoleChange = async (membershipId: string, newRole: string) => {
    try {
      await updateMemberRole(groupId!, membershipId, newRole);
      toastSuccess("Role updated.");
      reload();
    } catch {
      toastError("Failed to update role.");
    }
  };

  const handleDeleteGroup = async () => {
    try {
      await deleteGroup(groupId!);
      toastSuccess("Group deleted.");
      navigate("/");
    } catch {
      toastError("Failed to delete group.");
    }
  };

  /* ── Render ───────────────────────────────────────────────────────── */

  return (
    <PageShell>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            className="btn-flat"
            style={{ padding: "0 8px", minWidth: "auto", color: "var(--color-text-dim)" }}
            onClick={() => navigate("/")}
            title="Back"
          >
            <i className="material-icons">arrow_back</i>
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 500, color: "var(--color-light)" }}>
                {group.name}
              </span>
              <span style={{ color: "var(--color-text-dim)", fontSize: 14 }}>
                [{group.tag}]
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-dim)", marginTop: 2 }}>
              Members
            </div>
          </div>
        </div>

        {isOwner && (
          <div>
            {!confirmDelete ? (
              <button
                className="btn btn-small"
                style={{ background: "var(--color-error, #a03030)" }}
                onClick={() => setConfirmDelete(true)}
              >
                <i className="material-icons left" style={{ fontSize: 16 }}>delete</i>
                Delete Group
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--color-error, #a03030)" }}>
                  Are you sure?
                </span>
                <button
                  className="btn btn-small"
                  style={{ background: "var(--color-error, #a03030)" }}
                  onClick={handleDeleteGroup}
                >
                  Confirm
                </button>
                <button
                  className="btn btn-small btn-secondary"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pending Requests — Owner or Officer */}
      {canManageRequests && pendingRequests.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 className="section-heading" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <i className="material-icons" style={{ fontSize: 18, color: "var(--color-warning, #c49b2a)" }}>
              pending_actions
            </i>
            Pending Requests
            <span
              style={{
                background: "var(--color-warning, #c49b2a)",
                color: "#000",
                borderRadius: 10,
                padding: "1px 8px",
                fontSize: 11,
                fontWeight: 600,
                marginLeft: 4,
              }}
            >
              {pendingRequests.length}
            </span>
          </h2>
          {pendingRequests.map((m) => (
            <div key={m.id} className="card" style={{ marginBottom: 6 }}>
              <div
                className="card-content"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 16px",
                }}
              >
                <MemberRow member={m} />
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    className="btn btn-small"
                    style={{ background: "var(--color-success, #3a7d44)" }}
                    onClick={() => handleAccept(m.id)}
                    title="Accept"
                  >
                    <i className="material-icons" style={{ fontSize: 18 }}>check</i>
                  </button>
                  <button
                    className="btn btn-small"
                    style={{ background: "var(--color-error, #a03030)" }}
                    onClick={() => handleReject(m.id)}
                    title="Reject"
                  >
                    <i className="material-icons" style={{ fontSize: 18 }}>close</i>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active Members */}
      <h2 className="section-heading" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <i className="material-icons" style={{ fontSize: 18, color: "var(--color-success, #3a7d44)" }}>
          group
        </i>
        Members
        <span
          style={{
            background: "rgba(219,218,216,0.08)",
            color: "var(--color-text-dim)",
            borderRadius: 10,
            padding: "1px 8px",
            fontSize: 11,
            fontWeight: 600,
            marginLeft: 4,
          }}
        >
          {activeMembers.length}
        </span>
      </h2>

      {activeMembers.length === 0 ? (
        <EmptyState icon="group" title="No members" subtitle="This group has no active members." />
      ) : (
        activeMembers.map((m) => (
          <div key={m.id} className="card" style={{ marginBottom: 6 }}>
            <div
              className="card-content"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <MemberRow member={m} />
                {/* Owner badge (not changeable) */}
                {m.role === "OWNER" && <RoleBadge role="OWNER" />}
                {/* Role selector for non-owners — Owner can change */}
                {m.role !== "OWNER" && isOwner && (
                  <select
                    className="browser-default"
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.id, e.target.value)}
                    style={{
                      background: "rgba(219,218,216,0.06)",
                      color: "var(--color-light)",
                      border: "1px solid rgba(219,218,216,0.12)",
                      borderRadius: 4,
                      padding: "2px 6px",
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      cursor: "pointer",
                      width: "auto",
                    }}
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                )}
                {/* Static badge for non-owners when viewer is not owner */}
                {m.role !== "OWNER" && !isOwner && <RoleBadge role={m.role} />}
              </div>

              {/* Remove button — Owner only, not on self */}
              {isOwner && m.user_id !== user?.id && (
                <button
                  className="btn-flat"
                  style={{
                    padding: "0 8px",
                    minWidth: "auto",
                    color: "var(--color-error, #a03030)",
                  }}
                  onClick={() => handleRemove(m.id)}
                  title="Remove member"
                >
                  <i className="material-icons" style={{ fontSize: 18 }}>person_remove</i>
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </PageShell>
  );
}

/* ── Sub-components ────────────────────────────────────────────────── */

function MemberRow({ member }: { member: GroupMembership }) {
  const name = member.user?.display_name ?? member.user?.username ?? "Unknown";
  const avatar = member.user?.avatar_url;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {avatar ? (
        <img
          src={avatar}
          alt=""
          style={{ width: 28, height: 28, borderRadius: "50%" }}
        />
      ) : (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "rgba(219,218,216,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <i className="material-icons" style={{ fontSize: 16, color: "var(--color-text-dim)" }}>
            person
          </i>
        </div>
      )}
      <span style={{ color: "var(--color-light)", fontSize: 14 }}>{name}</span>
    </div>
  );
}

const ROLE_COLORS: Record<string, string> = {
  OWNER: "#c49b2a",
  OFFICER: "#4a90d9",
  LOGI_OFFICER: "#6aad6a",
  MEMBER: "var(--color-text-dim)",
  RECRUIT: "var(--color-text-dim)",
};

function RoleBadge({ role }: { role: string }) {
  const label = role.replace("_", " ");
  return (
    <span
      style={{
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        color: ROLE_COLORS[role] ?? "var(--color-text-dim)",
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}
