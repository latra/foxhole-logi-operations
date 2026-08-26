/* ── Drawing toolbar for the collaborative map ──────────────────── */

import { useState } from "react";
import UserAvatar from "../common/UserAvatar";
import type { ShapeType, ToolMode, PresenceUser } from "./mapTypes";

interface Props {
  activeTool: ToolMode;
  onToolChange: (tool: ToolMode) => void;
  activeColor: string;
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (w: number) => void;
  onUndo: () => void;
  onClear: () => void;
  onExportPng: () => void;
  showDistances: boolean;
  onToggleShowDistances: () => void;
  sessionCode: string | null;
  connectedUsers: PresenceUser[];
  onDisconnect: () => void;
}

const TOOLS: { type: ShapeType; icon: string; label: string; hotkey: string }[] = [
  { type: "line", icon: "show_chart", label: "Line", hotkey: "2" },
  { type: "arrow", icon: "arrow_forward", label: "Arrow", hotkey: "3" },
  { type: "rect", icon: "crop_square", label: "Rectangle", hotkey: "4" },
  { type: "triangle", icon: "change_history", label: "Triangle", hotkey: "5" },
  { type: "circle", icon: "circle", label: "Circle", hotkey: "6" },
  { type: "text", icon: "text_fields", label: "Text", hotkey: "7" },
];

const COLORS = [
  "#e74c3c", // red
  "#f39c12", // orange
  "#f1c40f", // yellow
  "#2ecc71", // green
  "#3498db", // blue
  "#9b59b6", // purple
  "#ecf0f1", // white
  "#e91e63", // pink
];

const STROKE_WIDTHS = [2, 3, 5, 8];

