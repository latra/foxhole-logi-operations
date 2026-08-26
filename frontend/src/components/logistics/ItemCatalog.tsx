/* ── Bottom panel: searchable, filterable item catalog ────────────── */

import { useState } from "react";
import { useLogisticsStore } from "../../stores/logisticsStore";
import { toastError } from "../common/Toast";
import ItemCatalogEntry from "./ItemCatalogEntry";
import CategoryFilter from "./CategoryFilter";
import type { FoxholeItem } from "../../types/models";

interface Props {
  itemCatalog: FoxholeItem[];
  faction: "COLONIAL" | "WARDEN" | "NEUTRAL";
  catalogFilter: string;
  onFilterChange: (category: string) => void;
}

export default function ItemCatalog({
  itemCatalog,
  faction,
  catalogFilter,
  onFilterChange,
}: Props) {
  const resolveItemId = useLogisticsStore((s) => s.resolveItemId);
  const addSlotItem = useLogisticsStore((s) => s.addSlotItem);

  const [searchTerm, setSearchTerm] = useState("");
  const [addingCode, setAddingCode] = useState<string | null>(null);

  const categories = ["All", ...new Set(itemCatalog.map((i) => i.categoryName))];

  const factionFilter = faction === "COLONIAL" ? "C" : faction === "WARDEN" ? "W" : "N";
  const trimmedSearch = searchTerm.trim().toLowerCase();
  const isSearching = trimmedSearch !== "";
  const filteredItems = itemCatalog.filter((item) => {
    const matchesFaction = item.faction === factionFilter || item.faction === "N";
    // While searching, look across every category — otherwise a leftover
    // category selection silently hides matches from other categories.
    const matchesCategory =
      isSearching || catalogFilter === "All" || item.categoryName === catalogFilter;
    const matchesSearch = !isSearching || item.itemName.toLowerCase().includes(trimmedSearch);
    return matchesFaction && matchesCategory && matchesSearch;
  });

  const handlePick = async (item: FoxholeItem, count: number) => {
    if (addingCode) return;
    setAddingCode(item.displayId);
    try {
      const itemId = await resolveItemId(item);
      if (itemId == null) {
        toastError(`Couldn't register "${item.itemName}" in the catalog.`);
        return;
      }
      // Sequential so each unit lands in its own free unassigned slot
      for (let i = 0; i < count; i++) {
        await addSlotItem(itemId, null);
      }
    } finally {
      setAddingCode(null);
    }
  };

  return (
    <div className="card" style={{ margin: 0 }}>
      <div style={{ padding: "10px 12px 0" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 8,
          }}
        >
          <i className="material-icons" style={{ fontSize: 16, color: "var(--color-text-dim)" }}>
            inventory_2
          </i>
          <span
            style={{
              color: "var(--color-text-dim)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Item Catalog
          </span>
          <input
            type="text"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ flex: 1, fontSize: 12, marginLeft: 8 }}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, padding: "0 12px 12px", height: 240 }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
            gap: 6,
            alignContent: "start",
          }}
        >
          {filteredItems.map((item) => (
            <ItemCatalogEntry
              key={item.displayId}
              item={item}
              disabled={addingCode !== null}
              onPick={(count) => handlePick(item, count)}
            />
          ))}
          {filteredItems.length === 0 && (
            <div
              style={{
                color: "var(--color-text-dim)",
                fontSize: 12,
                padding: 12,
                gridColumn: "1 / -1",
              }}
            >
              No items match your search.
            </div>
          )}
        </div>

        <div
          style={{
            flex: "0 0 130px",
            overflowY: "auto",
            borderLeft: "1px solid rgba(219,218,216,0.08)",
            paddingLeft: 10,
          }}
        >
          <CategoryFilter
            categories={categories}
            active={catalogFilter}
            onSelect={onFilterChange}
            disabled={isSearching}
          />
        </div>
      </div>
    </div>
  );
}
