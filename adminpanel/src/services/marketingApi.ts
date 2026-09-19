/**
 * The marketing panel's API client.
 *
 * ── DELIBERATELY NOT REUSING `utils/api` ────────────────────────────────
 *
 * That helper stores the session under `token` and clears it on a 401. Both
 * are wrong here: a marketing session must not share or clobber an admin
 * session in the same browser, and an expired marketing token must land back on
 * `/marketing/login`, not the admin login. The keys below keep the two apart.
 *
 * ── WHAT CHANGED ────────────────────────────────────────────────────────
 *
 * Only the origin and the paths. The surface itself was one of the two
 * well-written corners of the legacy repository and carried over largely
 * intact — the read-only guarantee is still enforced by refusing any verb but
 * GET before a handler runs, and the account type is still re-read from the
 * database rather than trusted from a JWT claim.
 *
 * The origin is environment-driven now; it pointed at the retired monolith
 * host, and there is no proxy in front of these in development.
 */

import { API_BASE_URL } from '../utils/api';
import { ENDPOINTS } from './endpoints';

const BASE = API_BASE_URL;

/* Marketing session lives under its own keys. */
export const MKTG_TOKEN_KEY = 'mktgToken';
export const MKTG_USER_KEY = 'mktgUser';

export interface MarketingUserSession {
  id: number;
  username: string;
}

export const getMarketingToken = () => localStorage.getItem(MKTG_TOKEN_KEY);

export const getMarketingUser = (): MarketingUserSession | null => {
  try { return JSON.parse(localStorage.getItem(MKTG_USER_KEY) || 'null'); }
  catch { return null; }
};

export const clearMarketingSession = () => {
  localStorage.removeItem(MKTG_TOKEN_KEY);
  localStorage.removeItem(MKTG_USER_KEY);
};

async function mktgFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getMarketingToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as any),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (res.status === 401 || res.status === 403) {
    // 403 also ends the session: it means the account was locked or had its
    // marketing access revoked while signed in.
    clearMarketingSession();
    window.location.href = '/marketing/login';
    throw new Error('Unauthorized');
  }

  const envelope = await res.json().catch(() => ({} as any));
  if (!res.ok || envelope?.success === false) {
    throw new Error(envelope?.error?.message || `Error ${res.status}`);
  }
  // Unwrap the platform envelope; a non-enveloped body passes through.
  return (envelope?.success === true ? envelope.data : envelope) as T;
}

/* ─── auth ───────────────────────────────────────────────────── */

export interface MarketingLoginResult {
  token: string;
  user: MarketingUserSession;
}

/**
 * Marketing accounts authenticate through the shared executive endpoint. The
 * response carries `kind`, which we check here: an ordinary executive or admin
 * must not be able to establish a marketing session just by using this form.
 */
export async function marketingLogin(username: string, password: string): Promise<MarketingLoginResult> {
  const res = await fetch(`${BASE}${ENDPOINTS.auth.executiveLogin}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const envelope = await res.json().catch(() => ({} as any));
  if (!res.ok || envelope?.success === false) {
    throw new Error(envelope?.error?.message || 'Login failed');
  }

  // One envelope platform-wide: the payload is under `data`.
  const body = envelope?.data ?? envelope;

  const account = body?.actor ?? body?.user ?? {};
  if (account?.kind !== 'marketing') {
    throw new Error('This account cannot access the marketing panel.');
  }

  const session = { id: account.id ?? account.executiveId, username: account.username };
  const token = body.token ?? body.accessToken;

  localStorage.setItem(MKTG_TOKEN_KEY, token);
  localStorage.setItem(MKTG_USER_KEY, JSON.stringify(session));
  return { token, user: session };
}

/* ─── analytics ──────────────────────────────────────────────── */

export interface Range { from: string; to: string }

export interface SignupsResponse {
  total: number;
  byChannel: { online: number; agent: number };
  series: { date: string; online: number; agent: number }[];
  /** customers in this range whose signup date is a backfilled estimate */
  estimatedUsers: number;
  estimatedOn: string | null;
}

export interface ChannelDeposits {
  volume: number; count: number; average: number; depositors: number;
  cohortSize: number; converted: number; conversionRate: number;
}

export interface DepositsResponse {
  totals: { volume: number; count: number; average: number };
  byChannel: { online: ChannelDeposits; agent: ChannelDeposits };
  series: { date: string; online: number; agent: number; onlineCount: number; agentCount: number }[];
}

export interface RetentionResponse {
  series: { date: string; activeDepositors: number }[];
  byChannel: {
    online: { depositors: number; repeatDepositors: number; repeatRate: number };
    agent: { depositors: number; repeatDepositors: number; repeatRate: number };
  };
}

export interface TopAgentsResponse {
  agents: {
    agentId: number; agentName: string; agentCode: string; role: string;
    customers: number; depositVolume: number; depositCount: number;
  }[];
}

const qs = (r: Range) => `?from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}`;

export const fetchSignups   = (r: Range) => mktgFetch<SignupsResponse>(`${ENDPOINTS.marketing.signups}${qs(r)}`);
export const fetchDeposits  = (r: Range) => mktgFetch<DepositsResponse>(`${ENDPOINTS.marketing.deposits}${qs(r)}`);
export const fetchRetention = (r: Range) => mktgFetch<RetentionResponse>(`${ENDPOINTS.marketing.retention}${qs(r)}`);
export const fetchTopAgents = (r: Range) => mktgFetch<TopAgentsResponse>(`${ENDPOINTS.marketing.topAgents}${qs(r)}&limit=10`);
export const fetchMarketingMe = () => mktgFetch<{ user: MarketingUserSession }>(ENDPOINTS.marketing.me);

/* ─── customer directory ─────────────────────────────────────── */

export interface Customer {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  status: string;
  channel: 'online' | 'agent';
  createdAt: string | null;
  /** true → signup date is a backfilled estimate, not the real date */
  createdEstimated: boolean;
  lastLoginAt: string | null;
  lastIp: string | null;
  referralCode: string | null;
  referredBy: string | null;
  agent: { id: number; name: string; code: string; role: string } | null;
  depositCount: number;
  depositVolume: number;
  lastDepositAt: string | null;
}

export interface CustomersResponse {
  customers: Customer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CustomerQuery {
  channel?: 'all' | 'direct' | 'agent';
  depositors?: boolean;
  newOnly?: boolean;
  from?: string;
  to?: string;
  search?: string;
  sort?: 'recent' | 'deposits' | 'name';
  page?: number;
  limit?: number;
}

export const fetchCustomers = (q: CustomerQuery) => {
  const p = new URLSearchParams();
  if (q.channel && q.channel !== 'all') p.set('channel', q.channel);
  if (q.depositors) p.set('depositors', 'true');
  if (q.newOnly) p.set('newOnly', 'true');
  if (q.from) p.set('from', q.from);
  if (q.to) p.set('to', q.to);
  if (q.search) p.set('search', q.search);
  if (q.sort) p.set('sort', q.sort);
  p.set('page', String(q.page ?? 1));
  p.set('limit', String(q.limit ?? 25));
  return mktgFetch<CustomersResponse>(`${ENDPOINTS.marketing.customers}?${p.toString()}`);
};
