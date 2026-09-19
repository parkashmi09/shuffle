/**
 * Access Management — executives, marketing users and the audit trail.
 *
 * ── THIS WHOLE SCREEN WAS TALKING TO EVENTS THAT DO NOT EXIST ───────────
 *
 * It drove everything through `socketService`: `getExecutiveList`,
 * `getExecutiveActivity`, `getMyPermissions`, `updateExecutivePermissions`,
 * `lockExecutive`, `resetExecutivePassword`, `createExecutive`. None of the
 * seven is registered by any service, and Socket.io does not error on an event
 * nobody listens for — the emit succeeds and the reply never arrives, so the
 * screen sat on a spinner and the mutations silently did nothing.
 *
 * All of it is HTTP, under `/api/v1/admin/access/*`.
 *
 * ── WHAT CHANGED IN THE CONTRACT ────────────────────────────────────────
 *
 * 1. NO TRANSACTION PASSWORD ON THESE. The old client sent one with every
 *    executive mutation. Access management is permissioned (`roles:manage`),
 *    not transaction-password-gated — that second factor guards MONEY, and
 *    asking for it here trained operators to type it into a form that did not
 *    need it.
 *
 * 2. PERMISSIONS ARE A FLAT LIST of known strings, not the `{groups, pages,
 *    authority}` blob legacy accepted. That blob was validated by checking the
 *    three keys were objects and never by looking inside them — so a grant
 *    could exceed its creator's own authority, be stored oversized, and take
 *    effect later when the parent was promoted. The list is checked against
 *    `ALL_PERMISSIONS` and then INTERSECTED with the creator's own authority.
 *
 * 3. LOCK/UNLOCK IS A STATUS ENUM. Legacy took `{status}` for executives and
 *    `{lock: true}` for marketing users — the same operation with two body
 *    shapes, which is why the two handlers had drifted apart.
 *
 * 4. A SUB-LOGIN PASSWORD IS 12 CHARACTERS. Legacy required six, for an
 *    account that carries staff authority.
 */

import { api, apiFetchPage, buildPath } from '../utils/api';
import type { Pagination } from '../utils/api';
import { ENDPOINTS } from './endpoints';
import type { StaffPermissions } from '../constants/permissions';
import type { Executive, ExecutiveActivity } from './socketService';

export type ExecutiveStatus = 'active' | 'inactive' | 'locked';

export interface Paged<T> {
  rows: T[];
  pagination: Pagination | null;
}

export interface ListParams {
  limit?: number;
  offset?: number;
  status?: ExecutiveStatus;
  search?: string;
}

/** The caller's own effective permissions, re-read from the current role. */
export const fetchMyPermissions = () =>
  api.get<{ staffId: number; executiveId: number | null; roleId: number; level: number; permissions: string[] }>(
    ENDPOINTS.access.myPermissions
  );

/* ── executives ──────────────────────────────────────────────────────────*/

export async function listExecutives(params: ListParams = {}): Promise<Paged<Executive>> {
  const { data, pagination } = await apiFetchPage<Executive>(ENDPOINTS.access.executives, {
    query: params,
  });
  return { rows: data, pagination };
}

/**
 * Create a sub-login.
 *
 * `permissions` is intersected with the creator's own authority server-side, so
 * granting more than you hold yields less than you asked for rather than an
 * escalation.
 */
export const createExecutive = (input: {
  username: string;
  password: string;
  permissions: string[];
}) => api.post<Executive>(ENDPOINTS.access.executives, input);

/** Replace an executive's grant. Same intersection rule as creation. */
export const updateExecutivePermissions = (executiveId: number, permissions: string[]) =>
  api.patch<Executive>(buildPath(ENDPOINTS.access.updateExecutive, { executiveId }), { permissions });

/**
 * Suspend or restore.
 *
 * @param status `'active' | 'inactive' | 'locked'` — an enum, not a boolean.
 */
export const setExecutiveStatus = (executiveId: number, status: ExecutiveStatus) =>
  api.patch<Executive>(buildPath(ENDPOINTS.access.executiveStatus, { executiveId }), { status });

/** Set a new password. Minimum twelve characters, enforced server-side. */
export const resetExecutivePassword = (executiveId: number, password: string) =>
  api.patch<{ id: number }>(buildPath(ENDPOINTS.access.executivePassword, { executiveId }), { password });

export async function fetchExecutiveActivity(
  executiveId: number,
  params: { limit?: number; offset?: number } = {}
): Promise<Paged<ExecutiveActivity>> {
  const { data, pagination } = await apiFetchPage<ExecutiveActivity>(
    buildPath(ENDPOINTS.access.executiveActivity, { executiveId }),
    { query: params }
  );
  return { rows: data, pagination };
}

/* ── marketing users ─────────────────────────────────────────────────────
 * A second kind of sub-login, read-only by construction: the marketing surface
 * refuses any verb but GET before a handler runs.
 */

export async function listMarketingUsers(params: ListParams = {}): Promise<Paged<Executive>> {
  const { data, pagination } = await apiFetchPage<Executive>(ENDPOINTS.access.marketingUsers, {
    query: params,
  });
  return { rows: data, pagination };
}

export const createMarketingUser = (input: {
  username: string;
  password: string;
  permissions: string[];
}) => api.post<Executive>(ENDPOINTS.access.marketingUsers, input);

export const setMarketingUserStatus = (executiveId: number, status: ExecutiveStatus) =>
  api.patch<Executive>(buildPath(ENDPOINTS.access.marketingUserStatus, { executiveId }), { status });

export const resetMarketingUserPassword = (executiveId: number, password: string) =>
  api.patch<{ id: number }>(buildPath(ENDPOINTS.access.marketingUserPassword, { executiveId }), {
    password,
  });

/* ── the audit trail ─────────────────────────────────────────────────────*/

export async function fetchAccessActivity(
  params: { limit?: number; offset?: number; action?: string; from?: string; to?: string } = {}
): Promise<Paged<ExecutiveActivity>> {
  const { data, pagination } = await apiFetchPage<ExecutiveActivity>(ENDPOINTS.access.activity, {
    query: params,
  });
  return { rows: data, pagination };
}

/**
 * The platform-wide activity log — every actor, not just access changes.
 *
 * `fetchAccessActivity` above is a DIFFERENT TABLE: it reads
 * `executive_activity_logs`, the sub-login trail. This reads
 * `admin_activity_logs`, which is what the Activity Log screen renders and
 * what legacy's `/lords/access/activity` served. Sending an operator to the
 * former shows them "0 entries" over a log that is not empty.
 */
export async function fetchAuditActivity<T = ExecutiveActivity>(
  params: {
    limit?: number; offset?: number; action?: string; staffId?: number;
    status?: string; q?: string; from?: string; to?: string;
  } = {}
): Promise<Paged<T>> {
  const { data, pagination } = await apiFetchPage<T>(ENDPOINTS.audit.activity, {
    query: params,
  });
  return { rows: data, pagination };
}

export type { Executive, ExecutiveActivity, StaffPermissions };
