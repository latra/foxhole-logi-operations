/* ── Full detail view of a selected operation ────────────────────── */

import { useState, useEffect } from "react";
import { format } from "date-fns";
import type { Operation, OperationSignup } from "../../types/models";
import type { Region } from "../../types/models";
import { updateOperation } from "../../api/operations";
import StatusBadge from "../common/StatusBadge";
import ConfirmModal from "../common/ConfirmModal";
import SignupButton from "./SignupButton";
import SignupList from "./SignupList";
import LoadingSpinner from "../common/LoadingSpinner";
import OperationPlanPanel from "./OperationPlanPanel";
import LinkedLogisticsLists from "./LinkedLogisticsLists";

interface Props {
  operation: Operation;
  signups: OperationSignup[];
  signupsLoading: boolean;
  regions: Region[];
  currentUserId: string;
  isOfficer: boolean;
  canEditPlan: boolean;
  onSignupChanged: () => void;
  onOperationUpdated: () => void;
}

export default function OperationDetail({
  operation,
  signups,
  signupsLoading,
  regions,
  currentUserId,
  isOfficer,
  canEditPlan,
  onSignupChanged,
  onOperationUpdated,
}: Props) {
  const region = regions.find((r) => r.id === operation.region_id);
  const mySignup = signups.find(
    (s) => s.user_id === currentUserId && s.status !== "CANCELLED"
  );

  const durationText = operation.duration_minutes
    ? `${Math.floor(operation.duration_minutes / 60)}h ${operation.duration_minutes % 60}m`
    : "Not set";

  const activeSignups = signups.filter((s) => s.status !== "CANCELLED");

  const [confirmAction, setConfirmAction] = useState<"COMPLETED" | "CANCELLED" | null>(null);
  const [updating, setUpdating] = useState(false);

  // Debrief state
  const [debriefText, setDebriefText] = useState(operation.debrief ?? "");
  const [showDebriefEditor, setShowDebriefEditor] = useState(false);
  const [savingDebrief, setSavingDebrief] = useState(false);

  // Debrief text for the completion modal
  const [completionDebrief, setCompletionDebrief] = useState("");

  // Sync debrief text when operation changes
  useEffect(() => {
    setDebriefText(operation.debrief ?? "");
    setShowDebriefEditor(false);
  }, [operation.id, operation.debrief]);

  const isCreator = operation.created_by === currentUserId;
  const canManage = isCreator || isOfficer;
  const isActionable =
    operation.status !== "COMPLETED" && operation.status !== "CANCELLED";
  const isClosed =
    operation.status === "COMPLETED" || operation.status === "CANCELLED";

  const handleStatusChange = async () => {
    if (!confirmAction) return;
    setUpdating(true);
    try {
      const payload: Record<string, string> = { status: confirmAction };
      // Include debrief when completing
      if (confirmAction === "COMPLETED" && completionDebrief.trim()) {
        payload.debrief = completionDebrief.trim();
      }
      await updateOperation(operation.id, payload);
      setCompletionDebrief("");
      onOperationUpdated();
    } catch {
      // TODO: toast error
    } finally {
      setUpdating(false);
      setConfirmAction(null);
    }
  };

  const handleSaveDebrief = async () => {
    setSavingDebrief(true);
    try {
      await updateOperation(operation.id, { debrief: debriefText.trim() || null });
      setShowDebriefEditor(false);
      onOperationUpdated();
    } catch {
      // TODO: toast error
    } finally {
      setSavingDebrief(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 500,
              color: "var(--color-light)",
              margin: "0 0 4px",
            }}
          >
            {operation.name}
          </h2>
          <StatusBadge status={operation.status} />
        </div>
        <SignupButton
          operationId={operation.id}
          existingSignup={mySignup ?? null}
          onChanged={onSignupChanged}
        />
      </div>

      {/* Info grid */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-content">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px 24px",
              fontSize: 13,
            }}
          >
            <InfoRow
              label="When"
              value={format(
                new Date(operation.scheduled_at),
                "dd MMM yyyy, HH:mm"
              )}
            />
            <InfoRow label="Duration" value={durationText} />
            <InfoRow label="Region" value={region?.name ?? "—"} />
            <InfoRow
              label="Meeting Point"
              value={operation.location_detail ?? "—"}
            />
            <InfoRow
              label="Created"
              value={format(new Date(operation.created_at), "dd MMM yyyy")}
            />
          </div>

          {/* Objective / Description */}
          {operation.description && (
            <div style={{ marginTop: 16 }}>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--color-text-dim)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Objective
              </span>
              <p
                style={{
                  margin: "4px 0 0",
                  color: "var(--color-text)",
                  whiteSpace: "pre-wrap",
                  fontSize: 13,
                }}
              >
                {operation.description}
              </p>
            </div>
          )}

          {/* Invited groups */}
          {operation.invited_groups && operation.invited_groups.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--color-text-dim)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Invited Groups
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {operation.invited_groups.map((g) => (
                  <span
                    key={g.id}
                    style={{
                      display: "inline-block",
                      padding: "2px 10px",
                      borderRadius: 3,
                      fontSize: 12,
                      background: "rgba(91,128,160,0.12)",
                      color: "var(--color-secondary)",
                    }}
                  >
                    [{g.tag}] {g.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Linked logistics lists */}
      <LinkedLogisticsLists operation={operation} canManage={canManage} />

      {/* Operation actions (complete / cancel) */}
      {canManage && isActionable && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div
            className="card-content"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: "var(--color-text-dim)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Manage Operation
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-small"
                style={{ background: "#2e7d32", fontSize: 12 }}
                disabled={updating}
                onClick={() => setConfirmAction("COMPLETED")}
              >
                <i
                  className="material-icons left"
                  style={{ fontSize: 16, marginRight: 4 }}
                >
                  check_circle
                </i>
                Mark Completed
              </button>
              <button
                className="btn btn-small"
                style={{ background: "#c62828", fontSize: 12 }}
                disabled={updating}
                onClick={() => setConfirmAction("CANCELLED")}
              >
                <i
                  className="material-icons left"
                  style={{ fontSize: 16, marginRight: 4 }}
                >
                  cancel
                </i>
                Cancel Operation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debrief section — show when operation is closed */}
      {isClosed && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-content">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: "var(--color-text-dim)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Debrief
              </span>
              {canManage && !showDebriefEditor && (
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
                  onClick={() => setShowDebriefEditor(true)}
                >
                  <i
                    className="material-icons"
                    style={{ fontSize: 14, verticalAlign: "middle" }}
                  >
                    edit
                  </i>{" "}
                  {operation.debrief ? "Edit" : "Add Debrief"}
                </button>
              )}
            </div>

            {showDebriefEditor ? (
              <div>
                <textarea
                  value={debriefText}
                  onChange={(e) => setDebriefText(e.target.value)}
                  placeholder="Write a debrief summary... (supports Markdown)"
                  rows={8}
                  style={{
                    width: "100%",
                    background: "rgba(0,0,0,0.2)",
                    border: "1px solid rgba(219,218,216,0.15)",
                    borderRadius: 4,
                    color: "var(--color-text)",
                    padding: "8px 10px",
                    fontSize: 13,
                    fontFamily: "monospace",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  <button
                    className="btn btn-small btn-secondary"
                    onClick={() => {
                      setDebriefText(operation.debrief ?? "");
                      setShowDebriefEditor(false);
                    }}
                    disabled={savingDebrief}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-small"
                    onClick={handleSaveDebrief}
                    disabled={savingDebrief}
                  >
                    {savingDebrief ? "Saving..." : "Save Debrief"}
                  </button>
                </div>
              </div>
            ) : operation.debrief ? (
              <MarkdownPreview text={operation.debrief} />
            ) : (
              <p
                style={{
                  color: "var(--color-text-dim)",
                  fontSize: 13,
                  fontStyle: "italic",
                  margin: 0,
                }}
              >
                No debrief written yet.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Operation Plan (live, collaborative) */}
      <OperationPlanPanel
        operationId={operation.id}
        canEdit={canEditPlan}
        peerId={currentUserId}
      />

      {/* Signups */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <h3 className="section-heading" style={{ margin: 0 }}>
          Signups
        </h3>
        <span
          style={{
            fontSize: 11,
            background: "rgba(36,86,130,0.15)",
            color: "var(--color-secondary)",
            padding: "1px 8px",
            borderRadius: 3,
          }}
        >
          {activeSignups.length}
        </span>
      </div>

      {signupsLoading ? (
        <LoadingSpinner />
      ) : (
        <SignupList signups={activeSignups} />
      )}

      {/* Completion confirmation modal — includes debrief textarea */}
      {confirmAction === "COMPLETED" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.6)",
          }}
          onClick={() => setConfirmAction(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 480, width: "90%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-content">
              <span
                className="card-title"
                style={{ fontSize: 16, marginBottom: 8 }}
              >
                Mark as Completed
              </span>
              <p
                style={{
                  color: "var(--color-text-dim)",
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                Are you sure you want to mark this operation as completed?
              </p>
              <label
                style={{
                  fontSize: 11,
                  color: "var(--color-text-dim)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Debrief (optional — Markdown supported)
              </label>
              <textarea
                value={completionDebrief}
                onChange={(e) => setCompletionDebrief(e.target.value)}
                placeholder="How did the operation go? Key outcomes, lessons learned..."
                rows={6}
                style={{
                  width: "100%",
                  background: "rgba(0,0,0,0.2)",
                  border: "1px solid rgba(219,218,216,0.15)",
                  borderRadius: 4,
                  color: "var(--color-text)",
                  padding: "8px 10px",
                  fontSize: 13,
                  fontFamily: "monospace",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                padding: "0 16px 16px",
              }}
            >
              <button
                className="btn btn-secondary btn-small"
                onClick={() => {
                  setConfirmAction(null);
                  setCompletionDebrief("");
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-small"
                style={{ background: "#2e7d32" }}
                onClick={handleStatusChange}
                disabled={updating}
              >
                {updating ? "Saving..." : "Complete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel confirmation modal */}
      <ConfirmModal
        open={confirmAction === "CANCELLED"}
        title="Cancel Operation"
        message="Are you sure you want to cancel this operation? All signed-up members will be notified."
        confirmLabel="Cancel Operation"
        danger
        onConfirm={handleStatusChange}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

/* ── Simple Markdown preview ─────────────────────────────────────── */
function MarkdownPreview({ text }: { text: string }) {
  // Basic markdown rendering: headers, bold, italic, lists, line breaks
  const renderMarkdown = (md: string): string => {
    let html = md
      // Escape HTML
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      // Headers
      .replace(/^### (.+)$/gm, '<h5 style="margin:8px 0 4px;font-size:13px;color:var(--color-light)">$1</h5>')
      .replace(/^## (.+)$/gm, '<h4 style="margin:10px 0 4px;font-size:14px;color:var(--color-light)">$1</h4>')
      .replace(/^# (.+)$/gm, '<h3 style="margin:12px 0 4px;font-size:15px;color:var(--color-light)">$1</h3>')
      // Bold & italic
      .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      // Unordered lists
      .replace(/^[*-] (.+)$/gm, '<li style="margin-left:16px;font-size:13px">$1</li>')
      // Line breaks (double newline = paragraph)
      .replace(/\n\n/g, "<br/><br/>")
      .replace(/\n/g, "<br/>");
    return html;
  };

  return (
    <div
      style={{
        color: "var(--color-text)",
        fontSize: 13,
        lineHeight: 1.6,
      }}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
    />
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span
        style={{
          fontSize: 11,
          color: "var(--color-text-dim)",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          display: "block",
          marginBottom: 2,
        }}
      >
        {label}
      </span>
      <span style={{ color: "var(--color-light)" }}>{value}</span>
    </div>
  );
}