export default function MapToolbar({
  activeTool,
  onToolChange,
  activeColor,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  onUndo,
  onClear,
  onExportPng,
  showDistances,
  onToggleShowDistances,
  sessionCode,
  connectedUsers,
  onDisconnect,
}: Props) {
  const [showUsersMenu, setShowUsersMenu] = useState(false);

  return (
    <div style={toolbarStyle}>
      {/* Session info */}
      <div style={sectionStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            background: "rgba(36,86,130,0.15)",
            borderRadius: 4,
            fontSize: 12,
            position: "relative",
          }}
        >
          <i className="material-icons" style={{ fontSize: 14, color: "var(--color-primary)" }}>
            wifi
          </i>
          <span style={{ color: "var(--color-text-dim)", fontFamily: "monospace", letterSpacing: "1.5px" }}>
            {sessionCode}
          </span>
          <button
            title="Copy code"
            className="btn-flat"
            style={{
              padding: "0 4px",
              minWidth: "auto",
              height: 22,
              lineHeight: "22px",
              color: "var(--color-text-dim)",
            }}
            onClick={() => {
              if (sessionCode) navigator.clipboard.writeText(sessionCode);
            }}
          >
            <i className="material-icons" style={{ fontSize: 14 }}>content_copy</i>
          </button>
          <span
            style={{
              width: 1,
              height: 16,
              background: "rgba(219,218,216,0.12)",
              margin: "0 2px",
            }}
          />
          <button
            title="Connected users"
            className="btn-flat"
            onClick={() => setShowUsersMenu((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "0 4px",
              minWidth: "auto",
              height: 22,
              color: "var(--color-text-dim)",
            }}
          >
            <i className="material-icons" style={{ fontSize: 14, color: "var(--color-success)" }}>
              people
            </i>
            <span>{connectedUsers.length}</span>
          </button>

          {showUsersMenu && (
            <>
              <div
                onClick={() => setShowUsersMenu(false)}
                style={{ position: "fixed", inset: 0, zIndex: 149 }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  minWidth: 200,
                  maxHeight: 280,
                  overflowY: "auto",
                  background: "var(--color-surface)",
                  border: "1px solid rgba(219,218,216,0.12)",
                  borderRadius: "var(--radius)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                  zIndex: 150,
                  padding: 6,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-dim)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    padding: "4px 6px",
                  }}
                >
                  On this map ({connectedUsers.length})
                </div>
                {connectedUsers.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--color-text-dim)", padding: "4px 6px" }}>
                    Nobody else here yet
                  </div>
                ) : (
                  connectedUsers.map((u) => (
                    <div
                      key={u.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px",
                        borderRadius: 4,
                        fontSize: 13,
                        color: "var(--color-text)",
                      }}
                    >
                      <UserAvatar avatarUrl={u.avatar_url} size={22} />
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {u.display_name}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Divider */}
      <span style={dividerStyle} />

      {/* Select tool — pick an existing shape to move/resize/rotate/delete it */}
      <div style={sectionStyle}>
        <button
          className="btn-flat"
          title="Select (move, resize, rotate, delete a shape) (1)"
          style={{
            ...toolBtnStyle,
            background: activeTool === "select" ? "rgba(36,86,130,0.25)" : "transparent",
            color: activeTool === "select" ? "var(--color-light)" : "var(--color-text-dim)",
          }}
          onClick={() => onToolChange("select")}
        >
          <i className="material-icons" style={{ fontSize: 18 }}>touch_app</i>
          <KeyBadge label="1" />
        </button>
      </div>

      <span style={dividerStyle} />

      {/* Shape tools */}
      <div style={sectionStyle}>
        {TOOLS.map((t) => (
          <button
            key={t.type}
            className="btn-flat"
            title={`${t.label} (${t.hotkey})`}
            style={{
              ...toolBtnStyle,
              background: activeTool === t.type ? "rgba(36,86,130,0.25)" : "transparent",
              color: activeTool === t.type ? "var(--color-light)" : "var(--color-text-dim)",
            }}
            onClick={() => onToolChange(t.type)}
          >
            <i className="material-icons" style={{ fontSize: 18 }}>{t.icon}</i>
            <KeyBadge label={t.hotkey} />
          </button>
        ))}
      </div>

      <span style={dividerStyle} />

      {/* Colors */}
      <div style={sectionStyle}>
        {COLORS.map((c) => (
          <button
            key={c}
            title={c}
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: c,
              border: activeColor === c ? "2px solid var(--color-light)" : "2px solid transparent",
              cursor: "pointer",
              padding: 0,
              outline: "none",
              transition: "var(--transition)",
            }}
            onClick={() => onColorChange(c)}
          />
        ))}
      </div>

      <span style={dividerStyle} />

      {/* Stroke width */}
      <div style={sectionStyle}>
        {STROKE_WIDTHS.map((w) => (
          <button
            key={w}
            className="btn-flat"
            title={`${w}px`}
            style={{
              ...toolBtnStyle,
              background: strokeWidth === w ? "rgba(36,86,130,0.25)" : "transparent",
              color: strokeWidth === w ? "var(--color-light)" : "var(--color-text-dim)",
              fontSize: 11,
              fontWeight: 600,
            }}
            onClick={() => onStrokeWidthChange(w)}
          >
            <span
              style={{
                display: "block",
                width: 16,
                height: w,
                background: "currentColor",
                borderRadius: 1,
              }}
            />
          </button>
        ))}
      </div>

      <span style={dividerStyle} />

      {/* Actions */}
      <div style={sectionStyle}>
        <button
          className="btn-flat"
          title="Undo (Ctrl+Z)"
          style={{ ...toolBtnStyle, color: "var(--color-text-dim)" }}
          onClick={onUndo}
        >
          <i className="material-icons" style={{ fontSize: 18 }}>undo</i>
        </button>
        <button
          className="btn-flat"
          title="Clear all"
          style={{ ...toolBtnStyle, color: "var(--color-danger)" }}
          onClick={onClear}
        >
          <i className="material-icons" style={{ fontSize: 18 }}>delete_outline</i>
        </button>
        <button
          className="btn-flat"
          title="Export as PNG"
          style={{ ...toolBtnStyle, color: "var(--color-text-dim)" }}
          onClick={onExportPng}
        >
          <i className="material-icons" style={{ fontSize: 18 }}>download</i>
        </button>
      </div>

      <span style={dividerStyle} />

      {/* Distances toggle */}
      <div style={sectionStyle}>
        <button
          className="btn-flat"
          title={`${showDistances ? "Hide" : "Show"} distances on every line/arrow (D)`}
          style={{
            ...toolBtnStyle,
            background: showDistances ? "rgba(36,86,130,0.25)" : "transparent",
            color: showDistances ? "var(--color-light)" : "var(--color-text-dim)",
          }}
          onClick={onToggleShowDistances}
        >
          <i className="material-icons" style={{ fontSize: 18 }}>straighten</i>
          <KeyBadge label="D" />
        </button>
      </div>

      <span style={dividerStyle} />

      {/* Markers (drag onto map) */}
      <div style={sectionStyle}>
        <span style={{ fontSize: 11, color: "var(--color-text-dim)", marginRight: 2 }}>Markers:</span>
        <StampIcon type="stamp-rect" color="#2ecc71" label="Green rectangle" hotkey="Q" />
        <StampIcon type="stamp-rect" color="#3498db" label="Blue rectangle" hotkey="W" />
        <StampIcon type="stamp-triangle" color="#2ecc71" label="Green triangle" hotkey="E" />
        <StampIcon type="stamp-triangle" color="#3498db" label="Blue triangle" hotkey="R" />
      </div>

      {/* Right side — disconnect */}
      <div style={{ marginLeft: "auto" }}>
        <button
          className="btn-flat"
          title="Leave session"
          style={{ ...toolBtnStyle, color: "var(--color-danger)" }}
          onClick={onDisconnect}
        >
          <i className="material-icons" style={{ fontSize: 18 }}>exit_to_app</i>
        </button>
      </div>
    </div>
  );
}

