/* ── Session creation / join modal ────────────────────────────────── */

import { useState } from "react";

interface Props {
  onCreateSession: () => void;
  onJoinSession: (code: string) => void;
  status: "idle" | "connecting" | "connected" | "error";
  errorMessage: string | null;
}

export default function MapSessionModal({
  onCreateSession,
  onJoinSession,
  status,
  errorMessage,
}: Props) {
  const [mode, setMode] = useState<"choose" | "join">("choose");
  const [code, setCode] = useState("");

  const isLoading = status === "connecting";

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <i
            className="material-icons"
            style={{ fontSize: 40, color: "var(--color-primary)", marginBottom: 8 }}
          >
            map
          </i>
          <h5
            style={{
              margin: 0,
              color: "var(--color-light)",
              fontWeight: 500,
              fontSize: 18,
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            Collaborative Map
          </h5>
          <p style={{ margin: "8px 0 0", color: "var(--color-text-dim)", fontSize: 13 }}>
            Draw and plan operations together in real time
          </p>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div
            style={{
              background: "rgba(179,58,58,0.12)",
              border: "1px solid rgba(179,58,58,0.3)",
              borderRadius: 4,
              padding: "8px 12px",
              marginBottom: 16,
              color: "var(--color-danger)",
              fontSize: 13,
            }}
          >
            {errorMessage}
          </div>
        )}

        {mode === "choose" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              className="btn"
              style={{
                background: "var(--color-primary)",
                width: "100%",
                height: 44,
                borderRadius: 4,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                fontSize: 13,
              }}
              disabled={isLoading}
              onClick={onCreateSession}
            >
              {isLoading ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span className="map-spinner" /> Creating...
                </span>
              ) : (
                <>
                  <i className="material-icons left" style={{ fontSize: 18, marginRight: 8 }}>
                    add_circle_outline
                  </i>
                  Create New Session
                </>
              )}
            </button>

            <button
              className="btn"
              style={{
                background: "transparent",
                border: "1px solid var(--color-secondary)",
                color: "var(--color-secondary)",
                width: "100%",
                height: 44,
                borderRadius: 4,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                fontSize: 13,
              }}
              disabled={isLoading}
              onClick={() => setMode("join")}
            >
              <i className="material-icons left" style={{ fontSize: 18, marginRight: 8 }}>
                group_add
              </i>
              Join With Code
            </button>
          </div>
        ) : (
          <div>
            <label
              style={{
                display: "block",
                color: "var(--color-text-dim)",
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: 6,
              }}
            >
              Session Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="E.g. A3BX7K"
              maxLength={6}
              autoFocus
              style={{
                width: "100%",
                background: "var(--color-surface-alt)",
                border: "var(--border-input)",
                borderRadius: 4,
                color: "var(--color-text)",
                padding: "10px 12px",
                fontSize: 18,
                letterSpacing: "4px",
                textAlign: "center",
                fontFamily: "monospace",
                outline: "none",
                boxSizing: "border-box",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && code.length >= 4) {
                  onJoinSession(code);
                }
              }}
            />

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                className="btn-flat"
                style={{
                  color: "var(--color-text-dim)",
                  flex: 1,
                  height: 40,
                  borderRadius: 4,
                }}
                onClick={() => {
                  setMode("choose");
                  setCode("");
                }}
                disabled={isLoading}
              >
                Back
              </button>
              <button
                className="btn"
                style={{
                  background: "var(--color-primary)",
                  flex: 2,
                  height: 40,
                  borderRadius: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                  fontSize: 13,
                }}
                disabled={code.length < 4 || isLoading}
                onClick={() => onJoinSession(code)}
              >
                {isLoading ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <span className="map-spinner" /> Joining...
                  </span>
                ) : (
                  "Join Session"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Styles ── */

const overlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(10, 10, 10, 0.80)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100,
};

const cardStyle: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "var(--border-subtle)",
  borderRadius: 4,
  padding: 32,
  width: 380,
  maxWidth: "90vw",
};
