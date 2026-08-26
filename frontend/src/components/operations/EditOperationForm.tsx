/* ── Inline form to edit an operation's own details ───────────────── */

import { useState } from "react";
import { format } from "date-fns";
import type { Operation, Region } from "../../types/models";
import { updateOperation } from "../../api/operations";
import { toastSuccess, toastError } from "../common/Toast";

interface Props {
  operation: Operation;
  regions: Region[];
  onSaved: () => void;
  onCancel: () => void;
}

export default function EditOperationForm({ operation, regions, onSaved, onCancel }: Props) {
  const [name, setName] = useState(operation.name);
  const [description, setDescription] = useState(operation.description ?? "");
  const [scheduledAt, setScheduledAt] = useState(
    format(new Date(operation.scheduled_at), "yyyy-MM-dd'T'HH:mm")
  );
  const [durationMin, setDurationMin] = useState(
    operation.duration_minutes != null ? String(operation.duration_minutes) : ""
  );
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(operation.region_id);
  const [locationDetail, setLocationDetail] = useState(operation.location_detail ?? "");
  const [saving, setSaving] = useState(false);

  const canSubmit = name.trim() && scheduledAt && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    try {
      await updateOperation(operation.id, {
        name: name.trim(),
        description: description.trim() || null,
        scheduled_at: new Date(scheduledAt).toISOString(),
        duration_minutes: durationMin ? parseInt(durationMin, 10) : null,
        region_id: selectedRegionId,
        location_detail: locationDetail.trim() || null,
      });
      toastSuccess("Operation updated");
      onSaved();
    } catch {
      toastError("Failed to update operation.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-content">
          <div className="form-field">
            <label>Operation Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={255}
              required
              autoFocus
            />
          </div>

          <div className="form-field">
            <label>Objective</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              style={{ resize: "vertical" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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
                min={1}
                max={100000}
              />
            </div>
          </div>

          <div className="form-field">
            <label>Region</label>
            <select
              className="browser-default"
              value={selectedRegionId ?? ""}
              onChange={(e) =>
                setSelectedRegionId(e.target.value ? parseInt(e.target.value, 10) : null)
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

          <div className="form-field">
            <label>Meeting Point</label>
            <input
              type="text"
              value={locationDetail}
              onChange={(e) => setLocationDetail(e.target.value)}
              maxLength={500}
            />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 16 }}>
        <button type="button" className="btn btn-secondary btn-small" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn-small" disabled={!canSubmit}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
