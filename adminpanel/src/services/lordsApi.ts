/**
 * The operator console's API — accounts, money, statements and the hierarchy.
 *
 * ── FOUR CONTRACT CHANGES THAT WILL 400 IF IGNORED ──────────────────────
 *
 * 1. `userId`/`userType` BECAME `accountId`/`accountType`, and the type is
 *    lower-case (`'staff' | 'user'`). Legacy spelled it `'STAFF'` and treated
 *    anything else as a player, checked with `if (userType === 'STAFF')` in
 *    five places. The bodies are `.strict()`, so the old names are a 400 rather
 *    than a silently ignored field.
 *
 * 2. MONEY IS A DECIMAL STRING, never a number. Legacy did `Number(amount)` and
 *    compared it against a NUMERIC column. A float amount is how a rounding
 *    error becomes a balance, so the server rejects numbers outright.
 *
 * 3. THERE IS NO `direction` ON A TRANSFER. `/lords/funds/transfer` took
 *    `deposit | withdraw`; the replacement is `POST /accounts/refill`, which
 *    always moves money FROM the authenticated operator TO the target. Taking
 *    money back is a refill in the other direction, made by the other party —
 *    which is the point: the payer is the person making the request, not
 *    whoever the body names.
 *
 * 4. A NEW PASSWORD IS 12 CHARACTERS. Legacy required six, on accounts that
 *    carry staff authority — and wrote the plaintext to `password2` for both
 *    staff and players while it was at it.
 *
 * The TRANSACTION PASSWORD is unchanged and still required on every write here.
 * It is the one control that separates a stolen session from a decision.
 */

import { api, apiFetch, apiDownload, apiFetchPage, buildPath } from '../utils/api';
import { ENDPOINTS } from './endpoints';
import * as access from './accessApi';
import type { StaffPermissions } from '../constants/permissions';
import { AUTHORITY_BACKEND_GRANTS } from '../constants/permissions';
import type {
  AgentStatement, BetPage, CasinoTxnRow, SportsBetRow,
} from '../components/agent-statement/types';

/** What kind of account an operator action targets. Lower-case, and validated. */
export type AccountType = 'staff' | 'user';

/** Accepts the panel's historical `'STAFF' | 'USER'` and normalises it. */
const toAccountType = (value: string): AccountType =>
  String(value).toLowerCase() === 'staff' ? 'staff' : 'user';

/** Money to the wire: an exact decimal string with at most eight places. */
const toAmount = (value: number | string): string => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error(`"${value}" is not a valid amount`);
  return n.toFixed(8).replace(/0+$/, '').replace(/\.$/, '') || '0';
};

/* ── Account statement ("hisab") ──────────────────────────────────────────
 * The on-screen report for one agent (whole downline) or one player: opening
 * and closing balance, every deposit and withdrawal with a running balance, and
 * the sports/casino profit or loss for the period.
 *
 * Legacy served two DIFFERENT PDFs from `/:staffId` and `/:staffId/pdf`, built
 * from different queries — and a third renderer for the player report, whose
 * sports P&L came from the bet rows while the statement's came from
 * `credits_ledger`. Those disagree on any voided or manually adjusted bet, so
 * the platform could print two profit figures for one player and say nothing
 * about which to believe. One renderer now, over the payload the JSON endpoints
 * return.
 */

export interface StatementParams {
  /** YYYY-MM-DD, inclusive. */
  from?: string;
  /** YYYY-MM-DD, inclusive. */
  to?: string;
  page?: number;
  limit?: number;
  category?: 'all' | 'money' | 'sports' | 'casino';
}

/** Agents and players share every report route, differing only in the path. */
const statementPath = (
  subjectType: 'STAFF' | 'USER',
  id: number | string,
  kind: 'statement' | 'bets' | 'pdf'
) => {
  const isUser = String(subjectType).toUpperCase() === 'USER';
  const template = isUser
    ? { statement: ENDPOINTS.statements.userStatement, bets: ENDPOINTS.statements.userBets, pdf: ENDPOINTS.statements.userPdf }[kind]
    : { statement: ENDPOINTS.statements.staffStatement, bets: ENDPOINTS.statements.staffBets, pdf: ENDPOINTS.statements.staffPdf }[kind];

  return buildPath(template, isUser ? { userId: id } : { staffId: id });
};

