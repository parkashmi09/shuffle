/**
 * The HTTP client for the iBitPlay gateway.
 *
 * Every call in the panel should go through here, because four things about
 * the new platform are uniform and worth doing exactly once:
 *
 * 1. ONE ENVELOPE. Success is `{success: true, data, meta?}` and failure is
 *    `{success: false, error: {code, message, details?}}`. Call sites want the
 *    payload, so `apiFetch` returns `data` and throws on the other shape. A
 *    component that reads `res.data` itself is one that will eventually render
 *    an error object as a table.
 *
 * 2. ERRORS CARRY A STABLE CODE. `STAFF_INSUFFICIENT_AUTHORITY` does not
 *    change when somebody improves the wording. Branch on `ApiError.code`;
 *    show `message`.
 *
 * 3. LISTS CARRY `meta.pagination`. `apiFetchPage` returns both halves rather
 *    than making every screen guess where the total went.
 *
 * 4. STAFF PERMISSIONS ARE RE-READ FROM THE DATABASE ON EVERY REQUEST. A
 *    demoted account loses access immediately rather than when its token
 *    expires — so a 403 is a real answer about authority NOW, and caching it
 *    client-side would defeat the point.
 *
 * ── ON THE 401 HANDLER ──────────────────────────────────────────────────
 *
 * It used to `localStorage.clear()` and hard-redirect to `/login` from inside
 * the fetch. That threw away everything the operator had typed and gave no
 * chance to say why. A staff token has no refresh counterpart — an eight-hour
 * session simply ends — so the session is cleared and an event is dispatched;
 * the shell decides what to render.
 */

const env = (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>;

/** Trailing slashes break `${BASE}${path}` concatenation everywhere. */
const trimSlash = (url: string) => String(url || '').replace(/\/+$/, '');

/**
 * The gateway origin — the ONE public HTTP entry point.
 *
 * Defaults to the local gateway. In a deployed build set
 * `REACT_APP_API_BASE_URL` to the public gateway origin.
 */
export const API_BASE_URL = trimSlash(env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:4000');

/**
 * The admin socket server.
 *
 * SOCKETS DO NOT GO THROUGH THE GATEWAY — it is an HTTP reverse proxy with no
 * `upgrade` handling, so a websocket opened against :4000 never reaches a
 * service. admin-service attaches its own Socket.io server on :4002.
 */
export const ADMIN_SOCKET_URL = trimSlash(env.REACT_APP_ADMIN_SOCKET_URL || 'http://127.0.0.1:4002');

/** Fired when a staff session ends without the operator asking. */
export const SESSION_EXPIRED_EVENT = 'ibitplay:staff-session-expired';

/** Where the staff access token lives. One key, one reader. */
const TOKEN_KEY = 'token';

export const getStaffToken = () => localStorage.getItem(TOKEN_KEY);
export const setStaffToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);

/**
 * Does this string even look like a token the server issued?
 *
 * ── WHY A SHAPE CHECK AND NOT JUST `Boolean(token)` ─────────────────────
 *
 * The route guard used to test that *some* string sat under `token`. The login
 * page had offline fallbacks that wrote the literals `static-demo` and
 * `local-admin`, and both satisfied that test and rendered the whole operator
 * console. Those fallbacks are gone — but the guard was the half of the bug
 * that let any string at all through, so it is worth closing too.
 *
 * This is NOT authentication. The signature is verified by the server on every
 * request and nothing here is authorised on the strength of a local decode; a
 * forged token that happens to be shaped right still gets a 401 from the first
 * call. What this buys is that a junk value is treated as signed-out
 * immediately, instead of rendering a console whose every panel then fails.
 */
export function looksLikeStaffToken(token: string | null): token is string {
  if (!token) return false;

  // header.payload.signature, each base64url.
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) return false;

  try {
    const claims = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    // An expired token is worth catching here: the operator sees the sign-in
    // page rather than a console that 401s on every panel at once.
    if (typeof claims?.exp === 'number' && claims.exp * 1000 <= Date.now()) return false;
    return claims?.type === 'admin';
  } catch {
    return false;
  }
}

export const isSignedIn = () => looksLikeStaffToken(getStaffToken());

/** Clear the session without navigating. The shell decides what to render. */
export function clearStaffSession() {
  const keep = localStorage.getItem('theme');
  localStorage.clear();
  if (keep) localStorage.setItem('theme', keep);
}

function expireStaffSession(reason: string) {
  clearStaffSession();
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { reason } }));
}

/** A failed request, with the server's own error code attached. */
export class ApiError extends Error {
  code: string;

  status: number;

  details?: unknown;

  requestId?: string;

  constructor(
    message: string,
    opts: { code?: string; status?: number; details?: unknown; requestId?: string } = {}
  ) {
    super(message || 'Request failed');
    this.name = 'ApiError';
    this.code = opts.code ?? 'UNKNOWN_ERROR';
    this.status = opts.status ?? 0;
    this.details = opts.details;
    this.requestId = opts.requestId;
  }

  /** The operator is signed in but this action is above their authority. */
  get isForbidden() {
    return this.status === 403;
  }

