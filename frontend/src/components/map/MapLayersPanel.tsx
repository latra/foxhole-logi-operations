/* ── Right-side collapsible column: per-structure-type layer visibility ──
 *
 * Docks to the right of the map, full height. Collapses down to a thin
 * vertical tab (still showing an on/off summary) so it never gets in the
 * way, and expands into a full checklist when the user wants to fine-tune
 * what's showing. The war layer itself (showWarLayer) is an all-or-nothing
 * master switch; everything below it is a per-structure-type refinement on
 * top, all visible by default.
 */

import { useState } from "react";
import {
  iconForStructureName,
  STRUCTURE_CATEGORIES,
  STRUCTURE_NAMES_BY_CATEGORY,
  type StructureCategory,
} from "./warPois";

interface Props {
  showWarLayer: boolean;
  onToggleWarLayer: () => void;
  allStructureNames: string[];
  hiddenStructureNames: Set<string>;
  onToggleStructureName: (name: string) => void;
  onToggleCategory: (category: StructureCategory) => void;
  onShowAll: () => void;
  onHideAll: () => void;
}

const COLLAPSED_WIDTH = 36;
const EXPANDED_WIDTH = 268;

export default function MapLayersPanel({
  showWarLayer,
  onToggleWarLayer,
  allStructureNames,
  hiddenStructureNames,
  onToggleStructureName,
  onToggleCategory,
  onShowAll,
  onHideAll,
}: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const [filter, setFilter] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<StructureCategory>>(() => new Set());

  const total = allStructureNames.length;
  const visibleCount = total - hiddenStructureNames.size;
  const allOn = visibleCount === total;
  const allOff = visibleCount === 0;
  const summaryColor = !showWarLayer || allOff
    ? "var(--color-text-dim)"
    : allOn
    ? "var(--color-success)"
    : "#f39c12";

  const q = filter.trim().toLowerCase();
  const toggleCategoryCollapsed = (category: StructureCategory) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        title="Show map layers panel"
        style={{
          width: COLLAPSED_WIDTH,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 10,
          padding: "12px 0",
          background: "var(--color-surface)",
          borderLeft: "var(--border-subtle)",
          cursor: "pointer",
          color: "var(--color-text-dim)",
        }}
      >
        <i className="material-icons" style={{ fontSize: 18 }}>chevron_left</i>
        <i className="material-icons" style={{ fontSize: 18 }}>layers</i>
        <span
          style={{
            writingMode: "vertical-rl",
            fontSize: 11,
            letterSpacing: "0.5px",
            color: "var(--color-text-dim)",
          }}
        >
          Layers
        </span>
        <span
          style={{
            writingMode: "vertical-rl",
            fontSize: 11,
            fontWeight: 700,
            fontFamily: "monospace",
            color: summaryColor,
          }}
        >
          {showWarLayer ? `${visibleCount}/${total}` : "OFF"}
        </span>
      </button>
    );
  }

  return (
    <div
      style={{
        width: EXPANDED_WIDTH,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--color-surface)",
        borderLeft: "var(--border-subtle)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderBottom: "1px solid rgba(219,218,216,0.1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <i className="material-icons" style={{ fontSize: 16, color: "var(--color-text-dim)" }}>layers</i>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-light)" }}>Map Layers</span>
        </div>
        <button
          className="btn-flat"
          title="Collapse panel"
          onClick={() => setCollapsed(true)}
          style={{ padding: "0 4px", minWidth: "auto", height: 22, color: "var(--color-text-dim)" }}
        >
          <i className="material-icons" style={{ fontSize: 18 }}>chevron_right</i>
        </button>
      </div>

      {/* Master toggle */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "10px 12px",
          borderBottom: "1px solid rgba(219,218,216,0.1)",
          cursor: "pointer",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--color-light)", fontWeight: 500 }}>
          <input type="checkbox" checked={showWarLayer} onChange={onToggleWarLayer} />
          Structures layer
        </span>
        <StatusPill on={showWarLayer} />
      </label>

      {/* Filter + summary */}
      <div style={{ padding: "8px 10px 0", opacity: showWarLayer ? 1 : 0.4, pointerEvents: showWarLayer ? "auto" : "none" }}>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter structure types..."
          style={{ width: "100%", fontSize: 12 }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "6px 2px",
            fontSize: 11,
          }}
        >
          <span style={{ color: summaryColor, fontWeight: 600 }}>
            {visibleCount} / {total} visible
          </span>
          <span style={{ display: "flex", gap: 10 }}>
            <button
              className="btn-flat"
              style={{ padding: "0 4px", minWidth: "auto", height: 18, fontSize: 11, color: "var(--color-primary)" }}
              onClick={onShowAll}
            >
              Show all
            </button>
            <button
              className="btn-flat"
              style={{ padding: "0 4px", minWidth: "auto", height: 18, fontSize: 11, color: "var(--color-text-dim)" }}
              onClick={onHideAll}
            >
              Hide all
            </button>
          </span>
        </div>
      </div>

      {/* Checklist, grouped by category */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0 6px 8px",
          opacity: showWarLayer ? 1 : 0.4,
          pointerEvents: showWarLayer ? "auto" : "none",
        }}
      >
        {(() => {
          const sections = STRUCTURE_CATEGORIES.map((category) => ({
            category,
            names: STRUCTURE_NAMES_BY_CATEGORY[category].filter((n) => !q || n.toLowerCase().includes(q)),
          })).filter((s) => s.names.length > 0);

          if (sections.length === 0) {
            return (
              <div style={{ fontSize: 12, color: "var(--color-text-dim)", padding: "6px 6px" }}>
                No structure types match "{filter}"
              </div>
            );
          }

          return sections.map(({ category, names }) => {
            const visibleInCategory = names.filter((n) => !hiddenStructureNames.has(n)).length;
            const categoryAllOn = visibleInCategory === names.length;
            const categoryAllOff = visibleInCategory === 0;
            const sectionCollapsed = collapsedCategories.has(category);

            return (
              <div key={category} style={{ marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => toggleCategoryCollapsed(category)}
                    title={sectionCollapsed ? "Expand" : "Collapse"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      flex: 1,
                      padding: "6px 4px",
                      background: "transparent",
                      color: "var(--color-text-dim)",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <i className="material-icons" style={{ fontSize: 14 }}>
                      {sectionCollapsed ? "chevron_right" : "expand_more"}
                    </i>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.8px" }}>{category}</span>
                    <span style={{ fontSize: 10, color: "var(--color-text-dim)" }}>
                      ({visibleInCategory}/{names.length})
                    </span>
                  </button>
                  <button
                    type="button"
                    title={`${categoryAllOn ? "Hide" : "Show"} all ${category.toLowerCase()}`}
                    onClick={() => onToggleCategory(category)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 22,
                      height: 22,
                      padding: 0,
                      background: "transparent",
                      cursor: "pointer",
                      color: categoryAllOff ? "rgba(219,218,216,0.3)" : "var(--color-success)",
                    }}
                  >
                    <i className="material-icons" style={{ fontSize: 15 }}>
                      {categoryAllOn ? "visibility" : categoryAllOff ? "visibility_off" : "remove_red_eye"}
                    </i>
                  </button>
                </div>

                {!sectionCollapsed &&
                  names.map((name) => {
                    const on = !hiddenStructureNames.has(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        title={`${on ? "Hide" : "Show"} ${name}`}
                        onClick={() => onToggleStructureName(name)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          width: "100%",
                          padding: "5px 8px 5px 20px",
                          borderRadius: 4,
                          fontSize: 12,
                          cursor: "pointer",
                          textAlign: "left",
                          background: on ? "rgba(255,255,255,0.06)" : "transparent",
                          color: on ? "var(--color-text)" : "var(--color-text-dim)",
                          transition: "var(--transition)",
                        }}
                      >
                        {/* The structure's own map icon doubles as the on/off indicator — full white
                            when visible, dimmed gray when hidden, matching its marker on the map. */}
                        <i
                          className="material-icons"
                          style={{
                            fontSize: 16,
                            flexShrink: 0,
                            color: on ? "#ffffff" : "rgba(219,218,216,0.3)",
                          }}
                        >
                          {iconForStructureName(name)}
                        </i>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {name}
                        </span>
                      </button>
                    );
                  })}
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}

/** Small colored ON/OFF pill for at-a-glance master-switch feedback. */
function StatusPill({ on }: { on: boolean }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.5px",
        padding: "2px 7px",
        borderRadius: 10,
        background: on ? "rgba(46,204,113,0.18)" : "rgba(219,218,216,0.1)",
        color: on ? "var(--color-success)" : "var(--color-text-dim)",
      }}
    >
      {on ? "ON" : "OFF"}
    </span>
  );
}
