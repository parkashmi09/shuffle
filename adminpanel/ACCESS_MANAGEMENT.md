# Access Management — Executives

End-to-end specification for the **Access Management** feature shipped in
[AccessManagementTab.tsx](src/components/admin-management/AccessManagementTab.tsx).
This document is meant to be a drop-in spec when wiring the same logic into a
different backend.

---

## 1. What this feature does

Every member of the admin hierarchy (SuperAdmin, MotherAdmin, Master, Super,
Agent, …) can mint **Executives** — sub-accounts that act on the parent's
behalf with a scoped permission set.

For each Executive the parent can:

| Capability                       | UI control            | API call                                                      |
| -------------------------------- | --------------------- | ------------------------------------------------------------- |
| Create executive                 | "Create Executive"    | `POST /lords/access/executives`                               |
| List own executives (paginated)  | Search / table        | `GET  /lords/access/executives?page&limit&search`             |
| Edit pages / authority toggles   | Edit dialog           | `PATCH /lords/access/executives/:id`                          |
| Reset login password             | Reset Password dialog | `PATCH /lords/access/executives/:id/password`                 |
| Lock / unlock                    | Lock dialog           | `PATCH /lords/access/executives/:id/lock`                     |
| View activity log                | Activity Log dialog   | `GET  /lords/access/executives/:id/activity?page&limit&from&to` |
| Verify executive password (no session takeover) | Test Login dialog | `POST /api/staff/auth/executive/login`                        |
| Read own (logged-in) permissions | Sidebar/route guard   | `GET  /lords/access/me/permissions`                           |

Every mutation requires the parent's **Transaction Password** as a second
factor (separate from the login password).

---

## 2. Frontend wiring (so the same UI ports cleanly)

### 2.1 Files involved

| File | Role |
| ---- | ---- |
| [src/components/admin-management/AccessManagementTab.tsx](src/components/admin-management/AccessManagementTab.tsx) | Tab UI: list, create/edit, reset password, lock/unlock, activity log, test login |
| [src/services/lordsApi.ts](src/services/lordsApi.ts)         | REST wrappers (section "Access Management (Executives)") |
| [src/services/socketService.ts](src/services/socketService.ts) | Socket.IO live-update wrappers and shared types |
| [src/constants/permissions.ts](src/constants/permissions.ts) | Single source of truth for pages, authority keys, and `StaffPermissions` shape |
| [src/hooks/usePermissions.ts](src/hooks/usePermissions.ts)   | Loads + caches the current user's effective permissions; powers `isSuper`, `can()`, `pageVisible()`, `groupVisible()` |
| [src/utils/api.ts](src/utils/api.ts)                         | `apiFetch` — adds `Authorization: Bearer <token>`, handles 401 by clearing localStorage and redirecting to `/login` |

### 2.2 Auth & session

