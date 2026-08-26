/* ── Create operation form with group invite picker ───────────────── */

import { useState, useEffect, useCallback } from "react";
import type { Region, Group } from "../../types/models";
import type { MapShape } from "../map/mapTypes";
import { createOperation, searchGroupsByFaction } from "../../api/operations";
import { toastSuccess, toastError } from "../common/Toast";
import PlanMapEditor, { COLORS } from "./PlanMapEditor";
import MapCanvas from "../map/MapCanvas";
import { useOperationPlanStore } from "./planStore";

interface Props {
  groupId: string;
  warId: number;
  faction: string;
  regions: Region[];
  onCreated: () => void;
  onCancel: () => void;
}

export default function CreateOperationForm({
  groupId,
  warId,
  faction,
  regions,
  onCreated,
  onCancel,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const [locationDetail, setLocationDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Group invite state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Group[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitedGroups, setInvitedGroups] = useState<Group[]>([]);
  const [allFactionGroups, setAllFactionGroups] = useState<Group[]>([]);

  // Plan map state
  const [showPlanEditor, setShowPlanEditor] = useState(false);
  const [planShapes, setPlanShapes] = useState<MapShape[] | null>(null);

  // Load all faction groups on mount
  useEffect(() => {
    searchGroupsByFaction(faction).then((groups) => {
      const others = groups.filter((g) => g.id !== groupId);
      setAllFactionGroups(others);
      if (others.length <= 10) {
        setSearchResults(others);
      }
    });
  }, [faction, groupId]);

  const handleSearch = useCallback(
    async (q: string) => {
      setSearchQuery(q);
      if (!q.trim()) {
        setSearchResults(
          allFactionGroups.length <= 10 ? allFactionGroups : []
        );
        return;
      }
      setSearching(true);
      try {
        const results = await searchGroupsByFaction(faction, q);
        setSearchResults(results.filter((g) => g.id !== groupId));
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    },
    [faction, groupId, allFactionGroups]
  );

  const toggleInvite = (group: Group) => {
    setInvitedGroups((prev) => {
      const exists = prev.find((g) => g.id === group.id);
      if (exists) return prev.filter((g) => g.id !== group.id);
      return [...prev, group];
    });
  };

  const handlePlanSave = useCallback((shapes: MapShape[]) => {
    setPlanShapes(shapes);
    useOperationPlanStore.getState().loadState(shapes);
    setShowPlanEditor(false);
  }, []);

  const handleRemovePlan = useCallback(() => {
    setPlanShapes(null);
    useOperationPlanStore.getState().clearAll();
  }, []);

  const canSubmit = name.trim() && scheduledAt && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      await createOperation({
        group_id: groupId,
        war_id: warId,
        name: name.trim(),
        description: description.trim() || null,
        scheduled_at: new Date(scheduledAt).toISOString(),
        duration_minutes: durationMin ? parseInt(durationMin, 10) : null,
        region_id: selectedRegionId,
        location_detail: locationDetail.trim() || null,
        invited_group_ids: invitedGroups.map((g) => g.id),
        plan_shapes: planShapes,
      });

      toastSuccess("Operation created!");
      onCreated();
    } catch {
      toastError("Failed to create operation.");
    } finally {
      setSubmitting(false);
    }
  };

  const showSearch = allFactionGroups.length > 10;

  // If plan editor is open, show it full-screen instead of the form
  if (showPlanEditor) {
    return (
      <PlanMapEditor
        onSave={handlePlanSave}
        onCancel={() => setShowPlanEditor(false)}
        initialShapes={planShapes ?? undefined}
      />
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 500,
            color: "var(--color-light)",
            margin: 0,
          }}
        >
          New Operation
        </h2>
        <button className="btn btn-secondary btn-small" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Basic info */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-content">
            <div className="form-field">
              <label>Operation Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Blemish Push"
                maxLength={255}
                required
              />
            </div>

            <div className="form-field">
              <label>Objective</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the operation objectives..."
                rows={4}
                style={{ resize: "vertical" }}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <div className="form-field">
                <label>When</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label>Duration (minutes)</label>
                <input
                  type="number"
                  value={durationMin}
                  onChange={(e) => setDurationMin(e.target.value)}
                  placeholder="e.g. 120"
                  min={1}
                  max={100000}
                />
                {durationMin && parseInt(durationMin) > 0 && (
                  <span
                    style={{ fontSize: 11, color: "var(--color-text-dim)" }}
                  >
                    = {Math.floor(parseInt(durationMin) / 60)}h{" "}
                    {parseInt(durationMin) % 60}m
                  </span>
                )}
              </div>
            </div>

            <div className="form-field">
              <label>Meeting Point</label>
              <input
                type="text"
                value={locationDetail}
                onChange={(e) => setLocationDetail(e.target.value)}
                placeholder="e.g. Blemish seaport, south bridge"
                maxLength={500}
              />
            </div>
          </div>
        </div>

        {/* Region select */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-content">
            <div className="form-field">
              <label>Region</label>
              <select
                className="browser-default"
                value={selectedRegionId ?? ""}
                onChange={(e) =>
                  setSelectedRegionId(
                    e.target.value ? parseInt(e.target.value, 10) : null
                  )
                }
              >
                <option value="">— No region —</option>
                {regions
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        {/* Operation Plan Map */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-content">
            <span className="section-heading" style={{ margin: "0 0 12px", display: "block" }}>
              Operation Plan
            </span>

            {planShapes && planShapes.length > 0 ? (
              <div>
                <div
                  style={{
                    height: 220,
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: 4,
                    overflow: "hidden",
                    border: "1px solid rgba(219,218,216,0.12)",
                    marginBottom: 8,
                  }}
                >
                  <MapCanvas
                    activeTool="arrow"
                    activeColor={COLORS[0]}
                    strokeWidth={3}
                    peerId="preview"
                    onShapeAdded={() => {}}
                    store={useOperationPlanStore}
                    readOnly
                  />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-small btn-secondary"
                    onClick={() => setShowPlanEditor(true)}
                  >
                    <i className="material-icons left" style={{ fontSize: 16 }}>edit</i>
                    Redraw
                  </button>
                  <button
                    type="button"
                    className="btn btn-small btn-secondary"
                    onClick={handleRemovePlan}
                    style={{ color: "var(--color-danger)" }}
                  >
                    <i className="material-icons left" style={{ fontSize: 16 }}>delete</i>
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => setShowPlanEditor(true)}
              >
                <i className="material-icons left" style={{ fontSize: 16 }}>map</i>
                Draw Plan on Map
              </button>
            )}
          </div>
        </div>

        {/* Group invites */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-content">
            <span className="section-heading" style={{ margin: "0 0 12px", display: "block" }}>
              Invite Groups ({faction})
            </span>

            {invitedGroups.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: 12,
                }}
              >
                {invitedGroups.map((g) => (
                  <span
                    key={g.id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "3px 10px",
                      borderRadius: 3,
                      fontSize: 12,
                      background: "rgba(36,86,130,0.20)",
                      color: "var(--color-light)",
                    }}
                  >
                    [{g.tag}] {g.name}
                    <i
                      className="material-icons"
                      style={{
                        fontSize: 14,
                        cursor: "pointer",
                        opacity: 0.7,
                      }}
                      onClick={() => toggleInvite(g)}
                    >
                      close
                    </i>
                  </span>
                ))}
              </div>
            )}

            {showSearch && (
              <div className="form-field" style={{ marginBottom: 8 }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search groups by name or tag..."
                  style={{ fontSize: 13 }}
                />
              </div>
            )}

            <div
              style={{
                maxHeight: 200,
                overflowY: "auto",
                border: "1px solid rgba(219,218,216,0.08)",
                borderRadius: 4,
              }}
            >
              {searching ? (
                <div
                  style={{
                    padding: 12,
                    textAlign: "center",
                    color: "var(--color-text-dim)",
                    fontSize: 12,
                  }}
                >
                  Searching...
                </div>
              ) : searchResults.length === 0 ? (
                <div
                  style={{
                    padding: 12,
                    textAlign: "center",
                    color: "var(--color-text-dim)",
                    fontSize: 12,
                  }}
                >
                  {showSearch && !searchQuery.trim()
                    ? "Type to search groups..."
                    : "No groups found."}
                </div>
              ) : (
                searchResults.map((g) => {
                  const isInvited = invitedGroups.some((ig) => ig.id === g.id);
                  return (
                    <div
                      key={g.id}
                      onClick={() => toggleInvite(g)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        cursor: "pointer",
                        borderBottom: "1px solid rgba(219,218,216,0.04)",
                        background: isInvited
                          ? "rgba(36,86,130,0.10)"
                          : "transparent",
                      }}
                    >
                      <span style={{ fontSize: 13, color: "var(--color-text)" }}>
                        <span style={{ color: "var(--color-text-dim)" }}>
                          [{g.tag}]
                        </span>{" "}
                        {g.name}
                      </span>
                      {isInvited && (
                        <i
                          className="material-icons"
                          style={{
                            fontSize: 16,
                            color: "var(--color-success, #3a7d44)",
                          }}
                        >
                          check
                        </i>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <button className="btn" type="submit" disabled={!canSubmit}>
          {submitting ? "Creating..." : "Create Operation"}
        </button>
      </form>
    </div>
  );
}
