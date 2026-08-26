/* ── Signup lists: Attending + Arriving Late ──────────────────────── */

import type { OperationSignup } from "../../types/models";

interface Props {
  signups: OperationSignup[];
}

export default function SignupList({ signups }: Props) {
  const attending = signups.filter((s) => s.status === "ATTENDING");
  const arrivingLate = signups.filter((s) => s.status === "ARRIVING_LATE");

  if (attending.length === 0 && arrivingLate.length === 0) {
    return (
      <p style={{ color: "var(--color-text-dim)", fontSize: 13 }}>
        No one has signed up yet.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Attending */}
      <SignupCategory
        icon="check_circle"
        label="Attending"
        color="var(--color-success, #3a7d44)"
        signups={attending}
      />

      {/* Arriving Late */}
      <SignupCategory
        icon="schedule"
        label="Arriving Late"
        color="var(--color-warning, #c49b2a)"
        signups={arrivingLate}
      />
    </div>
  );
}

function SignupCategory({
  icon,
  label,
  color,
  signups,
}: {
  icon: string;
  label: string;
  color: string;
  signups: OperationSignup[];
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 8,
        }}
      >
        <i className="material-icons" style={{ fontSize: 16, color }}>
          {icon}
        </i>
        <span
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            color,
            fontWeight: 500,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 11,
            background: `${color}22`,
            color,
            padding: "1px 7px",
            borderRadius: 3,
          }}
        >
          {signups.length}
        </span>
      </div>

      {signups.length === 0 ? (
        <p
          style={{
            color: "var(--color-text-dim)",
            fontSize: 12,
            marginLeft: 22,
          }}
        >
          None
        </p>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            marginLeft: 22,
          }}
        >
          {signups.map((s) => (
            <div
              key={s.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 0",
              }}
            >
              {/* Avatar */}
              {s.user?.avatar_url ? (
                <img
                  src={s.user.avatar_url}
                  alt=""
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "rgba(91,128,160,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <i
                    className="material-icons"
                    style={{
                      fontSize: 14,
                      color: "var(--color-text-dim)",
                    }}
                  >
                    person
                  </i>
                </div>
              )}
              <span style={{ fontSize: 13, color: "var(--color-light)" }}>
                {s.user?.display_name ?? s.user_id.slice(0, 8) + "…"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
