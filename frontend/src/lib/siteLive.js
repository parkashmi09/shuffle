import { useSyncExternalStore } from "react";
import { io } from "socket.io-client";
import { SOCKET_BASE } from "../exchange/services/realtime";

/**
 * Owner and site-admin saves, live, plus what the signed-in player may use.
 *
 * ── PUSHES ───────────────────────────────────────────────────────────────
 *
 * user-service pushes to every player socket, signed in or not (backend
 * preferences/routes/internal.routes.js), as binary JSON frames:
 *
 *   featuresUpdated   [rows]       ANY owner save — plan, theme AND branding (an owner save sends
 *                                   no contentUpdated), so it re-reads branding too
 *   siteConfigUpdated {flags}      a site-admin flag or owner language change; re-read the public
 *                                   route rather than trusting the pushed row
 *   contentUpdated    {scopes}     an admin save: 'admin:branding', 'admin:site-content', …
 *
 * Each part has a version; `useSiteVersion(part)` goes into a `useApi` key, so a bump re-reads
 * it, and `onBump` lets a loader drop its once-per-page cache first.
 *
 * ── CAPABILITIES ─────────────────────────────────────────────────────────
 *
 * `/user/auth/me` → `capabilities` (backend packages/auth/src/agentPlayers.js): false for an
 * agent's player, whose promotions, vault, swap and deposit the backend refuses. Kept in
 * localStorage so a reload is gated before `/auth/me` answers.
 */

const versions = { features: 0, flags: 0, branding: 0, content: 0, caps: 0 };
const listeners = new Set();
const resets = { features: [], flags: [], branding: [], content: [] };

export function bump(...parts) {
  for (const part of parts) {
    resets[part]?.forEach((fn) => fn());
    versions[part] += 1;
  }
  listeners.forEach((fn) => fn());
}

/** A loader's cache reset, run before its part's version moves. */
export const onBump = (part, fn) => resets[part].push(fn);

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const useSiteVersion = (part) => useSyncExternalStore(subscribe, () => versions[part]);

const decode = (frame) => {
  try {
    if (frame instanceof ArrayBuffer || ArrayBuffer.isView(frame)) return JSON.parse(new TextDecoder().decode(frame));
    return typeof frame === "string" ? JSON.parse(frame) : frame;
  } catch {
    return null;
  }
};

let socket = null;
/** Called once from main.jsx. A socket that cannot open only loses the live part. */
export function startSiteLive() {
  if (socket || typeof window === "undefined") return;
  try {
    socket = io(SOCKET_BASE || undefined, { path: "/ws/user/socket.io", transports: ["websocket"], reconnection: true });
  } catch {
    return;
  }
  socket.on("featuresUpdated", () => bump("features", "branding"));
  socket.on("siteConfigUpdated", () => bump("flags"));
  socket.on("contentUpdated", (frame) => {
    const scopes = decode(frame)?.scopes;
    if (!Array.isArray(scopes)) return;
    if (scopes.includes("admin:branding")) bump("branding");
    if (scopes.includes("admin:site-content")) bump("content");
  });
}

/* ── capabilities ─────────────────────────────────────────────────────── */

const CAPS_KEY = "shuffle.playerCapabilities";
// Cleared on sign-out (session.jsx), so what is stored is the current player's.
let caps = (() => {
  try {
    return JSON.parse(localStorage.getItem(CAPS_KEY) ?? "null");
  } catch {
    return null;
  }
})();

/** The signed-in player's capabilities (null when signed out); re-renders every gate. */
export function setPlayerCapabilities(next) {
  const value = next && typeof next === "object" ? next : null;
  if (JSON.stringify(value) === JSON.stringify(caps)) return;
  caps = value;
  try {
    if (value) localStorage.setItem(CAPS_KEY, JSON.stringify(value));
    else localStorage.removeItem(CAPS_KEY);
  } catch {
    /* no storage: the next reload waits for /auth/me */
  }
  bump("caps");
}

/** `false` only when the player's capability says so; signed out / unknown is on. */
export const capOk = (name) => caps?.[name] !== false;
