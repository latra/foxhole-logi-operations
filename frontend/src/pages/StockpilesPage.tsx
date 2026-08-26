/* ── Stockpiles Page — group stockpile management ─────────────────── */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "../components/layout/PageShell";
import EmptyState from "../components/common/EmptyState";
import LoadingSpinner from "../components/common/LoadingSpinner";
import ConfirmModal from "../components/common/ConfirmModal";
import { toastSuccess, toastError } from "../components/common/Toast";
import { useLogisticsStore } from "../stores/logisticsStore";
import { useGroupStore } from "../stores/groupStore";
import { useAuthStore } from "../stores/authStore";
import { useCurrentWar } from "../hooks/useCurrentWar";
import { useRegions } from "../hooks/useRegions";
import { createRegion } from "../api/catalog";
import { StockpileStructure, StockpileType } from "../types/enums";
import type { Stockpile, Region } from "../types/models";
import StockpileMapPicker, {
  type StockpilePickResult,
} from "../components/stockpiles/StockpileMapPicker";

const STRUCTURE_LABEL: Record<string, string> = {
  SEAPORT: "Seaport",
  STORAGE_DEPOT: "Storage Depot",
  BUNKER_BASE: "Bunker Base",
  KEEP: "Keep",
  TOWN_BASE: "Town Base",
};

