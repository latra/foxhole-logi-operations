/* ── Login Page — Discord OAuth ───────────────────────────────────── */

import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useAuth } from "../hooks/useAuth";
import { getLoginUrl } from "../api/auth";
import wardenLogo from "../assets/wardenlogo.png";

/** Inline Discord mark SVG for the login button. */
const DiscordIcon = () => (
  <svg
    width="20"
    height="15"
    viewBox="0 0 71 55"
    fill="none"
    style={{ marginRight: 8, verticalAlign: "middle" }}
  >
    <path
      d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 41 41 0 00-1.8 3.7 54 54 0 00-16.2 0A39 39 0 0025.3.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.4 4.9a.2.2 0 00-.1.1C1.5 18.7-.9 32.2.3 45.5v.1a58.7 58.7 0 0017.7 9a.2.2 0 00.3-.1 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.6 38.6 0 01-5.5-2.6.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 41.9 41.9 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .4 36.3 36.3 0 01-5.5 2.6.2.2 0 00-.1.3 47 47 0 003.6 5.9.2.2 0 00.2.1 58.5 58.5 0 0017.7-9v-.1c1.4-15.1-2.4-28.2-10-39.8a.2.2 0 00-.1-.1zM23.7 37.3c-3.4 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.4 3.1 6.3 7-2.8 7-6.3 7zm23.2 0c-3.4 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.4 3.1 6.3 7-2.8 7-6.3 7z"
      fill="white"
    />
  </svg>
);

export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const setJwt = useAuthStore((s) => s.setJwt);
  const hydrate = useAuthStore((s) => s.hydrate);

  /* Capture token from redirect callback */
  useEffect(() => {
    const token = params.get("token");
    if (token) {
      setJwt(token);
      hydrate().then(() => navigate("/", { replace: true }));
    }
  }, [params, setJwt, hydrate, navigate]);

  /* Already logged in — go home */
  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated, navigate]);

  const handleLogin = () => {
    window.location.href = getLoginUrl();
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--color-bg)",
        padding: 24,
      }}
    >
      <img
        src={wardenLogo}
        alt="Warden emblem"
        style={{ height: 120, opacity: 0.9, marginBottom: 16 }}
      />

      <h1
        style={{
          fontSize: 18,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "var(--color-light)",
          margin: "0 0 4px",
          fontWeight: 500,
        }}
      >
        Foxhole Logi Ops
      </h1>

      <p
        style={{
          fontSize: 13,
          color: "var(--color-text-dim)",
          margin: "0 0 24px",
        }}
      >
        Logistics Operations Manager
      </p>

      <button className="btn btn-discord" onClick={handleLogin}>
        <DiscordIcon />
        Login with Discord
      </button>

      <p
        style={{
          position: "absolute",
          bottom: 24,
          fontSize: 11,
          color: "var(--color-text-dim)",
        }}
      >
        Warden-faction logistics coordination tool
      </p>
    </div>
  );
}