export const getAccountStatement = (
  subjectType: 'STAFF' | 'USER',
  id: number | string,
  params: StatementParams = {}
) => apiFetch<AgentStatement>(statementPath(subjectType, id, 'statement'), { query: params });

/**
 * Individual sports bets or casino transactions, paginated server-side.
 *
 * These lists are unbounded, so they are never bundled into the statement.
 *
 * `apiFetchPage`, NOT `apiFetch`. This route answers with the platform's LIST
 * envelope — the rows are `data` and the totals are `meta.pagination` — and
 * `apiFetch` returns `data` alone. Reading `.rows`/`.pagination` off an array
 * yielded `undefined` for both, so the panel rendered "0 bets" over a list it
 * had already been handed.
 */
export const getAccountBets = async <K extends 'sports' | 'casino'>(
  subjectType: 'STAFF' | 'USER',
  id: number | string,
  params: { kind: K; from?: string; to?: string; page?: number; limit?: number }
): Promise<BetPage<K extends 'sports' ? SportsBetRow : CasinoTxnRow>> => {
  type Row = K extends 'sports' ? SportsBetRow : CasinoTxnRow;
  const { data, pagination, meta } = await apiFetchPage<Row>(
    statementPath(subjectType, id, 'bets'),
    { query: params }
  );

  return {
    kind: meta?.kind ?? params.kind,
    rows: data,
    pagination: pagination ?? {
      page: params.page ?? 1,
      limit: params.limit ?? 50,
      total: data.length,
      totalPages: 1,
    },
  };
};

/** The printable statement — the same report the screen shows, one renderer. */
export const downloadAccountStatementPdf = (
  subjectType: 'STAFF' | 'USER',
  id: number | string,
  params: { from?: string; to?: string } = {}
): Promise<Blob> => apiDownload(statementPath(subjectType, id, 'pdf'), { query: params });

/**
 * The agent settlement report, as a PDF.
 *
 * `full` lists every casino transaction; otherwise a per-day summary is used.
 */
export const downloadAgentReport = (
  staffId: number | string,
  params: { full?: boolean; from?: string; to?: string } = {}
): Promise<Blob> =>
  apiDownload(buildPath(ENDPOINTS.statements.staff, { staffId }), {
    query: { ...(params.full ? { full: '1' } : {}), from: params.from, to: params.to },
  });

/* ── Account settings ─────────────────────────────────────────────────────*/

export const updatePassword = (payload: {
  userId: number | string;
  userType: 'STAFF' | 'USER';
  newPassword: string;
  transactionPassword: string;
}) =>
  api.post(ENDPOINTS.accounts.password, {
    accountType: toAccountType(payload.userType),
    accountId: payload.userId,
    newPassword: payload.newPassword,
    transactionPassword: payload.transactionPassword,
  });

/**
 * Suspend, restore, or lock a betting surface.
 *
 * The booleans are REAL booleans — a coerced `"false"` is truthy and would lock
 * an account somebody meant to unlock, or the reverse. At least one setting must
 * be present, so an empty change is a 400 rather than a no-op reporting success.
 *
 * Two of the three lock fields legacy accepted named columns that DO NOT EXIST
 * (`all_system_blocked`, `casino_blocked`), and all three went into one
 * statement — so a request setting the sports lock alongside either of the
 * others failed entirely.
 */