- Login token: `localStorage.token` (Bearer)
- Role:       `localStorage.userRole` — `SuperAdmin` and `MotherAdmin` short-circuit `can()` to `true` (see [permissions.ts:216](src/constants/permissions.ts#L216))
- Cached effective permissions: `localStorage.myPermissions`
- Permission cache stays warm via Socket.IO event `myPermissionsUpdate`

### 2.3 Gating

The tab itself is gated by:

```ts
const { isSuper, can, loading } = usePermissions();
const allowed = isSuper || can('canManageStaff');
```

So a non-super hierarchy member needs the `canManageStaff` authority key on
their own permissions row to even open this screen.

### 2.4 Live updates (Socket.IO)

Connection: `https://api.stake.com/admin-panel` namespace, auth via
`{ token: 'Bearer <jwt>' }` (see [socketService.ts:5-21](src/services/socketService.ts#L5-L21)).

| Client emit                   | Server emits back               | Stop event                | Payload type |
| ----------------------------- | ------------------------------- | ------------------------- | ------------ |
| `getExecutiveList`            | `executiveListUpdate`           | `stopExecutiveList`       | `{ executives: Executive[]; totalPages?: number }` |
| `getExecutiveActivity`        | `executiveActivityUpdate`       | `stopExecutiveActivity`   | `{ entries: ExecutiveActivity[]; totalPages?: number }` |
| `getMyPermissions`            | `myPermissionsUpdate`           | (off only)                | `{ permissions: StaffPermissions; role: string }` |

Optional ack-style mutation events (the UI currently uses REST; the socket
versions exist for parity):

- `createExecutive`              → ack `{ success, message?, executiveId? }`
- `updateExecutivePermissions`   → ack `{ success, message? }`
- `resetExecutivePassword`       → ack `{ success, message? }`
- `lockExecutive`                → ack `{ success, message? }`

A backend supporting the REST list above is sufficient — sockets are an
enhancement, not a hard dependency. If the REST endpoint returns 404/501 the
UI falls back gracefully (`isEndpointMissing`, see [AccessManagementTab.tsx:42](src/components/admin-management/AccessManagementTab.tsx#L42)).

---

## 3. REST API contract

Base URL (current deployment): `https://api.stake.com`
All endpoints expect `Authorization: Bearer <jwt>` and `Content-Type: application/json`.

### 3.1 List executives

`GET /lords/access/executives?page=1&limit=25&search=foo`

**Behavior:** returns only executives whose `parentUserId` is the calling
user's id (or all of them when caller is `SuperAdmin`/`MotherAdmin`).
`search` is optional and only applied when the UI sends a 3+ char query.

**Response 200:**
```json
{
  "executives": [
    {
      "id": 42,
      "username": "ops_lisa",
      "status": "active",
      "parentUserId": 7,
      "parentUsername": "master_one",
      "parentRole": "Master",
      "createdAt": "2026-04-12T08:21:00Z",
      "lastLogin": "2026-05-03T15:04:11Z",
      "permissions": { "groups": {...}, "pages": {...}, "authority": {...} }
    }
  ],
  "totalPages": 4
}
```

### 3.2 Create executive

`POST /lords/access/executives`

```json
{
  "username": "ops_lisa",
  "password": "min-6-chars",
  "permissions": { "groups": {...}, "pages": {...}, "authority": {...} },
  "transactionPassword": "<parent-txn-password>"
}
```

**Server must:**
1. Verify `transactionPassword` against the caller's stored hash.
2. Reject duplicate usernames.
3. Hash `password` with bcrypt (or argon2).
4. Persist with `role = 'Executive'`, `parentUserId = caller.id`,
   `status = 'active'`, and the JSON `permissions`.
5. Emit `executiveListUpdate` to the parent's socket room.

**Response 201:** the created `Executive` (same shape as list rows).

### 3.3 Update permissions

`PATCH /lords/access/executives/:id`

```json
{
  "permissions": { "groups": {...}, "pages": {...}, "authority": {...} },
  "transactionPassword": "<parent-txn-password>"
}
```

**Authorization:** target row's `parentUserId` must equal `caller.id`
(or caller is super). Validate transaction password, then overwrite the
permissions JSON. Emit `myPermissionsUpdate` to *the executive's* socket so
their sidebar/router refreshes immediately, and `executiveListUpdate` to the
parent.

### 3.4 Reset executive password

`PATCH /lords/access/executives/:id/password`

```json
{ "newPassword": "min-6-chars", "transactionPassword": "<parent-txn-password>" }
```

Hash and replace `password_hash`. Optionally: invalidate any existing JWT
sessions for that executive (recommended).

### 3.5 Lock / unlock

`PATCH /lords/access/executives/:id/lock`

```json
{ "lock": true, "transactionPassword": "<parent-txn-password>" }
```

- `lock: true`  → set `status = 'locked'`, kick existing sessions
- `lock: false` → set `status = 'active'`

### 3.6 Activity log

`GET /lords/access/executives/:id/activity?page=1&limit=50&from=ISO&to=ISO`

```json
{
  "entries": [
    {
      "id": 12345,
      "executiveId": 42,
      "action": "transfer.credit",
      "targetType": "user",
      "targetId": 9981,
      "details": { "amount": 5000, "reason": "manual top-up" },
      "ip": "203.0.113.4",
      "userAgent": "Mozilla/5.0 …",
      "createdAt": "2026-05-03T15:30:00Z"
    }
  ],
  "totalPages": 7
}
```

If this route returns **404 / 501** (or the body matches `Cannot GET …`) the
UI shows a "log endpoint not deployed" placeholder instead of an error.

**Action codes the UI already colour-codes** (see [AccessManagementTab.tsx:375-398](src/components/admin-management/AccessManagementTab.tsx#L375-L398)):

```
login, logout,
user.create, user.update, user.password.reset, user.lock, user.unlock,
transfer.credit, transfer.casino,
settle.sports, settle.fancy, settle.casino,
deposit.approve, deposit.reject,
withdraw.approve, withdraw.reject,
kyc.update,
redeem.create, giftcard.issue, bonus.issue,
notification.send, config.update
```

Server may emit any string — unknown codes render with the default blue.

### 3.7 My permissions

`GET /lords/access/me/permissions`

```json
{
  "role": "Master",
  "permissions": { "groups": {...}, "pages": {...}, "authority": {...} }
}
```

Returned for the caller themselves; the hook caches the response under
`localStorage.myPermissions` and subscribes to `myPermissionsUpdate` for live
revocation.

### 3.8 Test login (no session takeover)

`POST /api/staff/auth/executive/login`

```json
{ "username": "ops_lisa", "password": "guess" }
```

Issued via raw `fetch` so a 401 response does **not** clobber the parent's
token (see [lordsApi.ts:232-241](src/services/lordsApi.ts#L232-L241)). The
endpoint should validate credentials and return:

- `200 { status: "success", … }` on match
- `401 { status: "error", message: "Invalid credentials" }` otherwise

The UI only reads `ok` + `body.message`; no token is stored from this call.

---

## 4. Permission model — `StaffPermissions`

Stored as a single JSON column. Three independent maps:

```ts
interface StaffPermissions {
  groups:    Record<string, boolean>; // sidebar group title  -> visible
  pages:     Record<string, boolean>; // route path           -> visible
  authority: Record<string, boolean>; // action key           -> granted
}
```

**Group titles** (10 — must match exactly):
`Main`, `Agent Panel`, `Admin`, `History`, `Sports Exchange`, `Gaming`,
`Transactions`, `Marketing`, `Settings`, `Services`.

**Page paths** (deduped from all groups, see `ALL_PAGE_PATHS` in [permissions.ts:189](src/constants/permissions.ts#L189)):
```
/admin-dashboard, /users, /reports, /kyc, /wallet, /redeemcode,
/turnover-report, /admin-management, /percentage-hierarchy, /history,
/account-statement, /sports-dashboard, /MOsettle, /Fansettle, /fancyreport,
/marketwins, /fanwins, /games, /house, /win-settings, /winloss, /club,
/bonus, /deposit, /withdraw, /giftcard-admin, /spinwheel, /blog, /banner,
/seo-manager, /bankdetails, /siteconfig, /providers-priority,
/vendor-priority, /type-priority, /userconfig, /settings, /notification,
/notification-settings
```

**Authority keys** (24, see [permissions.ts:120-180](src/constants/permissions.ts#L120-L180)):
```
canCreateUser, canCreateAgent, canEditUser, canDeleteUser,
canChangeUserPassword, canLockUser, canChangeCreditLimit,
canChangeExposureLimit, canManageKYC,
canTransferCredit, canTransferCasino, canApproveDeposit, canApproveWithdraw,
canSettleSports, canSettleFancy, canSettleCasino,
canCreateRedeemCode, canIssueGiftCard, canIssueBonus, canSendNotification,
canViewReports, canExportCSV, canEditSiteConfig, canEditPriorities,
canManageStaff
```

`SuperAdmin` and `MotherAdmin` bypass all checks frontend-side (see
[permissions.ts:216](src/constants/permissions.ts#L216)) — but the backend
must still enforce role-based access independently. Never trust the cached
client copy.

---

## 5. Recommended database schema

A reference schema sufficient to back every endpoint above. Names follow the
`snake_case` convention; adjust types to your dialect (the `JSON` columns
work in MySQL ≥ 5.7, Postgres `JSONB`, MariaDB ≥ 10.2, SQLite via TEXT).

### 5.1 `staff` (or `users` — whatever your existing admin/agent table is)

This is the table the **parent** rows already live in. Executives are stored
in the same table with `role = 'Executive'` and a `parent_user_id` pointing
back. If your hierarchy already uses a single table, just add the columns
that aren't there yet.

| Column                  | Type                | Notes                                   |
| ----------------------- | ------------------- | --------------------------------------- |
| `id`                    | BIGINT PK AI        |                                         |
| `username`              | VARCHAR(64) UNIQUE  | login handle                            |
| `email`                 | VARCHAR(190) NULL   |                                         |
| `password_hash`         | VARCHAR(255)        | bcrypt / argon2                         |
| `transaction_password_hash` | VARCHAR(255)    | second factor for sensitive actions     |
| `role`                  | VARCHAR(32)         | `SuperAdmin` / `MotherAdmin` / `Master` / `Super` / `Agent` / `Executive` |
| `parent_user_id`        | BIGINT NULL FK→staff.id | required for `Executive`, optional otherwise |
| `status`                | ENUM('active','inactive','locked') | default `active`         |
| `permissions`           | JSON NULL           | `StaffPermissions` shape (see §4); only meaningful for non-super roles |
| `last_login_at`         | DATETIME NULL       |                                         |
| `last_login_ip`         | VARCHAR(45) NULL    | IPv4/IPv6                               |
| `created_at`            | DATETIME            |                                         |
| `updated_at`            | DATETIME            |                                         |

**Indexes:**
- `UNIQUE (username)`
- `INDEX (parent_user_id, role)` — scoped list query
- `INDEX (parent_user_id, status)` — filtered list

**Tip:** if you want sub-second tenant filtering on `permissions.authority.canManageStaff`,
project that into a generated/virtual column or a small lookup row.

### 5.2 `executive_activity_log`

One row per recorded action — written by every mutation route across the
system that an executive can hit.

| Column         | Type                | Notes                                |
| -------------- | ------------------- | ------------------------------------ |
| `id`           | BIGINT PK AI        |                                      |
| `executive_id` | BIGINT FK→staff.id  | the actor (the executive)            |
| `parent_user_id` | BIGINT FK→staff.id | denormalised — caller hierarchy root, makes "list activity for *my* executives" a single index |
| `action`       | VARCHAR(64)         | dotted code: `transfer.credit`, `user.update`, … |
| `target_type`  | VARCHAR(32) NULL    | `user`, `agent`, `settlement`, `bet`, `deposit`, `withdraw`, … |
| `target_id`    | VARCHAR(64) NULL    | string to allow non-numeric ids      |
| `details`      | JSON NULL           | free-form action context (amount, reason, before/after diff…) |
| `ip`           | VARCHAR(45) NULL    |                                      |
| `user_agent`   | VARCHAR(255) NULL   |                                      |
| `created_at`   | DATETIME            | indexed                              |

**Indexes:**
- `INDEX (executive_id, created_at DESC)` — `/activity` endpoint
- `INDEX (parent_user_id, created_at DESC)` — parent dashboards
- `INDEX (action, created_at DESC)` — analytics

**Retention:** treat as append-only; archive rows older than your audit
window to cold storage rather than deleting.

### 5.3 (Optional) `staff_session`

If you choose to invalidate JWTs on lock / password reset:

| Column           | Type        | Notes                          |
| ---------------- | ----------- | ------------------------------ |
| `id`             | BIGINT PK   |                                |
| `staff_id`       | BIGINT FK   |                                |
| `jti`            | VARCHAR(64) | JWT id for revocation lookup   |
| `issued_at`      | DATETIME    |                                |
| `expires_at`     | DATETIME    |                                |
| `revoked_at`     | DATETIME NULL |                              |
| `ip`, `user_agent` | …         |                                |

On `lock` / `password reset` set `revoked_at = NOW()` for all matching rows
and reject any incoming JWT whose `jti` is revoked.

---

## 6. Server-side enforcement checklist

Frontend gating is convenience only. Re-check on the server:

1. **Identity** — every `/lords/...` route requires a valid JWT.
2. **Tenancy** — for any `/lords/access/executives/:id*` route, ensure the
   target row's `parent_user_id == caller.id` (or caller is super).
3. **Transaction password** — verify on every mutation. Rate-limit failures
   per caller per minute and log to `executive_activity_log` with action
   `auth.txn_password.fail`.
4. **Action gating** — for every business endpoint the executive can hit
   (transfer, settle, kyc, …), look up `permissions.authority.<key>` from
   their stored row and 403 if false. Never trust headers/body from the
   client for permission claims.
5. **Status gating** — reject any request from a `status != 'active'` actor
   with 423 (Locked) so the UI can react.
6. **Audit** — every mutation an executive performs must write one
   `executive_activity_log` row before responding 2xx.
7. **Live revocation** — after writing a permissions/lock/password change,
   emit `myPermissionsUpdate` to the executive's socket room and
   `executiveListUpdate` to the parent's room.

---

## 7. Porting steps (concise)

1. Create / extend the `staff` table per §5.1, plus `executive_activity_log`
   per §5.2.
2. Implement the eight REST routes in §3 with the auth+enforcement rules
   from §6.
3. Mirror the `StaffPermissions` JSON shape from §4 verbatim — the frontend
   is hard-coded against those exact group titles, page paths, and
   authority keys.
4. (Optional) Add the `admin-panel` Socket.IO namespace and the events
   listed in §2.4 for live updates. The UI works without sockets — it just
   stops auto-refreshing.
5. Point `BASE` in [src/utils/api.ts](src/utils/api.ts#L2) and
   `SOCKET_URL` in [src/services/socketService.ts](src/services/socketService.ts#L5)
   at the new backend.
6. Issue JWTs that include the staff `id` and `role`; populate
   `localStorage.token` and `localStorage.userRole` after login.
7. Smoke-test in this order: login → `GET /lords/access/me/permissions` →
   open the tab → create an executive → edit → reset → lock → activity log.
