/* ── Status badge component ───────────────────────────────────────── */

const OPERATION_COLORS: Record<string, { bg: string; text: string }> = {
  PLANNED: { bg: "rgba(91,128,160,0.15)", text: "#5b80a0" },
  OPEN: { bg: "rgba(36,86,130,0.20)", text: "#4a9cd6" },
  IN_PROGRESS: { bg: "rgba(196,155,42,0.15)", text: "#c49b2a" },
  COMPLETED: { bg: "rgba(58,125,68,0.15)", text: "#3a7d44" },
  CANCELLED: { bg: "rgba(179,58,58,0.10)", text: "#b33a3a" },
};

const SIGNUP_COLORS: Record<string, { bg: string; text: string }> = {
  ATTENDING: { bg: "rgba(58,125,68,0.15)", text: "#3a7d44" },
  ARRIVING_LATE: { bg: "rgba(196,155,42,0.15)", text: "#c49b2a" },
  CANCELLED: { bg: "rgba(138,138,138,0.10)", text: "#8a8a8a" },
};

/* OrderStatus: DRAFT, OPEN, IN_PROGRESS, COMPLETED, CANCELLED */
const LOGISTICS_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: "rgba(138,138,138,0.10)", text: "#8a8a8a" },
  OPEN: { bg: "rgba(36,86,130,0.20)", text: "#4a9cd6" },
  IN_PROGRESS: { bg: "rgba(196,155,42,0.15)", text: "#c49b2a" },
  COMPLETED: { bg: "rgba(58,125,68,0.15)", text: "#3a7d44" },
  CANCELLED: { bg: "rgba(179,58,58,0.10)", text: "#b33a3a" },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  CRITICAL: { bg: "rgba(179,58,58,0.15)", text: "#b33a3a" },
  REQUIRED: { bg: "rgba(196,155,42,0.15)", text: "#c49b2a" },
  PREFERRED: { bg: "rgba(36,86,130,0.15)", text: "#4a9cd6" },
  OPTIONAL: { bg: "rgba(138,138,138,0.10)", text: "#8a8a8a" },
};

interface Props {
  status: string;
  variant?: "operation" | "signup" | "logistics" | "priority";
}

export default function StatusBadge({ status, variant = "operation" }: Props) {
  const colorMap =
    variant === "signup"
      ? SIGNUP_COLORS
      : variant === "logistics"
        ? LOGISTICS_COLORS
        : variant === "priority"
          ? PRIORITY_COLORS
          : OPERATION_COLORS;

  const colors = colorMap[status];
  const fallback = { bg: "rgba(138,138,138,0.10)", text: "#8a8a8a" };
  const { bg, text } = colors ?? fallback;

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 3,
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        background: bg,
        color: text,
        whiteSpace: "nowrap",
      }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
