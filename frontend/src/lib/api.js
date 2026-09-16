/**
 * The one place this app talks to the gateway.
 *
 * The backend answers in a single envelope for every route
 * (`backend/docs/API-ROUTES.md` §4):
 *
 *   success  { success: true,  data, meta? }
 *   failure  { success: false, error: { code, message, details } }
 *
 * `data` is never absent on a success, so callers get `data` and nothing else.
 * On a failure they get an `ApiError` carrying the *code* — §5 is explicit that
 * `message` is written for a human and may be reworded, so nothing here or
 * upstream may branch on it.
 */

/** Same-origin by default: `vite.config.js` proxies `/api` to the gateway, so dev never meets CORS. */
const BASE = import.meta.env.VITE_API_BASE || "/api/v1";

const ACCESS_KEY = "shuffle.accessToken";
const REFRESH_KEY = "shuffle.refreshToken";

/** A failure the backend described. `code` is the stable identifier; `fields` is set on a 422. */
export class ApiError extends Error {
  constructor({ code, message, status, details }) {
    super(message || code || "Request failed");
    this.name = "ApiError";
    this.code = code || "UNKNOWN";
    this.status = status;
    this.details = details || {};
    this.fields = details?.fields || [];
  }

  /** Validation failures name the offending fields; forms want them keyed by name. */
  fieldErrors() {
    return Object.fromEntries(this.fields.map((f) => [f.field, f.message]));
  }
}

/** Thrown when the network never reached the gateway — distinct from a refusal it sent back. */
export class NetworkError extends Error {
  constructor(cause) {
    super("Could not reach the server");
    this.name = "NetworkError";
    this.code = "NETWORK_ERROR";
    this.cause = cause;
  }
}

// ── Token storage ────────────────────────────────────────────────────────
// localStorage throws in a locked-down browser rather than returning null, so
// every access is guarded and an unavailable store simply means "signed out".

const read = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

const write = (k, v) => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* private mode — the session lives for this page only */
  }
};

export const tokens = {
  access: () => read(ACCESS_KEY),
  refresh: () => read(REFRESH_KEY),
  set({ accessToken, refreshToken }) {
    write(ACCESS_KEY, accessToken);
    if (refreshToken !== undefined) write(REFRESH_KEY, refreshToken);
  },
  clear() {
    write(ACCESS_KEY, null);
    write(REFRESH_KEY, null);
  },
};

// ── Refresh ──────────────────────────────────────────────────────────────

/**
 * One in-flight refresh, shared.
 *
 * A first paint fires several authenticated reads at once. If the access token
 * has expired they all 401 together, and one refresh per request would rotate
 * the refresh token N times — the backend revokes the whole chain when a
 * rotated token is replayed, so the naive version signs the user out. They all
 * await this promise instead.
 */
let refreshing = null;

/** Called when refresh fails, so the session layer can drop the user. */
let onAuthLost = () => {};
export const setAuthLostHandler = (fn) => {
  onAuthLost = fn;
};

async function refreshAccessToken() {
  const refreshToken = tokens.refresh();
  if (!refreshToken) return null;

  refreshing =
    refreshing ||
    (async () => {
      try {
        const data = await request("/user/auth/refresh", {
          method: "POST",
          body: { refreshToken },
          auth: false,
          retry: false,
        });
        tokens.set(data);
        return data.accessToken;
      } catch {
        // Expired, revoked, or replayed. Either way there is no session left.
        tokens.clear();
        onAuthLost();
        return null;
      } finally {
        refreshing = null;
      }
    })();

  return refreshing;
}

// ── The request ──────────────────────────────────────────────────────────

/**
 * @param {string} path      Route below the API base, e.g. `/user/wallet/balances`.
 * @param {object} [opts]
 * @param {string} [opts.method]  Defaults to GET.
 * @param {any}    [opts.body]    Serialised as JSON unless it is FormData.
 * @param {object} [opts.query]   Appended as a query string; null/undefined dropped.
 * @param {boolean}[opts.auth]    Send the bearer token (default true when one is held).
 * @param {boolean}[opts.retry]   Refresh once and replay on a 401 (default true).
 * @param {boolean}[opts.withMeta] Resolve `{data, meta}` instead of `data` alone.
 * @param {AbortSignal} [opts.signal]
 */
export async function request(path, { method = "GET", body, query, auth = true, retry = true, withMeta = false, signal } = {}) {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  }

  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const headers = {};
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";

  const token = auth ? tokens.access() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch (cause) {
    if (cause?.name === "AbortError") throw cause;
    throw new NetworkError(cause);
  }

  // A 401 on an authenticated call is the expected end of an access token's
  // life. Refresh once and replay; a second 401 is a real refusal.
  if (res.status === 401 && retry && auth && tokens.refresh()) {
    const fresh = await refreshAccessToken();
    if (fresh) return request(path, { method, body, query, auth, retry: false, withMeta, signal });
  }

  // 204 carries zero bytes — `JSON.parse('')` throws, so branch on the status
  // before touching the body (API-ROUTES §4).
  if (res.status === 204) return withMeta ? { data: null, meta: null } : null;

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    /* an empty or non-JSON body; handled by the checks below */
  }

  if (!res.ok || payload?.success === false) {
    const error = payload?.error || {};
    throw new ApiError({
      code: error.code,
      message: error.message,
      status: res.status,
      details: error.details,
    });
  }

  // `meta` is present only when the handler passed one, and a paginated list is
  // where it matters — `meta.pagination.total` is the only source for a "6,488
  // games" count. Callers that want it ask; everyone else gets `data` alone.
  return withMeta ? { data: payload?.data ?? null, meta: payload?.meta ?? null } : (payload?.data ?? null);
}

export const get = (path, opts) => request(path, { ...opts, method: "GET" });
export const post = (path, body, opts) => request(path, { ...opts, method: "POST", body });
export const put = (path, body, opts) => request(path, { ...opts, method: "PUT", body });
export const patch = (path, body, opts) => request(path, { ...opts, method: "PATCH", body });
export const del = (path, opts) => request(path, { ...opts, method: "DELETE" });
