/* ── Generic confirmation modal ───────────────────────────────────── */

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
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
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius)",
          padding: 24,
          width: "100%",
          maxWidth: 380,
          border: "1px solid rgba(219,218,216,0.12)",
        }}
      >
        <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>{title}</h3>
        <p
          style={{
            margin: "0 0 20px",
            color: "var(--color-text-dim)",
            fontSize: 14,
          }}
        >
          {message}
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            className="btn btn-secondary btn-small"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="btn btn-small"
            onClick={onConfirm}
            style={
              danger
                ? {
                    background: "var(--color-danger, #b33a3a)",
                    borderColor: "var(--color-danger, #b33a3a)",
                  }
                : undefined
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
