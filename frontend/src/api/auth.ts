/* ── Auth API ─────────────────────────────────────────────────────── */

import client, { API_BASE_URL } from "./client";
import type { User } from "../types/models";

/** Full URL the browser should navigate to for Discord login */
export function getLoginUrl(): string {
  return `${API_BASE_URL}/auth/discord/login`;
}

/** Fetch the currently authenticated user */
export async function getMe(): Promise<User> {
  const { data } = await client.get<User>("/auth/me");
  return data;
}