export const updateStatus = (payload: {
  userId: number | string;
  userType: 'STAFF' | 'USER';
  status?: 'active' | 'suspended' | 'inactive';
  betStatus?: 'active' | 'suspended';
  sportsLocked?: boolean;
  casinoLocked?: boolean;
  systemLocked?: boolean;
  transactionPassword: string;
}) =>
  api.post(ENDPOINTS.accounts.status, {
    accountType: toAccountType(payload.userType),
    accountId: payload.userId,
    transactionPassword: payload.transactionPassword,
    ...(payload.status !== undefined ? { status: payload.status } : {}),
    ...(payload.betStatus !== undefined ? { betStatus: payload.betStatus } : {}),
    ...(payload.sportsLocked !== undefined ? { sportsLocked: Boolean(payload.sportsLocked) } : {}),
    ...(payload.casinoLocked !== undefined ? { casinoLocked: Boolean(payload.casinoLocked) } : {}),
    ...(payload.systemLocked !== undefined ? { systemLocked: Boolean(payload.systemLocked) } : {}),
  });

/** An exposure limit of `0` is how an operator switches the limit off. */
export const updateExposureLimit = (payload: {
  userId: number | string;
  userType: 'STAFF' | 'USER';
  exposureLimit: number | string | null;
  transactionPassword: string;
}) =>
  api.post(ENDPOINTS.accounts.exposureLimit, {
    accountType: toAccountType(payload.userType),
    accountId: payload.userId,
    exposureLimit: toAmount(payload.exposureLimit ?? 0),
    transactionPassword: payload.transactionPassword,
  });

/** How far below zero a balance may go. Audited as the liability it creates. */
export const updateCreditLimit = (payload: {
  userId: number | string;
  creditLimit: number | string;
  transactionPassword: string;
}) =>
  api.post(ENDPOINTS.accounts.creditLimit, {
    accountId: payload.userId,
    creditLimit: toAmount(payload.creditLimit),
    transactionPassword: payload.transactionPassword,
  });

/* ── Money ────────────────────────────────────────────────────────────────*/

export interface TransferFundsResponse {
  status?: string;
  message?: string;
  balance: string;
}

/**
 * Move money to an account.
 *
 * ── THERE IS NO `fromId` AND NO `direction` ────────────────────────────
 *
 * The payer is the AUTHENTICATED OPERATOR. Legacy's `/lords/funds/transfer`
 * took a direction and let the caller state which side paid, on a route whose
 * `BEGIN` ran on one shared `pg.Client` — so the `FOR UPDATE` locks it took
 * were held on behalf of every concurrent request.
 *
 * Both sides are checked against real balances; there is no credit here.
 */
export const quickRefill = (payload: {
  userId: number | string;
  amount: number | string;
  note?: string;
  transactionPassword: string;
}) =>
  api.post<TransferFundsResponse>(ENDPOINTS.accounts.refill, {
    accountId: payload.userId,
    amount: toAmount(payload.amount),
    ...(payload.note ? { note: payload.note } : {}),
    transactionPassword: payload.transactionPassword,
  });

/**
 * @deprecated `transferFunds` was `refill` with a direction the caller chose.
 * Use `quickRefill`; a withdrawal is a refill made by the other party.
 */
export const transferFunds = (payload: {
  userId: number | string;
  userType: 'STAFF' | 'USER';
  amount: number | string;
  direction: 'deposit' | 'withdraw';
  note?: string;
  transactionPassword: string;
}) => {
  if (payload.direction === 'withdraw') {
    throw new Error(
      'A withdrawal direction is no longer accepted: the payer is the authenticated operator. ' +
        'Have the other party refill, or use the ledger adjustment endpoint.'
    );
  }
  return quickRefill(payload);
};

export const getTransferStatement = (params: { page?: number; limit?: number } = {}) =>
  apiFetchPage(ENDPOINTS.accounts.statement, {
    query: {
      limit: params.limit ?? 25,
      // The server pages by offset, not page number.
      offset: ((params.page ?? 1) - 1) * (params.limit ?? 25),
    },
  });

/* ── Exposure and listings ────────────────────────────────────────────────*/

export const getNetExposure = (userId: number | string, userType: 'STAFF' | 'USER') =>
  api.get(ENDPOINTS.accounts.sportsExposure, {
    query: { accountId: userId, accountType: toAccountType(userType) },
  });

