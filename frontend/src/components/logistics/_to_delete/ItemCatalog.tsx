/* ── Bottom panel: filterable item catalog ────────────────────────── */

import { useMemo } from "react";
import CategoryFilter, { filterByCategory } from "./CategoryFilter";
import ItemCatalogEntry from "./ItemCatalogEntry";
import type { FoxholeItem } from "../../types/models";

interface Props {
  items: FoxholeItem[];
  catalogFilter: string;
  faction: "COLONIAL" | "WARDEN" | "NEUTRAL";
  onFilterChange: (category: string) => void;
  onAddItem: (itemId: string, count: number) => void;
  onCatalogDragStart: (e: React.DragEvent, itemId: string) => void;
}

export default function ItemCatalog({
  items,
  catalogFilter,
  faction,
  onFilterChange,
  onAddItem,
  onCatalogDragStart,
}: Props) {
  // Filter by faction (show faction-specific + neutral) and category
  const factionCode = faction === "WARDEN" ? "W" : faction === "COLONIAL" ? "C" : "N";
  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          (item.faction === factionCode || item.faction === "N") &&
          filterByCategory(item.categoryName, catalogFilter),
      ),
    [items, factionCode, catalogFilter],
  );

  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid rgba(219,218,216,0.08)",
        borderRadius: "var(--radius)",
        display: "flex",
        height: 240,
        overflow: "hidden",
      }}
    >
      {/* Item grid */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 12,
        }}
      >
        <div
          style={{
            color: "var(--color-text-dim)",
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 8,
          }}
        >
          Item Catalog
          <span style={{ marginLeft: 8, fontWeight: 400, fontSize: 11 }}>
            ({filtered.length})
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            alignContent: "flex-start",
          }}
        >
          {filtered.map((item) => (
            <ItemCatalogEntry
              key={item.displayId}
              item={item}
              onClick={(e) => {
                const count = e.shiftKey ? 4 : 1;
                onAddItem(item.displayId, count);
              }}
              onDragStart={(e) => onCatalogDragStart(e, item.displayId)}
            />
          ))}
          {filtered.length === 0 && (
            <span
              style={{ color: "var(--color-text-dim)", fontSize: 13, padding: 16 }}
            >
              No items match this filter.
            </span>
          )}
        </div>
      </div>

      {/* Filter sidebar */}
      <div
        style={{
          width: 100,
          borderLeft: "1px solid rgba(219,218,216,0.08)",
          padding: "12px 4px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            color: "var(--color-text-dim)",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 8,
            paddingLeft: 8,
          }}
        >
          Showing
        </div>
        <CategoryFilter active={catalogFilter} onChange={onFilterChange} />
      </div>
    </div>
  );
}
