/* ── Searchable dropdown for map storage locations ───────────────── */

import { useState, useRef, useEffect, useMemo } from "react";

interface Props {
  locations: string[];
  value: string;
  onChange: (value: string) => void;
}

export default function StoreLocationSelect({
  locations,
  value,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearch(value);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        // If search doesn't match any option, keep as custom
        if (search !== value) onChange(search);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [search, value, onChange]);

  const filtered = useMemo(
    () =>
      search.trim().length === 0
        ? locations.slice(0, 50)
        : locations.filter((l) =>
            l.toLowerCase().includes(search.toLowerCase()),
          ).slice(0, 50),
    [locations, search],
  );

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <input
        type="text"
        value={search}
        placeholder="Search location..."
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onChange(search);
            setOpen(false);
          }
        }}
        style={{ width: "100%" }}
      />
      {open && filtered.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            maxHeight: 200,
            overflowY: "auto",
            background: "var(--color-surface)",
            border: "1px solid rgba(219,218,216,0.12)",
            borderRadius: "var(--radius)",
            zIndex: 100,
            marginTop: 2,
          }}
        >
          {filtered.map((loc) => (
            <div
              key={loc}
              onClick={() => {
                onChange(loc);
                setSearch(loc);
                setOpen(false);
              }}
              style={{
                padding: "6px 12px",
                fontSize: 13,
                color: "var(--color-text)",
                cursor: "pointer",
                transition: "background 150ms ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background =
                  "rgba(36,86,130,0.10)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background =
                  "transparent";
              }}
            >
              {loc}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