/** One row of the downline listing — the caller's direct agents, then their own players. */
export interface AgentRow {
  id: number;
  username: string;
  role: string | null;
  account_type: 'STAFF' | 'USER';
  status: string;
  bet_status: string;
  percentage: number;
  bet_locked: boolean;
  sports_locked: boolean;
  casino_locked: boolean;
  system_locked: boolean;
  balance: number;
  exp_limit: number;
  has_downline: boolean;
  exposure: number;
  sports_pnl: number;
  casino_pnl: number;
}

/**
 * The agent listing — ONE LEVEL of the tree.
 *
 * The caller's direct sub-agents (`account_type: 'STAFF'`) followed by the
 * caller's own players (`'USER'`), not every player in the subtree. `parentId`
 * walks down a level.
 *
 * ── `parentId` IS CHECKED, NOT TRUSTED ────────────────────────────────
 *
 * Legacy defaulted it to the caller's own id and then let the client override
 * it, unchecked — an agent sending somebody else's id read that agent's entire
 * downline, balances included. The server now validates it against the caller's
 * own descendants and answers 404 for anything outside them, so passing it is a
 * drill-down request rather than a way out of your own subtree.
 */
export const getAllDetails = (
  params: { page?: number; limit?: number; search?: string; parentId?: number | string } = {}
) =>
  apiFetchPage<AgentRow>(ENDPOINTS.accounts.list, {
    query: {
      limit: params.limit ?? 50,
      // The server pages by offset, not page number.
      offset: ((params.page ?? 1) - 1) * (params.limit ?? 50),
      search: params.search,
      parentId: params.parentId,
    },
  });

/**
 * @deprecated `POST /lords/update-current` has no replacement.
 *
 * It recomputed a "current" figure by writing back to the accounts it read.
 * The balance IS the current figure now, and every read returns it — there is
 * nothing to refresh. Call `getAllDetails` instead.
 */
export const updateCurrent = () => getAllDetails();

/* ── Balance sheet ────────────────────────────────────────────────────────*/

export interface BalanceSheetRow {
  ts: string;
  type: 'CREDIT' | 'DEBIT';
  category: string;
  description: string;
  /** Signed decimal string — negative is a debit. */
  amount: string;
  /** Running balance after this row, decimal string. */
  balance: string;
}

export interface BalanceSheetResponse {
  subject: { id: string; name: string; email: string | null; agent: string | null };
  currency: string;
  balance: {
    /** The wallet, right now. */
    live: string;
    /** What the ledger closes at. */
    ledger: string;
    /** Stakes on bets that have left the wallet and have no settlement row yet. */
    openExposure: string;
    /** `live + openExposure - ledger`. Non-zero means the sheet cannot explain the wallet. */
    unexplained: string;
    credited: string;
    /** Negative. */
    debited: string;
  };
  /** Every event, not just this page. */
  total: number;
  rows: BalanceSheetRow[];
}

/** `offset`, not `page` — the endpoint rejects unrecognised query keys. */
export const getBalanceSheet = (
  userId: number | string,
  params: { currency?: string; limit?: number; offset?: number } = {}
) =>
  apiFetch<BalanceSheetResponse>(buildPath(ENDPOINTS.reports.balanceSheet, { userId }), {
    query: params,
  });

/* ── Creating accounts ────────────────────────────────────────────────────*/

/**
 * Create a staff account.
 *
 * `initialBalance` is a real opening deposit funded from the CREATOR's own
 * balance, not a credit line. Pass `0` for an unfunded account.
 */
export const createStaff = (payload: {
  username: string;
  email: string;
  password: string;
  role: string;
  initialBalance: number | string;
  percentage: number;
  transactionPassword: string;
}) =>
  api.post(ENDPOINTS.staff.create, {
    name: payload.username,
    email: payload.email,
    password: payload.password,
    roleName: payload.role,
    initialBalance: toAmount(payload.initialBalance),
    percentage: payload.percentage,
    transactionPassword: payload.transactionPassword,
  });

