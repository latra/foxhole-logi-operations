/* ── Top navigation bar ───────────────────────────────────────────── */

import { NavLink } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import wardenLogo from "../../assets/wardenlogo.png";

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav>
      <div
        className="nav-wrapper"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          height: 44,
        }}
      >
        {/* Left — brand */}
        <NavLink to="/" className="brand-logo" style={{ position: "relative" }}>
          <img src={wardenLogo} alt="Warden" />
          <span>Foxhole Logi Ops</span>
        </NavLink>

        {/* Center — nav links */}
        <ul
          style={{
            display: "flex",
            gap: 24,
            listStyle: "none",
            margin: 0,
            padding: 0,
          }}
        >
          <li>
            <NavLink
              to="/operations"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Operations
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/map"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Map
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/logistics"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Logistics
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/stockpiles"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Stockpiles
            </NavLink>
          </li>
        </ul>

        {/* Right — external links + user */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a
            href="https://foxholestats.com/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.8px" }}
          >
            War Status
          </a>
          <a
            href="https://foxholelogi.com/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.8px" }}
          >
            Calculator
          </a>

          <span
            style={{
              width: 1,
              height: 24,
              background: "rgba(219,218,216,0.12)",
            }}
          />

          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {user.avatar_url && (
                <img
                  src={user.avatar_url}
                  alt=""
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                  }}
                />
              )}
              <span style={{ fontSize: 13, color: "var(--color-text-dim)" }}>
                {user.display_name}
              </span>
            </div>
          )}

          <button
            className="btn-flat"
            style={{
              padding: "0 8px",
              minWidth: "auto",
              color: "var(--color-text-dim)",
              lineHeight: "44px",
            }}
            title="Logout"
            onClick={logout}
          >
            <i className="material-icons" style={{ fontSize: 20 }}>
              power_settings_new
            </i>
          </button>
        </div>
      </div>
    </nav>
  );
}
