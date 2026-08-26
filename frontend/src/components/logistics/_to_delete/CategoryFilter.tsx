/* ── Category filter list for item catalog ────────────────────────── */

const CATEGORIES = [
  "All",
  "Supplies",
  "Vehicles",
  "Explosive",
  "Weapons",
  "Medicals",
  "Ammo",
];

interface Props {
  active: string;
  onChange: (category: string) => void;
}

export default function CategoryFilter({ active, onChange }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          style={{
            background: "transparent",
            border: "none",
            color:
              active === cat
                ? "var(--color-primary)"
                : "var(--color-text-dim)",
            fontSize: 12,
            textAlign: "left",
            padding: "4px 8px",
            cursor: "pointer",
            borderRadius: "var(--radius)",
            fontWeight: active === cat ? 600 : 400,
            transition: "color 150ms ease",
            fontFamily: "var(--font-stack)",
          }}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}

/* ── Category mapping for filtering ──────────────────────────────── */

export const CATEGORY_MAP: Record<string, string[]> = {
  Supplies: ["Supplies", "Utilities"],
  Vehicles: ["Vehicles", "Shippables"],
  Explosive: ["Explosives", "Heavy Explosives"],
  Weapons: ["Small Arms", "Heavy Arms", "Heavy Weapons"],
  Medicals: ["Medical"],
  Ammo: ["Ammunition", "Heavy Ammunition"],
};

export function filterByCategory(
  categoryName: string,
  activeFilter: string,
): boolean {
  if (activeFilter === "All") return true;
  const mapped = CATEGORY_MAP[activeFilter];
  if (!mapped) return true;
  return mapped.some(
    (m) => categoryName.toLowerCase().includes(m.toLowerCase()),
  );
}