  /** True when retrying the same request could plausibly succeed. */
  get isRetryable() {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Serialised as JSON unless it is FormData. */
  body?: any;
  /** Appended as a query string; `undefined`, `null` and `''` are dropped. */
  query?: Record<string, any>;
  /** `false` skips the Authorization header — only the login routes need this. */
  auth?: boolean;
}

/** Build `?a=1&b=2`, dropping anything the caller left unset. */
export function buildQuery(params?: Record<string, any>): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => search.append(key, String(v)));
    else search.append(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Substitute `:param` segments in a path template.
 *
 * `encodeURIComponent` on every value, so an id containing a slash cannot
 * escape its segment and address a different route.
 */
export function buildPath(template: string, params: Record<string, any> = {}): string {
  return template.replace(/:([A-Za-z0-9_]+)/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined || value === null) {
      throw new ApiError(`Missing path parameter "${name}" for ${template}`, {
        code: 'CLIENT_BAD_PATH',
      });
    }
    return encodeURIComponent(String(value));
  });
}

function headersFor(body: any, auth: boolean, extra?: HeadersInit): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json', ...(extra as any) };

  // FormData must set its own Content-Type — it carries the multipart boundary.
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth !== false) {
    const token = getStaffToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function serialise(body: any): BodyInit | undefined {
  if (body === undefined || body === null) return undefined;
  if (typeof FormData !== 'undefined' && body instanceof FormData) return body;
  if (typeof body === 'string') return body;
  return JSON.stringify(body);
}

async function readBody(res: Response): Promise<any> {
  if (res.status === 204) return null;
  const type = res.headers.get('content-type') || '';
  if (type.includes('application/json')) return res.json().catch(() => null);
  return res.text().catch(() => null);
}

function toApiError(res: Response, body: any): ApiError {
  const error = body && typeof body === 'object' ? body.error : null;
  return new ApiError(error?.message || `Request failed with status ${res.status}`, {
    code: error?.code || `HTTP_${res.status}`,
    status: res.status,
    details: error?.details,
    requestId: error?.details?.requestId,
  });
}

async function perform(path: string, options: RequestOptions = {}): Promise<{ res: Response; body: any }> {
  const { body, query, headers, auth = true, ...rest } = options;
  const url = `${API_BASE_URL}${path}${buildQuery(query)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: headersFor(body, auth, headers),
      body: serialise(body),
    });
  } catch (cause: any) {
    if (cause?.name === 'AbortError') throw cause;
    throw new ApiError('Could not reach the server', { code: 'NETWORK_ERROR', status: 0 });
  }

  // A staff token has no refresh counterpart — an eight-hour session simply
  // ends. There is nothing to retry with, so the session is cleared once.
  if (res.status === 401 && auth !== false) {
    expireStaffSession('unauthorized');
  }

  return { res, body: await readBody(res) };
}

/**
 * Perform one request and return the unwrapped `data`.
 *
 * @param path    A path starting `/api/v1/…`. Use `services/endpoints.ts`.
 * @param options Method, body, query, headers.
 */
export async function apiFetch<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const { res, body } = await perform(path, options);

  if (!res.ok) throw toApiError(res, body);

  // A non-JSON 200 (a CSV export, a redirect body) has no envelope to unwrap.
  if (body === null || typeof body !== 'object') return body as T;

  if (body.success === false) throw toApiError(res, body);
  if (!('success' in body)) return body as T;

  return body.data as T;
}

/**
 * Perform one request and return `data` AND `meta`.
 *
 * Use this wherever a table paginates — the totals live in
 * `meta.pagination`, and `apiFetch` discards them.
 */
export async function apiFetchPage<T = any>(
  path: string,
  options: RequestOptions = {}
): Promise<{ data: T[]; pagination: Pagination | null; meta: any }> {
  const { res, body } = await perform(path, options);

  if (!res.ok) throw toApiError(res, body);
  if (body?.success === false) throw toApiError(res, body);

  const data = (body?.data ?? body ?? []) as T[];
  return {
    data: Array.isArray(data) ? data : [],
    pagination: body?.meta?.pagination ?? null,
    meta: body?.meta ?? null,
  };
}

/**
 * Fetch a binary body — a generated PDF, a deposit screenshot, a CSV export.
 *
 * Never JSON-parses the body, but surfaces the JSON error message when the
 * request fails, because error bodies ARE JSON.
 */
export async function apiDownload(path: string, options: RequestOptions = {}): Promise<Blob> {
  const { body, query, headers, auth = true, ...rest } = options;
  const url = `${API_BASE_URL}${path}${buildQuery(query)}`;

  const res = await fetch(url, {
    ...rest,
    headers: headersFor(body, auth, headers),
    body: serialise(body),
  });

  if (res.status === 401 && auth !== false) expireStaffSession('unauthorized');

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* not JSON — keep the raw text as the message */
    }
    throw new ApiError(parsed?.error?.message || text || `Request failed with status ${res.status}`, {
      code: parsed?.error?.code || `HTTP_${res.status}`,
      status: res.status,
    });
  }

  return res.blob();
}

/** Verb helpers, for call sites that read better without an options object. */
export const api = {
  get: <T = any>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T = any>(path: string, body?: any, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),
  put: <T = any>(path: string, body?: any, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PUT', body }),
  patch: <T = any>(path: string, body?: any, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T = any>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
  page: apiFetchPage,
  blob: apiDownload,
};

export default api;
