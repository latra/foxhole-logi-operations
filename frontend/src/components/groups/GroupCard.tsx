/* ── Group summary card with Join request button ─────────────────── */

import { useState } from "react";
import type { Group } from "../../types/models";
import { requestJoin } from "../../api/groups";
import { toastSuccess, toastError } from "../common/Toast";

const FACTION_DOT: Record<string, string> = {
  WARDEN: "#245682",
  COLONIAL: "#516b30",
  NEUTRAL: "#8a8a8a",
};

interface Props {
  group: Group;
  memberStatus: "ACTIVE" | "PENDING" | null; // null = not a member
  onJoined: () => void;
}

export default function GroupCard({ group, memberStatus, onJoined }: Props) {
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    setJoining(true);
    try {
      await requestJoin(group.id);
      toastSuccess(`Join request sent to ${group.name}`);
      onJoined();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 409) {
        toastError("You already have a pending request or are a member.");
      } else {
        toastError("Failed to request to join.");
      }
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 12 }}>
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
            <span style={{ color: "var(--color-light)", fontSize: 16, fontWeight: 500 }}>
              {group.name}
            </span>
            <span style={{ color: "var(--color-text-dim)", fontSize: 13 }}>
              [{group.tag}]
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 4,
              fontSize: 12,
              color: "var(--color-text-dim)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: FACTION_DOT[group.faction] ?? "#8a8a8a",
                display: "inline-block",
              }}
            />
            {group.faction}
          </div>
        </div>

        {memberStatus === "ACTIVE" && (
          <span
            style={{
              fontSize: 11,
              color: "var(--color-success, #3a7d44)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Joined
          </span>
        )}
        {memberStatus === "PENDING" && (
          <span
            style={{
              fontSize: 11,
              color: "var(--color-warning, #c49b2a)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Pending
          </span>
        )}
        {memberStatus === null && (
          <button
            className="btn btn-secondary btn-small"
            disabled={joining}
            onClick={handleJoin}
          >
            {joining ? "..." : "JOIN"}
          </button>
        )}
      </div>
    </div>
  );
}