/* ── Styles ── */

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  background: "var(--color-surface)",
  borderBottom: "var(--border-subtle)",
  flexWrap: "wrap",
};

const sectionStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
};

const dividerStyle: React.CSSProperties = {
  width: 1,
  height: 24,
  background: "rgba(219,218,216,0.12)",
  margin: "0 4px",
};

const toolBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  padding: 0,
  minWidth: "auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 4,
  cursor: "pointer",
  transition: "var(--transition)",
  position: "relative",
};

/* ── Small corner badge showing a tool's keyboard shortcut ── */
function KeyBadge({ label }: { label: string }) {
  return (
    <span
      style={{
        position: "absolute",
        bottom: -4,
        right: -4,
        fontSize: 8,
        lineHeight: 1,
        fontWeight: 700,
        fontFamily: "monospace",
        color: "var(--color-text-dim)",
        background: "rgba(0,0,0,0.65)",
        border: "1px solid rgba(219,218,216,0.25)",
        borderRadius: 3,
        padding: "1px 3px",
        pointerEvents: "none",
      }}
    >
      {label}
    </span>
  );
}


/* ── Draggable stamp icon ── */
function StampIcon({
  type,
  color,
  label,
  hotkey,
}: {
  type: string;
  color: string;
  label: string;
  hotkey: string;
}) {
  return (
    <div
      draggable
      title={`${label} (drag onto map, or press ${hotkey})`}
      onDragStart={(e) => {
        e.dataTransfer.setData("stamp-type", type);
        e.dataTransfer.setData("stamp-color", color);
        e.dataTransfer.effectAllowed = "copy";
      }}
      style={{
        width: 32,
        height: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "grab",
        borderRadius: 4,
        border: "1px dashed rgba(219,218,216,0.2)",
        background: "rgba(255,255,255,0.03)",
        position: "relative",
      }}
    >
      <KeyBadge label={hotkey} />
      {type === "stamp-rect" ? (
        <div
          style={{
            width: 18,
            height: 12,
            background: color,
            opacity: 0.6,
            border: `2px solid ${color}`,
            borderRadius: 2,
          }}
        />
      ) : (
        <svg width="18" height="16" viewBox="0 0 18 16">
          <polygon
            points="9,1 1,15 17,15"
            fill={color}
            fillOpacity="0.4"
            stroke={color}
            strokeWidth="2"
          />
        </svg>
      )}
    </div>
  );
}
