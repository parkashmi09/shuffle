import { useApi } from "./useResource";
import { auth } from "./endpoints";

/**
 * Sign in with Google — user-service `auth` (`/user/auth/google/*`):
 *
 *   1. `startGoogleSignIn` keeps a one-time nonce for this tab and sends the browser to
 *      `/user/auth/google/start?nonce=…`, which sets a signed state cookie and goes to Google.
 *   2. Google returns to the backend, which redirects to `/login/google?code=…` (or `?error=…`)
 *      on this site — never tokens in a URL.
 *   3. `AppShell` trades `{ code, nonce }` at `/google/exchange` for the session.
 *
 * The nonce ties the code to the tab that started it: a code lifted from the address bar is
 * useless anywhere else.
 */

const NONCE_KEY = "shuffle.googleNonce";
const API_BASE = import.meta.env.VITE_API_BASE || "/api/v1";

/** 32 random bytes as base64url — the backend wants 22–128 of `[A-Za-z0-9_-]`. */
function newNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A full-page navigation, not a fetch: `/google/start` answers a 302 to Google. */
export function startGoogleSignIn() {
  const nonce = newNonce();
  try {
    sessionStorage.setItem(NONCE_KEY, nonce);
  } catch {
    /* private mode: the exchange will fail and say so */
  }
  window.location.assign(`${API_BASE}/user/auth/google/start?nonce=${encodeURIComponent(nonce)}`);
}

/** The nonce this tab started with, read once. */
export function takeGoogleNonce() {
  try {
    const nonce = sessionStorage.getItem(NONCE_KEY);
    sessionStorage.removeItem(NONCE_KEY);
    return nonce;
  } catch {
    return null;
  }
}

/** Backend error codes on the return trip, as a player reads them. */
export const GOOGLE_ERRORS = {
  AUTH_GOOGLE_NOT_CONFIGURED: "Sign in with Google is not available yet.",
  AUTH_GOOGLE_DISABLED: "Sign in with Google is switched off on this site.",
  AUTH_GOOGLE_EMAIL_IN_USE: "An account with this email already exists. Sign in with your password.",
  AUTH_GOOGLE_TWO_FACTOR_ON: "This account uses two-factor authentication. Sign in with your password.",
};

/** Whether to draw the Google button: the owner's `google_signin` switch (`/google/status` `enabled`). */
export function useGoogleEnabled() {
  const { data } = useApi("auth:google-status", () => auth.googleStatus().catch(() => null));
  return Boolean(data?.enabled);
}
