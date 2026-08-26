/* ── Create group form ────────────────────────────────────────────── */

import { useState } from "react";
import { createGroup } from "../../api/groups";
import { toastSuccess, toastError } from "../common/Toast";

interface Props {
  onCreated: () => void;
}

export default function CreateGroupForm({ onCreated }: Props) {
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [faction, setFaction] = useState("WARDEN");
  const [guildId, setGuildId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = name.trim() && tag.trim() && guildId.trim() && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await createGroup({
        name: name.trim(),
        tag: tag.trim(),
        faction,
        discord_guild_id: guildId.trim(),
        discord_member_role_id: roleId.trim() || null,
      });
      toastSuccess("Group created!");
      setName("");
      setTag("");
      setGuildId("");
      setRoleId("");
      onCreated();
    } catch {
      toastError("Failed to create group.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card">
      <div className="card-content">
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label>Group Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Warden Logistics Group"
              maxLength={255}
              required
            />
          </div>

          <div className="form-field">
            <label>Tag</label>
            <input
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="e.g. WLG"
              maxLength={50}
              required
            />
          </div>

          <div className="form-field">
            <label>Faction</label>
            <select
              className="browser-default"
              value={faction}
              onChange={(e) => setFaction(e.target.value)}
            >
              <option value="WARDEN">Warden</option>
              <option value="COLONIAL">Colonial</option>
            </select>
          </div>

          <div className="form-field">
            <label>Discord Server ID</label>
            <input
              type="text"
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
              placeholder="Discord guild ID"
              required
            />
          </div>

          <div className="form-field">
            <label>Discord Member Role ID (optional)</label>
            <input
              type="text"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              placeholder="Role ID for membership verification"
            />
          </div>

          <button className="btn" type="submit" disabled={!canSubmit}>
            {submitting ? "Creating..." : "Create Group"}
          </button>
        </form>
      </div>
    </div>
  );
}