export const createUser = (payload: {
  username: string;
  email: string;
  password: string;
  initialBalance: number | string;
  percentage?: number;
  transactionPassword: string;
}) =>
  api.post(ENDPOINTS.players.create, {
    name: payload.username,
    email: payload.email,
    password: payload.password,
    initialBalance: toAmount(payload.initialBalance),
    transactionPassword: payload.transactionPassword,
  });

/**
 * Set a password on first sign-in.
 *
 * The CURRENT password is required, so this is a change rather than a reset —
 * legacy relied on the `first_login` flag alone, which meant an account still
 * carrying it could have its password replaced by whoever reached the endpoint.
 */
export const firstLoginPassword = (payload: {
  email: string;
  currentPassword: string;
  newPassword: string;
}) => api.post(ENDPOINTS.auth.firstLoginPassword, payload, { auth: false });

/* ── Access management ────────────────────────────────────────────────────
 * Moved wholesale to `services/accessApi.ts`, which talks to
 * `/api/v1/admin/access/*`. The versions that used to live here spoke to socket
 * events no service registers — see the note at the top of `socketService.ts`.
 */

export { fetchMyPermissions as getMyPermissions, setExecutiveStatus, setMarketingUserStatus } from './accessApi';

/**
 * ── ADAPTERS, NOT PASS-THROUGHS ─────────────────────────────────────────
 *
 * The screens call these with the old signatures, and two things about those
 * signatures no longer hold:
 *
 * 1. `transactionPassword` IS NOT REQUIRED HERE. It guards MONEY — a transfer,
 *    a refill, a balance adjustment. Access management is permissioned
 *    (`roles:manage`) instead. Asking for the second factor on a screen that
 *    does not need it trains operators to type it wherever a form asks, which
 *    is the habit that makes the control worthless where it does matter. The
 *    field is accepted and ignored so the forms keep working; the prompts
 *    should come out.
 *
 * 2. `{lock: boolean}` IS A STATUS ENUM. Legacy took `{status}` for executives
 *    and `{lock}` for marketing users — one operation, two body shapes, which
 *    is exactly why the two handlers had drifted apart.
 */

export const listExecutives = (params: { page?: number; limit?: number; search?: string } = {}) =>
  access.listExecutives({
    limit: params.limit ?? 25,
    offset: ((params.page ?? 1) - 1) * (params.limit ?? 25),
    search: params.search,
  });

export const createExecutive = (payload: {
  username: string;
  password: string;
  permissions: StaffPermissions | string[];
  /** Accepted and ignored — see above. */
  transactionPassword?: string;
}) =>
  access.createExecutive({
    username: payload.username,
    password: payload.password,
    permissions: toPermissionList(payload.permissions),
  });

export const updateExecutive = (
  executiveId: number | string,
  payload: { permissions: StaffPermissions | string[]; transactionPassword?: string }
) => access.updateExecutivePermissions(Number(executiveId), toPermissionList(payload.permissions));

export const resetExecutivePassword = (
  executiveId: number | string,
  payload: { newPassword: string; transactionPassword?: string }
) => access.resetExecutivePassword(Number(executiveId), payload.newPassword);

/** `lock` maps onto the status enum: locked, or back to active. */
export const lockExecutive = (
  executiveId: number | string,
  payload: { lock: boolean; transactionPassword?: string }
) => access.setExecutiveStatus(Number(executiveId), payload.lock ? 'locked' : 'active');

export const getExecutiveActivity = (
  executiveId: number | string,
  params: { page?: number; limit?: number } = {}
) =>
  access.fetchExecutiveActivity(Number(executiveId), {
    limit: params.limit ?? 50,
    offset: ((params.page ?? 1) - 1) * (params.limit ?? 50),
  });

/**
 * The Activity Log screen's feed.
 *
 * `fetchAuditActivity`, NOT `fetchAccessActivity` — the two endpoints are one
 * segment apart and read DIFFERENT TABLES. `/access/activity` is the executive
 * sub-login trail (`executive_activity_logs`); this screen shows every actor's
 * actions, which live in `admin_activity_logs` behind `/audit/activity`. The
 * screen was wired to the former and so reported "0 entries" over a full log.
 *
 * Every filter goes to the server. Filtering the page in hand instead means
 * "search these fifty rows", which cannot find the row the operator is
 * looking for and makes the count above the table describe a different set.
 */
