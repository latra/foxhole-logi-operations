/* ── Vertical category filter list ────────────────────────────────── */

interface Props {
  categories: string[];
  active: string;
  onSelect: (category: string) => void;
  /** True while a text search is overriding category filtering. */
  disabled?: boolean;
}

export default function CategoryFilter({ categories, active, onSelect, disabled }: Props) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {categories.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onSelect(c)}
          title={disabled ? "Clear the search box to filter by category" : undefined}
          style={{
            border: "none",
            textAlign: "left",
            padding: "4px 8px",
            borderRadius: "var(--radius)",
            fontSize: 11,
            cursor: "pointer",
            whiteSpace: "nowrap",
            color: active === c && !disabled ? "var(--color-secondary)" : "var(--color-text-dim)",
            fontWeight: active === c && !disabled ? 600 : 400,
            background: active === c && !disabled ? "rgba(36,86,130,0.10)" : "transparent",
          }}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
