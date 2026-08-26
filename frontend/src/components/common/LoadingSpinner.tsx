/* ── Simple CSS spinner ───────────────────────────────────────────── */

const style: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  minHeight: 200,
};

const spinnerStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  border: "3px solid var(--color-surface-alt)",
  borderTopColor: "var(--color-primary)",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
};

export default function LoadingSpinner() {
  return (
    <div style={style}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={spinnerStyle} />
    </div>
  );
}