export const getActivity = (
  params: {
    page?: number; limit?: number; action?: string; status?: string;
    q?: string; from?: string; to?: string;
  } = {}
) =>
  access.fetchAuditActivity<ActivityEntry>({
    limit: params.limit ?? 50,
    offset: ((params.page ?? 1) - 1) * (params.limit ?? 50),
    action: params.action,
    status: params.status,
    q: params.q,
    from: params.from,
    to: params.to,
  });

export const listMarketingUsers = (params: { page?: number; limit?: number; search?: string } = {}) =>
  access.listMarketingUsers({
    limit: params.limit ?? 25,
    offset: ((params.page ?? 1) - 1) * (params.limit ?? 25),
    search: params.search,
  });

export const createMarketingUser = (payload: {
  username: string;
  password: string;
  permissions?: StaffPermissions | string[];
  transactionPassword?: string;
}) =>
  access.createMarketingUser({
    username: payload.username,
    password: payload.password,
    // A marketing account's reach is fixed server-side; this is the floor.
    permissions: payload.permissions ? toPermissionList(payload.permissions) : ['reports:read'],
  });

export const resetMarketingPassword = (
  id: number | string,
  payload: { newPassword: string; transactionPassword?: string }
) => access.resetMarketingUserPassword(Number(id), payload.newPassword);

export const lockMarketingUser = (
  id: number | string,
  payload: { lock: boolean; transactionPassword?: string }
) => access.setMarketingUserStatus(Number(id), payload.lock ? 'locked' : 'active');

/**
 * The panel's permission object → the flat list the server takes.
 *
 * Legacy stored `{groups, pages, authority}` and validated only that those
 * three keys were objects. The server takes a list of KNOWN permission strings
 * and intersects it with the creator's own authority, so anything unrecognised
 * here is a 400 rather than a grant nobody checked.
 */
function toPermissionList(input: StaffPermissions | string[]): string[] {
  if (Array.isArray(input)) return input.map(String);
  if (!input || typeof input !== 'object') return [];

  const blob = input as Record<string, any>;
  const flat = blob.authority ?? blob.permissions ?? blob;

  if (Array.isArray(flat)) return flat.map(String);

  const grants = new Set<string>();
  for (const [name, on] of Object.entries(flat)) {
    if (!on) continue;
    const mapped = AUTHORITY_BACKEND_GRANTS[name];
    if (mapped?.length) mapped.forEach((p) => grants.add(p));
    else if (name.includes(':') || name === '*') grants.add(name);
  }
  return [...grants];
}

export interface ActivityEntry {
  id: number;
  staffId: number;
  executiveId: number | null;
  actorName: string | null;
  actorRole: string | null;
  actorLevel: number | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetName: string | null;
  details: any;
  ip: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  location: string | null;
  userAgent: string | null;
  status: 'success' | 'failed';
  errorMessage: string | null;
  createdAt: string;
}

export interface ActivityLogResponse {
  entries: ActivityEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Verify an executive's password without taking over the session.
 *
 * `auth: false` matters here: this must NOT send the parent admin's bearer
 * token, and a 401 from it must not clear the parent's session. The old version
 * used a raw `fetch` against the retired monolith host for the same reason —
 * this keeps the property and drops the hardcoded host.
 */
export const testExecutiveLogin = async (payload: { username: string; password: string }) => {
  try {
    const body = await apiFetch(ENDPOINTS.auth.executiveLogin, {
      method: 'POST',
      body: payload,
      auth: false,
    });
    return { ok: true, status: 200, body };
  } catch (error: any) {
    return { ok: false, status: error?.status ?? 0, body: { message: error?.message, code: error?.code } };
  }
};

export type { StaffPermissions };
