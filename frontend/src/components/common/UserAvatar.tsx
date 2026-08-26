/* ── Small circular avatar — image if available, generic icon otherwise ── */

import type { CSSProperties } from "react";

interface Props {
  avatarUrl?: string | null;
  size?: number;
  /** Fallback icon color / ring tint. */
  color?: string;
  style?: CSSProperties;
}

export default function UserAvatar({ avatarUrl, size = 16, color = "#4a9cd6", style }: Props) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          border: `1px solid ${color}`,
          background: "var(--color-surface)",
          flexShrink: 0,
          ...style,
        }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.visibility = "hidden";
        }}
      />
    );
  }
  return (
    <i
      className="material-icons"
      style={{
        fontSize: size,
        color,
        background: "var(--color-surface)",
        borderRadius: "50%",
        flexShrink: 0,
        ...style,
      }}
    >
      account_circle
    </i>
  );
}
