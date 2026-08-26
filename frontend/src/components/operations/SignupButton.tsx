/* ── Signup button — Attending / Arriving Late ────────────────────── */

import { useState } from "react";
import type { OperationSignup } from "../../types/models";
import { createSignup, deleteSignup, updateSignup } from "../../api/operations";
import { toastSuccess, toastError } from "../common/Toast";

interface Props {
  operationId: string;
  existingSignup: OperationSignup | null;
  onChanged: () => void;
}

export default function SignupButton({
  operationId,
  existingSignup,
  onChanged,
}: Props) {
  const [submitting, setSubmitting] = useState(false);

  const handleSignup = async (status: "ATTENDING" | "ARRIVING_LATE") => {
    setSubmitting(true);
    try {
      if (existingSignup) {
        // Update existing signup to change status
        await updateSignup(operationId, existingSignup.id, { status });
        toastSuccess(
          status === "ATTENDING" ? "Attending!" : "Marked as arriving late."
        );
      } else {
        await createSignup(operationId, status);
        toastSuccess(
          status === "ATTENDING" ? "Signed up!" : "Signed up (arriving late)."
        );
      }
      onChanged();
    } catch {
      toastError("Failed to sign up.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!existingSignup) return;
    setSubmitting(true);
    try {
      await deleteSignup(operationId, existingSignup.id);
      toastSuccess("Signup cancelled.");
      onChanged();
    } catch {
      toastError("Failed to cancel signup.");
    } finally {
      setSubmitting(false);
    }
  };

  /* Already signed up */
  if (existingSignup && existingSignup.status !== "CANCELLED") {
    const isLate = existingSignup.status === "ARRIVING_LATE";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            fontSize: 12,
            color: isLate ? "var(--color-warning, #c49b2a)" : "var(--color-success, #3a7d44)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <i className="material-icons" style={{ fontSize: 14 }}>
            {isLate ? "schedule" : "check_circle"}
          </i>
          {isLate ? "Arriving Late" : "Attending"}
        </span>
        {/* Toggle to the other status */}
        <button
          className="btn-flat btn-small"
          onClick={() => handleSignup(isLate ? "ATTENDING" : "ARRIVING_LATE")}
          disabled={submitting}
          style={{ fontSize: 10, color: "var(--color-text-dim)", minWidth: "auto", padding: "0 8px" }}
          title={isLate ? "Change to Attending" : "Change to Arriving Late"}
        >
          <i className="material-icons" style={{ fontSize: 14 }}>swap_horiz</i>
        </button>
        <button
          className="btn btn-secondary btn-small"
          onClick={handleCancel}
          disabled={submitting}
          style={{ fontSize: 10 }}
        >
          Leave
        </button>
      </div>
    );
  }

  /* Not signed up — show two buttons */
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <button
        className="btn btn-small"
        onClick={() => handleSignup("ATTENDING")}
        disabled={submitting}
      >
        <i
          className="material-icons"
          style={{ fontSize: 14, marginRight: 4, verticalAlign: "middle" }}
        >
          check
        </i>
        Attend
      </button>
      <button
        className="btn btn-secondary btn-small"
        onClick={() => handleSignup("ARRIVING_LATE")}
        disabled={submitting}
        style={{ opacity: 0.9 }}
      >
        <i
          className="material-icons"
          style={{ fontSize: 14, marginRight: 4, verticalAlign: "middle" }}
        >
          schedule
        </i>
        Arriving Late
      </button>
    </div>
  );
}