export default function StockpilesPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const activeGroup = useGroupStore((s) => s.activeGroup);
  const memberships = useGroupStore((s) => s.memberships);
  const { fetchGroups, fetchMemberships } = useGroupStore();
  const { war, loading: warLoading } = useCurrentWar();
  const { regions: fetchedRegions } = useRegions(war?.id ?? null);
  const [knownRegions, setKnownRegions] = useState<Region[]>([]);

  const {
    stockpiles,
    fetchStockpiles,
    createNewStockpile,
    removeStockpile,
  } = useLogisticsStore();

  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [regionInput, setRegionInput] = useState("");
  const [structureType, setStructureType] = useState<string>(
    StockpileStructure.STORAGE_DEPOT,
  );
  const [code, setCode] = useState("");
  const [type, setType] = useState<string>(StockpileType.PRIVATE);
  const [notes, setNotes] = useState("");
  const [mapLocation, setMapLocation] = useState<{ hex: string; x: number; y: number } | null>(null);

  /** Either "pick" (choosing a location for the create form) or a stockpile's
   *  saved location to view — null when the map picker/viewer is closed. */
  const [mapPicker, setMapPicker] = useState<
    { mode: "pick" } | { mode: "view"; location: { hex: string; x: number; y: number } } | null
  >(null);

  // Ensure memberships are loaded
  useEffect(() => {
    if (user && memberships.length === 0) {
      fetchGroups().then(() => fetchMemberships(user.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (activeGroup && war) {
      setLoading(true);
      fetchStockpiles(activeGroup.id, war.id).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [activeGroup, war, fetchStockpiles]);

  // Keep a local, appendable copy of regions (base list + any created on the fly)
  useEffect(() => {
    setKnownRegions(fetchedRegions);
  }, [fetchedRegions]);

  const myMembership = memberships.find(
    (m) => m.group_id === activeGroup?.id && m.status === "ACTIVE",
  );
  const canDelete = myMembership?.role === "OWNER" || myMembership?.role === "OFFICER";

  const openCreateModal = () => {
    setName("");
    setCode("");
    setNotes("");
    setStructureType(StockpileStructure.STORAGE_DEPOT);
    setType(StockpileType.PRIVATE);
    setRegionInput("");
    setMapLocation(null);
    setShowCreateModal(true);
  };

  const handleMapPick = (result: StockpilePickResult) => {
    setRegionInput(result.regionName);
    if (result.structureType) setStructureType(result.structureType);
    setMapLocation({ hex: result.hex, x: result.x, y: result.y });
  };

  const handleCreate = async () => {
    const regionTrimmed = regionInput.trim();
    if (!activeGroup) return;
    if (!war) {
      toastError("No active war found. Can't create a stockpile right now.");
      return;
    }
    if (!regionTrimmed || !name.trim() || !code.trim()) {
      toastError("Please fill in name, region and code.");
      return;
    }
    setCreating(true);

    // Resolve the typed region name to an existing region, or create one on the fly
    let region = knownRegions.find(
      (r) => r.name.toLowerCase() === regionTrimmed.toLowerCase(),
    );
    if (!region) {
      try {
        region = await createRegion({ war_id: war.id, name: regionTrimmed });
        setKnownRegions((prev) => [...prev, region!]);
      } catch {
        toastError("Failed to resolve region name");
        setCreating(false);
        return;
      }
    }

    const stockpile = await createNewStockpile({
      group_id: activeGroup.id,
      war_id: war.id,
      region_id: region.id,
      structure_type: structureType,
      code_6digit: code.trim(),
      name: name.trim(),
      type,
      notes: notes.trim() || null,
      map_hex: mapLocation?.hex ?? null,
      map_x: mapLocation?.x ?? null,
      map_y: mapLocation?.y ?? null,
    });
    setCreating(false);
    if (stockpile) {
      toastSuccess("Stockpile created");
      setShowCreateModal(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    const ok = await removeStockpile(id);
    if (ok) toastSuccess("Stockpile deleted");
  };

  const regionName = (id: number) =>
    knownRegions.find((r) => r.id === id)?.name ?? `Region #${id}`;

  if (!activeGroup) {
    return (
      <PageShell>
        <EmptyState
          icon="group"
          title="No group selected"
          subtitle="Join or create a group from the Home page first."
          action={
            <button className="btn btn-small" onClick={() => navigate("/")}>
              Go Home
            </button>
          }
        />
      </PageShell>
    );
  }

  if (loading || warLoading) {
    return (
      <PageShell>
        <LoadingSpinner />
      </PageShell>
    );
  }

  if (!war) {
    return (
      <PageShell>
        <EmptyState
          icon="public_off"
          title="No active war data"
          subtitle="War/region data hasn't synced yet, so stockpiles can't be created. Try again shortly."
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <h2 className="section-heading" style={{ margin: 0 }}>
            Stockpiles
          </h2>
          <div style={{ fontSize: 12, color: "var(--color-text-dim)", marginTop: 2 }}>
            {activeGroup.name} [{activeGroup.tag}]
          </div>
        </div>
        <button className="btn btn-small" onClick={openCreateModal}>
          <i
            className="material-icons left"
            style={{ fontSize: 16, verticalAlign: "middle", marginRight: 4 }}
          >
            add
          </i>
          New Stockpile
        </button>
      </div>

      {stockpiles.length === 0 ? (
        <EmptyState
          icon="inventory_2"
          title="No stockpiles yet"
          subtitle="Create a stockpile so your group can plan logistics orders."
          action={
            <button className="btn btn-small" onClick={openCreateModal}>
              New Stockpile
            </button>
          }
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {stockpiles.map((s: Stockpile) => (
            <div key={s.id} className="card" style={{ margin: 0 }}>
              <div className="card-content" style={{ padding: "14px 16px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        color: "var(--color-light)",
                        fontSize: 15,
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-text-dim)", marginTop: 2 }}>
                      {STRUCTURE_LABEL[s.structure_type] ?? s.structure_type} · {regionName(s.region_id)}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                    {s.map_hex && s.map_x != null && s.map_y != null && (
                      <button
                        className="btn-flat"
                        style={{ padding: "0 4px", minWidth: "auto", color: "var(--color-text-dim)" }}
                        onClick={() =>
                          setMapPicker({
                            mode: "view",
                            location: { hex: s.map_hex!, x: s.map_x!, y: s.map_y! },
                          })
                        }
                        title="View on map"
                      >
                        <i className="material-icons" style={{ fontSize: 18 }}>
                          location_on
                        </i>
                      </button>
                    )}
                    {canDelete && (
                      <button
                        className="btn-flat"
                        style={{
                          padding: "0 4px",
                          minWidth: "auto",
                          color: "var(--color-error, #a03030)",
                        }}
                        onClick={() => setPendingDeleteId(s.id)}
                        title="Delete stockpile"
                      >
                        <i className="material-icons" style={{ fontSize: 18 }}>
                          delete
                        </i>
                      </button>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 10,
                    fontSize: 12,
                    color: "var(--color-text-dim)",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <i className="material-icons" style={{ fontSize: 14 }}>tag</i>
                    {s.code_6digit}
                  </span>
                  <span
                    style={{
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      fontSize: 11,
                      color: s.type === "PUBLIC" ? "var(--color-success, #3a7d44)" : "var(--color-text-dim)",
                    }}
                  >
                    {s.type}
                  </span>
                </div>

                {s.notes && (
                  <div style={{ fontSize: 12, color: "var(--color-text-dim)", marginTop: 8 }}>
                    {s.notes}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create stockpile modal */}
      {showCreateModal && (
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
          onClick={() => setShowCreateModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--color-surface)",
              borderRadius: "var(--radius)",
              padding: 24,
              width: "100%",
              maxWidth: 440,
              border: "1px solid rgba(219,218,216,0.12)",
            }}
          >
            <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>New Stockpile</h3>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "var(--color-text-dim)" }}>
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Stockpile name"
                autoFocus
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: "var(--color-text-dim)" }}>
                  Structure *
                </label>
                <select
                  className="browser-default"
                  value={structureType}
                  onChange={(e) => setStructureType(e.target.value)}
                  style={{ width: "100%", fontSize: 13 }}
                >
                  {Object.values(StockpileStructure).map((st) => (
                    <option key={st} value={st}>
                      {STRUCTURE_LABEL[st] ?? st}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: "var(--color-text-dim)" }}>
                  Region *
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="text"
                    list="region-suggestions"
                    value={regionInput}
                    onChange={(e) => {
                      setRegionInput(e.target.value);
                      setMapLocation(null);
                    }}
                    placeholder="e.g. The Fingers"
                    style={{ width: "100%" }}
                  />
                  <button
                    type="button"
                    className="btn-flat"
                    title="Pick on map"
                    onClick={() => setMapPicker({ mode: "pick" })}
                    style={{
                      padding: "0 8px",
                      minWidth: "auto",
                      color: mapLocation ? "var(--color-primary)" : "var(--color-text-dim)",
                    }}
                  >
                    <i className="material-icons" style={{ fontSize: 18 }}>
                      {mapLocation ? "location_on" : "map"}
                    </i>
                  </button>
                </div>
                <datalist id="region-suggestions">
                  {knownRegions.map((r) => (
                    <option key={r.id} value={r.name} />
                  ))}
                </datalist>
                {mapLocation && (
                  <div style={{ fontSize: 11, color: "var(--color-primary)", marginTop: 4 }}>
                    Picked on map — {STRUCTURE_LABEL[structureType] ?? structureType}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: "var(--color-text-dim)" }}>
                  Code (up to 6 digits) *
                </label>
                <input
                  type="text"
                  value={code}
                  maxLength={6}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  style={{ width: "100%" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: "var(--color-text-dim)" }}>
                  Visibility
                </label>
                <select
                  className="browser-default"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  style={{ width: "100%", fontSize: 13 }}
                >
                  {Object.values(StockpileType).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: "var(--color-text-dim)" }}>
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                style={{ width: "100%", minHeight: 60, resize: "vertical" }}
              />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                className="btn btn-secondary btn-small"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-small"
                onClick={handleCreate}
                disabled={creating || !name.trim() || !code.trim() || !regionInput.trim()}
              >
                {creating ? "Creating..." : "Create Stockpile"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={pendingDeleteId !== null}
        title="Delete stockpile"
        message="This will permanently remove the stockpile. Logistics orders referencing it may be affected."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setPendingDeleteId(null)}
      />

      {mapPicker?.mode === "pick" && (
        <StockpileMapPicker
          mode="pick"
          onSelect={handleMapPick}
          onClose={() => setMapPicker(null)}
        />
      )}
      {mapPicker?.mode === "view" && (
        <StockpileMapPicker
          mode="view"
          location={mapPicker.location}
          onClose={() => setMapPicker(null)}
        />
      )}
    </PageShell>
  );
}
