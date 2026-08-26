/* ── Empty state placeholder ──────────────────────────────────────── */

interface Props {
  icon?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon, title, subtitle, action }: Props) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 48,
        textAlign: "center",
      }}
    >
      {icon && (
        <i
          className="material-icons"
          style={{ fontSize: 48, color: "var(--color-text-dim)", marginBottom: 12 }}
        >
          {icon}
        </i>
      )}
      <p style={{ fontSize: 16, color: "var(--color-light)", margin: "0 0 4px" }}>
        {title}
      </p>
      {subtitle && (
        <p style={{ fontSize: 13, color: "var(--color-text-dim)", margin: 0 }}>
          {subtitle}
        </p>
      )}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}
