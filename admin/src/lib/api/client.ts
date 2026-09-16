import type { Envelope, Paged, Query } from './types'

/**
 * The one HTTP seam. Every call goes through the same-origin proxy at
 * `/api/gw/…`, which adds the staff token. Paths are GATEWAY paths — pass
 * `admin/staff`, not `/api/v1/admin/staff`; `API_V1` is prefixed here.
 */
export const API_V1 = '/api/gw/api/v1'

export class ApiError extends Error {
  code: string
  status: number
  details?: Record<string, unknown>

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  /** `STAFF_AUTH_TWO_FACTOR_REQUIRED` → is('TWO_FACTOR_REQUIRED') */
  is(suffix: string) {
    return this.code === suffix || this.code.endsWith('_' + suffix)
  }
}

export function buildQuery(query?: Query): string {
  if (!query) return ''
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const s = params.toString()

  return s ? `?${s}` : ''
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: Query
  body?: unknown
  /** Send a FormData body untouched (uploads). */
  form?: FormData
  signal?: AbortSignal
  /** Where the path is already absolute (e.g. `/api/auth/login`). */
  raw?: boolean
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const url = (opts.raw ? path : `${API_V1}/${path.replace(/^\/+/, '')}`) + buildQuery(opts.query)
  const headers: Record<string, string> = { accept: 'application/json' }
  let body: BodyInit | undefined

  if (opts.form) body = opts.form
  else if (opts.body !== undefined) {
    headers['content-type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }

  const res = await fetch(url, { method: opts.method ?? 'GET', headers, body, signal: opts.signal, cache: 'no-store' })
  const text = await res.text()
  let json: Envelope<T> | null = null

  try {
    json = text ? (JSON.parse(text) as Envelope<T>) : null
  } catch {
    json = null
  }

  if (!json) {
    if (res.ok) return { data: undefined as T }
    throw new ApiError(res.status, 'BAD_RESPONSE', text.slice(0, 200) || res.statusText)
  }
  if (!json.success) {
    if (res.status === 401 && typeof window !== 'undefined' && !location.pathname.startsWith('/login') && json.error.code === 'UNAUTHENTICATED') {
      location.assign(`/login?next=${encodeURIComponent(location.pathname)}`)
    }
    throw new ApiError(res.status, json.error.code, json.error.message, json.error.details)
  }

  return { data: json.data, meta: json.meta }
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>(path, { query, signal }).then(r => r.data),
  post: <T>(path: string, body?: unknown, query?: Query) => request<T>(path, { method: 'POST', body: body ?? {}, query }).then(r => r.data),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: body ?? {} }).then(r => r.data),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body ?? {} }).then(r => r.data),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }).then(r => r.data),
  upload: <T>(path: string, form: FormData, method: 'POST' | 'PUT' | 'PATCH' = 'POST') => request<T>(path, { method, form }).then(r => r.data),
  /** A list route: rows plus the pagination block from `meta`. */
  /**
   * A list route: rows plus the pagination block from `meta`.
   * The platform pages by `limit`/`offset`; callers think in `page`, so `page`
   * is translated here and never sent (validators are `.strict()`).
   */
  paged: async <T>(path: string, query?: Query, signal?: AbortSignal): Promise<Paged<T>> => {
    const { page: rawPage, ...rest } = query ?? {}
    const limit = Number(rest.limit ?? 20)
    const page = Math.max(Number(rawPage ?? 1), 1)
    const sent: Query = { ...rest, limit, offset: (page - 1) * limit }
    const { data, meta } = await request<T[]>(path, { query: sent, signal })
    const pagination = (meta?.pagination as Paged<T>['pagination']) ?? {
      page,
      limit,
      total: Array.isArray(data) ? data.length : 0,
      totalPages: 1,
      hasNext: false,
      hasPrev: false
    }

    return { rows: Array.isArray(data) ? data : [], pagination }
  },
  /** Binary routes (CSV, PDF, images) — returns the Blob. */
  blob: async (path: string, query?: Query) => {
    const res = await fetch(`${API_V1}/${path.replace(/^\/+/, '')}${buildQuery(query)}`, { cache: 'no-store' })

    if (!res.ok) throw new ApiError(res.status, 'DOWNLOAD_FAILED', `${res.status} ${res.statusText}`)

    return res.blob()
  },
  /** The URL a browser can load directly (images in <img>). */
  url: (path: string, query?: Query) => `${API_V1}/${path.replace(/^\/+/, '')}${buildQuery(query)}`
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const details = error.details?.issues ?? error.details?.errors

    if (Array.isArray(details) && details.length) {
      return details.map((d: { path?: string[] | string; message?: string }) => `${Array.isArray(d.path) ? d.path.join('.') : d.path ?? ''}: ${d.message ?? ''}`).join('; ')
    }

    return error.message
  }
  if (error instanceof Error) return error.message

  return String(error)
}
