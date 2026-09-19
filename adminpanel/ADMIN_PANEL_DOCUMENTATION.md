# stake Admin Panel — Complete Build & Port Documentation

> Drop-in specification for the stake / GoldPlay admin panel. Use this to
> re-create or upgrade an older admin panel with the current theme, layout,
> Risk Management, Client Management, and Executive (sub-account) features —
> **including every backend endpoint, payload, and DB table needed to power it.**
>
> Companion doc: [ACCESS_MANAGEMENT.md](ACCESS_MANAGEMENT.md) — the deep spec for
> the Executive/Access-Management feature. This file references it but does not
> duplicate it.

---

## Table of contents

1. [Tech stack](#1-tech-stack)
2. [Theme & design system](#2-theme--design-system)
3. [Page layout & shell](#3-page-layout--shell)
4. [Navigation (Sidebar) & role-based visibility](#4-navigation-sidebar--role-based-visibility)
5. [Permission model](#5-permission-model)
6. [Client Management module](#6-client-management-module)
7. [Risk Management (User side)](#7-risk-management-user-side)
8. [Executive Members (Access Management)](#8-executive-members-access-management)
9. [Full REST API contract](#9-full-rest-api-contract)
10. [Backend functionality required (new + existing)](#10-backend-functionality-required-new--existing)
11. [Database schema](#11-database-schema)
12. [Porting checklist](#12-porting-checklist)

---

## 1. Tech stack

| Layer       | Choice                                                        |
| ----------- | ------------------------------------------------------------- |
| Framework   | React 18 + TypeScript                                         |
| Build       | Create React App (`react-scripts` 5)                          |
| UI library  | Material UI 6 (MUI) + `sx` prop                               |
| Styling     | Tailwind CSS 3 (utility classes) + MUI theme                  |
| Routing     | React Router v6                                               |
| Charts      | Recharts + Chart.js (`react-chartjs-2`)                       |
| Icons       | Lucide React (sidebar) + MUI Icons (tabs/dialogs)             |
| Font        | Montserrat (Google Fonts)                                     |
| Realtime    | Socket.IO client (`admin-panel` namespace)                   |
| Theme mode  | **Dark only**                                                 |

Entry points: `src/index.tsx` (wraps app in MUI `ThemeProvider` with `src/theme.ts`),
`src/App.tsx` (all routes), `src/index.css` (`:root` CSS variables + base styles).

---

## 2. Theme & design system

Single source of truth: **`src/theme.ts`** (MUI palette + component overrides) and
**`src/index.css`** (`:root` CSS variables, mirrored from the same colours).

### 2.1 Colour tokens

| Token              | Hex                       | Usage                                  |
| ------------------ | ------------------------- | -------------------------------------- |
| `primary`          | `#2B6EF5`                 | Buttons, active states, indicators     |
| `primaryHover`     | `#4A85F7`                 | Button hover                           |
| `bg`               | `#0C0D1D`                 | App background / page surface          |
| `bgCard`           | `#0E1831`                 | Cards, drawer, appbar, dialogs         |
| `bgCardLight`      | `#121E38`                 | Menus                                  |
| `bgCardHover`      | `#162140`                 | Row / item hover                       |
| `bgContrast`       | `#172244`                 | Table headers, chips, tooltips         |
| `bgInput`          | `#10182E`                 | Inputs, selects                        |
| `textPrimary`      | `#F9F9F9`                 | Primary text                           |
| `textSecondary`    | `#8384A5`                 | Secondary text                         |
| `textMuted`        | `#878AA2`                 | Labels, captions, placeholders         |
| `border`           | `#1E2D55`                 | All borders / dividers                 |
| `success` (green)  | `#0ECC68`                 | Deposits, profit, active, won          |
| `error` (red)      | `#E01B4F`                 | Withdrawals, loss, locked, lost        |
| `warning` (yellow) | `#FFC23F`                 | Risk flags, pending                    |
| `info` (blue)      | `#5581F7`                 | Informational chips                    |

> Semantic colour rule used everywhere: **green = money in / profit / healthy**,
> **red = money out / loss / locked**, **yellow = risk/pending**, **exposure
> positive = red (platform liability), negative = green**.

### 2.2 Typography

- Font family: `'Montserrat', sans-serif`.
- Headings `h1`–`h6` weight 600–700, tight letter-spacing.
- `button` text-transform: `none`, weight 600.
- Table head: 0.75rem, uppercase, 700 weight, letter-spacing 0.06em.

### 2.3 Shape & component conventions

- Global `borderRadius: 10`. Cards 14, dialogs 16, chips 8.
- Every surface (`Paper`, `Card`, `Dialog`, `Drawer`, `AppBar`) is `bgCard` with
  a `1px solid border` and **no elevation / no background image**.
- `TextField`/`Select`: small size, `bgInput` fill, border turns `primary` on
  focus.
- `TableRow` hover → `bgCardHover`; last row removes bottom border.
- `Tab` indicator: 3px `primary` bar, rounded top.
- `Switch` checked track: `primary` @ 50% alpha.
- Custom thin scrollbars (`6px`, `border`-coloured thumb) defined in `index.css`.

> When building a new screen, **do not hardcode hex values inline** unless
> matching the existing components (some dialogs do use the `C` const pattern of
> hardcoded hex — see Risk dialogs). Prefer `theme.palette.*` / `colors` import
> from `theme.ts`, or the CSS variables in `index.css`.

---

## 3. Page layout & shell

`src/components/Layout.tsx` is the authenticated shell. Structure:

```
<Box flex; minHeight:100vh; bg:#0C0D1D>
  <Sidebar />                         // left, 256px desktop / drawer on mobile
  <Box flexGrow:1; column>
    <AppBar sticky; 52–58px>          // topbar
      left:  hamburger (mobile) + page title (derived from pathname)
      right: wallet balance badge (click → refetch) + avatar + name/role pill
    </AppBar>
    <main flex:1; overflowY:auto; bg:#0C0D1D; padding 1.5–2.5>
      <Outlet />                      // routed page
    </main>
  </Box>
</Box>
```

- **Sidebar width:** `256px` (`SIDEBAR_WIDTH`). Permanent drawer ≥ `lg`; temporary
  drawer with backdrop below `lg`.
- **AppBar:** `bgCard`, sticky, `zIndex 10`, bottom border. Wallet balance is
  clickable and refetches; listens to a window `"balance-changed"` custom event
  to refresh after any credit operation.
- **Routing:** `App.tsx` — public `/login`; everything else behind
  `<ProtectedRoutes>` (token in `localStorage.token`). Home redirects to
  `/admin-management`. Each non-tab page is wrapped in `<RequirePermission
  authority="...">` for route-level gating.

### 3.1 Route map (high level)

| Path                          | Component                | Gate (authority)        |
| ----------------------------- | ------------------------ | ----------------------- |
| `/admin-management/*`         | `AdminManagement` shell  | (per-tab)               |
| `/admin-dashboard`            | `AdminDashboard`         | —                       |
| `/users`                      | `Users`                  | —                       |
| `/reports`                    | `Reports`                | `canViewReports`        |
| `/kyc`                        | `UserKyc`                | `canManageKYC`          |
| `/wallet`                     | `WalletUpdate`           | —                       |
| `/deposit` / `/withdraw`      | Deposit / Withdraw       | `canApproveDeposit/Withdraw` |
| `/history`                    | `History`                | —                       |
| `/sports-dashboard`           | `sportsbetStats`         | —                       |
| `/MOsettle` / `/Fansettle`    | Market / Fancy settle    | `canSettleSports/Fancy` |
| `/redeemcode`                 | `RedeemCode`             | `canCreateRedeemCode`   |
| `/giftcard-admin`             | `AdminGiftcards`         | `canIssueGiftCard`      |
| `/bonus`                      | `Bonus`                  | `canIssueBonus`         |
| `/notification`               | `notification`           | `canSendNotification`   |
| `/siteconfig`                 | `SiteConfig`             | `canEditSiteConfig`     |
| `/providers|vendor|type-priority` | priority editors     | `canEditPriorities`     |
| `/turnover-report`            | `TurnoverReport`         | `canViewReports`        |
| `/percentage-hierarchy`       | `PercentageHierarchyPage`| —                       |

(Full list in `App.tsx`.)

---

## 4. Navigation (Sidebar) & role-based visibility

`src/components/Sidebar.tsx`. The nav is a list of **groups**, each with **items**
(`{ path, label, icon }`). Groups are collapsible; the group containing the active
route auto-expands.

### 4.1 Groups & items

| Group              | Items (label → path)                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| **Main**           | Dashboard `/admin-dashboard`, Users `/users`, User Reports `/reports`, User KYC `/kyc`, Wallet `/wallet`, Redeem Codes `/redeemcode`, Turnover Report `/turnover-report` |
| **Agent Panel**    | Dashboard `/admin-dashboard`, Users `/users`                                                          |
| **Admin**          | Client Management `/admin-management`, Percentage Hierarchy `/percentage-hierarchy`                   |
| **History**        | Bet History `/history`                                                                                |
| **Sports Exchange**| Sports Dashboard `/sports-dashboard`, Sports Betting `/sportsbeting`, Market Settlement `/MOsettle`, Fancy Settlement `/Fansettle` |
| **Sports Analytics**| Sports Dashboard `/sports-dashboard`                                                                  |
| **Transactions**   | Deposit `/deposit`, Withdraw `/withdraw`, Account Statement `/account-statement`                      |
| **Marketing**      | Gift Cards `/giftcard-admin`, Spin Wheel `/spinwheel`                                                 |
| **Settings**       | Site Config `/siteconfig`, Providers Priority, Vendor Priority, Type Priority                         |
| **Services**       | Notification `/notification`                                                                           |

(`Gaming` group exists in code but is commented out.)

### 4.2 Visibility logic

Two parallel mechanisms, resolved in `usePermissions`:

1. **Super roles** (`SuperAdmin`, `MotherAdmin`, `Admin`, `SubAdmin`, `Master`,
   `Agent`, `SubAgent`) → use a hard-coded `GROUP_ACCESS` whitelist (per role
   which group titles they see). They bypass per-key checks.

   ```ts
   GROUP_ACCESS = {
     SuperAdmin: ["Main","Admin","History","Sports Exchange","Gaming","Transactions","Marketing","Settings","Services"],
     Admin:      ["Agent Panel","Admin","History","Sports Analytics","Gaming","Transactions"],
     SubAdmin:   ["Agent Panel","Admin","Sports Analytics","History","Gaming","Transactions"],
     Master:     [ ...same as SubAdmin ],
     Agent:      [ ...same ],
     SubAgent:   [ ...same ],
     Executive:  [],   // executives use stored permissions, see §5/§8
   }
   ```

2. **Executives** → use their stored `StaffPermissions`: a group shows if
   `groupVisible(title)`, an item shows if `pageVisible(path)`.

---

## 5. Permission model

Single source of truth: `src/constants/permissions.ts`. Stored per non-super user
as **one JSON column** with three independent maps:

```ts
interface StaffPermissions {
  groups:    Record<string, boolean>;  // sidebar group title -> visible
  pages:     Record<string, boolean>;  // route path          -> visible
  authority: Record<string, boolean>;  // action key          -> granted
}
```

- **Group titles (11):** `Main`, `Agent Panel`, `Admin`, `History`,
  `Sports Exchange`, `Sports Analytics`, `Gaming`, `Transactions`, `Marketing`,
  `Settings`, `Services`.
- **Page paths (~38):** every route across all groups (see `ALL_PAGE_PATHS`).
- **Authority keys (24+):**

  | Category            | Keys                                                                                              |
  | ------------------- | ------------------------------------------------------------------------------------------------- |
  | User management     | `canCreateUser`, `canCreateAgent`, `canEditUser`, `canDeleteUser`, `canChangeUserPassword`, `canLockUser`, `canChangeCreditLimit`, `canChangeExposureLimit`, `canManageKYC` |
  | Transactions        | `canTransferCredit`, `canTransferCasino`, `canApproveDeposit`, `canApproveWithdraw`               |
  | Settlement          | `canSettleSports`, `canSettleFancy`, `canSettleCasino`                                             |
  | Marketing           | `canCreateRedeemCode`, `canIssueGiftCard`, `canIssueBonus`, `canSendNotification`                 |
  | Reports & config    | `canViewReports`, `canExportCSV`, `canEditSiteConfig`, `canEditPriorities`                         |
  | Access management   | `canManageStaff` (opens the Executives tab)                                                       |

- Helpers: `buildEmptyPermissions()` (all false), `buildFullPermissions()` (all true).
- `usePermissions()` exposes `{ isSuper, can(key), pageVisible(path), groupVisible(title), loading }`.
  Caches under `localStorage.myPermissions`; refreshed live via Socket.IO
  `myPermissionsUpdate`.

> **Security rule:** front-end gating is convenience only. The backend MUST
> re-enforce every authority key independently on each business endpoint
> (see §10.7).

---

## 6. Client Management module

Container: `src/components/AdminManagement.tsx` — a horizontal tab bar over an
`<Outlet/>`. Routes under `/admin-management`.

### 6.1 Tabs

| Tab id              | Label             | Component                  | Route                                  |
| ------------------- | ----------------- | -------------------------- | -------------------------------------- |
| `dashboard`         | Dashboard         | `DashboardTab`             | `/admin-management/dashboard`          |
| `agents`            | Agent Listing     | `AgentListingTab`          | `/admin-management/agents`             |
| `myaccount`         | My Account        | `MyAccountTab`             | `/admin-management/myaccount`          |
| `sports-settlement` | Sports Settlement | `SportsSettlementTab`      | `/admin-management/sports-settlement`  |
| `casino-settlement` | Casino Settlement | `CasinoSettlementTab`      | `/admin-management/casino-settlement`  |
| `access`            | Executives        | `AccessManagementTab`      | `/admin-management/access`             |

Active tab: text `#2B6EF5`, bg `rgba(43,110,245,0.08)`, 2px bottom border.

### 6.2 Admin hierarchy

```
SuperAdmin (0) → Admin, SubAdmin, Master, Agent, SubAgent, User
Admin      (1) → SubAdmin, User
SubAdmin   (2) → Master, User
Master     (3) → Agent, User
Agent      (4) → SubAgent, User
SubAgent   (5) → User
User       (6) → leaf (player)
```

Each level can only create roles **below** itself (`CHILD_ROLES` map). Locks and
financial roll-ups **propagate downward** through the subtree.

### 6.3 Agent Listing tab (`AgentListingTab.tsx`)

The operational heart of client management. Paginated table (25/page) of the
caller's downline, with drill-down breadcrumbs into each agent's own downline.

**Columns:** Login Name (→ Settings modal) · Account Type (STAFF/USER) · Credit
Limit · Available Credit · Net Exposure (orange if +) · Current % · Betting
Status · Status · Sports G/T (green +/red −) · Casino G/T · Actions.

**Actions per row:** credit deposit/withdraw · sports settlement · casino
settlement · drill into downline.

**Create Agent modal** (gated `canCreateAgent` || `canCreateUser`):
- Fields: Role (constrained by hierarchy), Login Name, Email (default
  `{username}@stake.com`), Password + Repeat, User Status, Bet Status, Credit
  Limit, User Rate (%), Notes, **Master/Transaction Password (required)**.
- Staff roles → `POST /api/staff`; User role → `POST /api/staff/players`.

**Settings modal (5 permission-gated tabs):**
1. Status (`canLockUser`) — user status + bet status radios.
2. Locks (`canLockUser`) — Sports / Casino / System lock toggles (propagate down).
3. Password (`canChangeUserPassword`) — new password.
4. Exposure Limit (`canChangeExposureLimit`) — number or blank = unlimited.

**Credit deposit/withdraw modal:** amount + transaction password →
`POST /lords/user-setting/credit-limit`.

**Settlement modals (sports/casino):** show current G/T (green ≥0 / red <0),
amount input (positive = collect, negative = pay), direction hint, transaction
password → `POST /lords/transfer` or `POST /lords/casino-transfer`.

Realtime: subscribes to `getUsersAllDetails` socket updates.

`Agent` row shape:
```ts
interface Agent {
  id: number; username: string; role: string; account_type: 'USER'|'STAFF';
  credit_limit: number; credit: number; available_credit: number;
  exposure: number; percentage: number;
  status: 'active'|'inactive'; bet_status: 'active'|'inactive';
  bet_locked: boolean; sports_locked: boolean; casino_locked: boolean; system_locked: boolean;
  exp_limit: number|null; gt: number; casino_gt: number; has_downline: boolean;
}
```

### 6.4 User Management tab (`UserManagementTab.tsx`)

CRUD over the staff hierarchy with an org-chart tree modal.
- Search (name/email/username/phone/country) + Role filter + Status filter.
- Columns: Client Details · Role · Phone (copy) · Percentage · Status toggle ·
  Balance · Under (parent) · Actions (Edit/Delete).
- Create/Edit form: First/Last name, Email, Username, Phone, Country, Role
  (constrained), Place Under (parent, create-only), Password + Confirm,
  Percentage (0–100, required for non-User).
- Endpoints: `GET /api/staff`, `GET /api/staff/tree`, `POST /api/staff`,
  `POST /api/staff/players`, `PATCH /api/staff/{id}` (profile or `{status}`),
  `DELETE /api/staff/{id}`, `DELETE /api/staff/players/{id}`.

### 6.5 Transfer tab (`TransferTab.tsx`)

Bulk **Sports G/T** settlement. Table of agents with editable transfer amount
per row + "All" quick-fill (`amount = -gt`), single Transaction Password field,
and a "Transfer All" button (sequential `POST /lords/transfer`, 1.2s spacing).
Per-row Done/Error status chips.

### 6.6 Dashboard tab (`DashboardTab.tsx`)

Analytics overview, auto-refresh every 5 min.
- Pulls: `updateCurrent()`, `getAllDetails()`, `getTransferStatement()`,
  `getCasinoTransferStatement()`, `GET /api/staff/transfers/summary`.
- 6-row grid: downline KPIs · transfer/settlement activity · pending G/T +
  registrations · trend charts (staff/player) · role distribution + top staff ·
  balance-by-role + recent activity.
- Role colours: SuperAdmin `#F9F9F9`, Admin `#E01B4F`, SubAdmin `#FFC23F`,
  Master `#2B6EF5`, Agent `#0ECC68`, SubAgent `#7B5EF5`, User `#8384A5`.

### 6.7 My Account tab (`MyAccountTab.tsx`)

- Cards: Profile · Agent Code (shareable link) · Password (SuperAdmin only) ·
  Add Balance (SuperAdmin only) · WhatsApp Referral · Executive Account
  (read-only, for logged-in executives).
- `canEdit` only when `role === "superadmin"`.
- Endpoints: `GET/PATCH /api/staff/{id}`, `PATCH /api/staff/password`,
  `POST /adminwalletadd`, `GET /lords/access/me/permissions`.

---

## 7. Risk Management (User side)

Risk Management is delivered through **two dialogs** (per-user and per-staff) plus a
**Net Exposure** monitor. The `RiskManagementTab.tsx` under admin-management is
currently a **stub** (icon + heading only) and is the place to surface a
consolidated risk dashboard if desired (see §10.6 for backend it would need).

### 7.1 `RiskManagementDialog.tsx` — per-user risk

Modal opened from a user row. Props `{ open, userId, onClose }`.

**Loads:** `GET /api/admin/user-risk/{userId}` → one `RiskData` object:

```ts
interface RiskData {
  currency: string;
  user: {
    id; name; email; country; phone; created; updated_at;
    level: number; games_played: number; two_fa_status: boolean;
    parent_staff_id: number|null; staff_name; staff_email;
    is_direct: boolean; last_ip; last_login_at;
  };
  locks: { is_locked: boolean; lock_targetx: boolean; sports_betlocked: boolean };
  financials: {
    total_deposit_inr; total_withdrawal_inr; net_inr: string;
    deposit_count; withdrawal_count: number;
  };
  activity: {
    source: string; distinct_ip_count: number; distinct_ips: string[];
    ip_breakdown: { ip; uses; first_seen; last_seen }[];
    recent_logins?: { time; ip; user_agent }[];   // last 15
    recent_bets: { time; ip; stake; status; result }[];  // last 10
  };
  risk_flags: {
    multiple_ips: boolean; two_fa_disabled: boolean;
    high_withdrawal_ratio: boolean; no_activity: boolean;
  };
  timestamp: string;
}
```

**Sections:** Profile · Financial Exposure (deposits/withdrawals/net + counts) ·
Network/IP Activity (distinct-IP chip, IP breakdown table, recent logins, recent
bets) · Risk Flags (yellow chips) · Lock Controls.

**Lock controls** — each toggle calls `POST /api/admin/user-lock` with
`{ user_id, <field>: boolean }`:
- `is_locked` — Account Lock ("Blocks all logins and activity").
- `sports_betlocked` — Sports Bet Lock ("Prevents sportsbook wagers").
- `lock_targetx` — Target Lock ("Flags user for monitoring").

Snackbar feedback; header refresh button re-fetches.

### 7.2 `StaffRiskDialog.tsx` — per-staff risk

Props `{ open, staffId, onClose }`. **Loads** `GET /api/admin/staff-risk/{staffId}`:

```ts
interface StaffRiskData {
  currency: string;
  staff: {
    id; name; email; country; phone;
    role_id; role_name; role_level;
    parent_id; parent_name; parent_email;
    percentage: number; first_login: boolean; created_at;
    balance_inr: number|string;
  };
  locks: { system_locked: boolean; sports_betlocked: boolean };
  parent_chain: { id; name; email; role_name; depth }[];   // upline
  downline: {
    direct_staff_count; subtree_staff_count; users_count; locked_users: number;
    total_deposits_inr; total_withdrawals_inr; net_inr: string;  // aggregated subtree
  };
  risk_flags: { first_login_pending; locked; no_downline: boolean };
  timestamp: string;
}
```

**Sections:** Profile (role, commission %, balance) · Upline chain · Downline
summary (direct/subtree staff, users, locked users) · Downline financials
(aggregated deposits/withdrawals/net) · Risk Flags · Lock Controls.

**Lock controls** — `POST /api/admin/staff-lock` with `{ staff_id, <field>: boolean }`:
- `system_locked` — System Lock ("Blocks staff + all descendants from logging in").
- `sports_betlocked` — Sports Bet Lock for the whole line.

### 7.3 `NetExposureTab.tsx` — live exposure monitor

Read-only, auto-refresh every **10 s** with a countdown chip + progress bar.

**Loads:** `getNetExposure(myId, userType)` →
`GET /lords/net-exposure/sports?userId={}&userType=USER|STAFF` →
`{ data: EventGroup[], meta: { totalExposure } }`.

```ts
interface EventGroup { eventId; eventName; category: string; markets: MarketEntry[]; }
interface MarketEntry { gameType; teamName: string; exposure: number; userName?; userId?; }
```

Total exposure header (red if positive liability / green otherwise); per-event
card with a market table (Runner · Game Type · Exposure · optional User).

### 7.4 Risk capabilities summary (USER side)

- View full user risk profile: financials, profile, KYC/2FA, lock state.
- Network forensics: distinct IPs, per-IP first/last seen + use count, last 15
  logins (IP + user agent), last 10 bets.
- Automatic risk flags: multiple IPs, 2FA disabled, high withdrawal ratio, no
  activity.
- Per-user locks: full account lock, sports bet lock, target/monitor flag.
- Per-staff: upline chain, downline counts, aggregated subtree financials,
  locked-user count, system lock (cascades), sports bet lock (cascades).
- Live net-exposure monitoring per event/market, auto-refreshing.

---

## 8. Executive Members (Access Management)

Full spec lives in [ACCESS_MANAGEMENT.md](ACCESS_MANAGEMENT.md). Summary:

Any hierarchy member with `canManageStaff` (or a super role) can mint
**Executives** — scoped sub-accounts (`role = 'Executive'`, `parent_user_id` =
creator) that act on the parent's behalf using a subset of the parent's
`StaffPermissions`.

Capabilities & endpoints (each mutation requires the parent's **Transaction
Password**):

| Capability                 | Endpoint                                                  |
| -------------------------- | --------------------------------------------------------- |
| List executives            | `GET /lords/access/executives?page&limit&search`          |
| Create executive           | `POST /lords/access/executives`                           |
| Edit pages/authority       | `PATCH /lords/access/executives/:id`                      |
| Reset password             | `PATCH /lords/access/executives/:id/password`             |
| Lock / unlock              | `PATCH /lords/access/executives/:id/lock`                 |
| Activity log               | `GET /lords/access/executives/:id/activity?page&limit&from&to` |
| Verify exec password       | `POST /api/staff/auth/executive/login` (raw fetch)        |
| Read own permissions       | `GET /lords/access/me/permissions`                        |

UI: `AccessManagementTab.tsx` (gated `isSuper || can('canManageStaff')`). Live
updates via socket events `executiveListUpdate`, `executiveActivityUpdate`,
`myPermissionsUpdate`. Backend writes one `executive_activity_log` row per
mutation an executive performs.

---

## 9. Full REST API contract

Base URL (current deployment): `https://api.stake.com`. All endpoints require
`Authorization: Bearer <jwt>` and `Content-Type: application/json`. `apiFetch`
clears storage + redirects to `/login` on 401.

### 9.1 Auth / session
| Method | Path                                   | Purpose                                  |
| ------ | -------------------------------------- | ---------------------------------------- |
| POST   | `/api/staff/auth/login` (login screen) | Issue JWT (`token`, `userRole`)          |
| POST   | `/api/staff/auth/first-login-password` | Force password change on first login     |
| POST   | `/api/staff/auth/executive/login`      | Verify executive password (no takeover)  |
| GET    | `/lords/access/me/permissions`         | Caller's role + `StaffPermissions`       |
| POST   | `/lords/update-current`                | Current user `{ id, name, role, level, credit }` |

### 9.2 Client / staff management
| Method | Path                                                             | Purpose                       |
| ------ | ---------------------------------------------------------------- | ----------------------------- |
| GET    | `/lords/users/all-details?page&limit&search&parentId`            | Downline listing (Agent rows) |
| GET    | `/api/staff`                                                     | All manageable staff          |
| GET    | `/api/staff/tree`                                               | Org-chart tree                |
| GET    | `/api/staff/{id}`                                               | Single staff profile          |
| POST   | `/api/staff`                                                     | Create staff (agent)          |
| POST   | `/api/staff/players`                                            | Create user (player)          |
| PATCH  | `/api/staff/{id}`                                              | Update profile / `{status}`   |
| PATCH  | `/api/staff/password`                                          | Change own password           |
| DELETE | `/api/staff/{id}`                                              | Delete staff                  |
| DELETE | `/api/staff/players/{id}`                                      | Delete user                   |
| POST   | `/adminwalletadd`                                              | SuperAdmin add balance        |
| GET    | `/api/admin/agent-users`                                       | Agent's direct users + staff  |
| GET    | `/getUserData`                                                | Direct users (players)        |

### 9.3 User settings (all require `transactionPassword`)
| Method | Path                                    | Body                                                   |
| ------ | --------------------------------------- | ------------------------------------------------------ |
| POST   | `/lords/user-setting/update-password`   | `{ userId, userType, newPassword, transactionPassword }` |
| POST   | `/lords/user-setting/status`            | `{ userId, userType, status/betStatus, transactionPassword }` |
| POST   | `/lords/user-setting/credit-limit`      | `{ userId, userType, creditLimit, transactionPassword }` |
| POST   | `/lords/user-setting/exposure-limit`    | `{ userId, userType, exposureLimit, transactionPassword }` |

### 9.4 Transfers / settlement (require `transactionPassword`)
| Method | Path                                          | Body / params                                          |
| ------ | --------------------------------------------- | ------------------------------------------------------ |
| POST   | `/lords/transfer`                             | `{ userId, amount, recieverType, transactionPassword }` (Sports G/T) |
| POST   | `/lords/casino-transfer`                      | `{ userId, amount, recieverType, transactionPassword }` (Casino G/T) |
| GET    | `/lords/transfer/statement?page&limit`        | Sports/balance transfer history                        |
| GET    | `/lords/casino-transfer/statement?page&limit` | Casino transfer history                                |
| GET    | `/api/staff/transfers/summary`                | `{ total_deposit, total_withdraw }`                    |

### 9.5 Risk management (USER side)
| Method | Path                                | Body                                              |
| ------ | ----------------------------------- | ------------------------------------------------- |
| GET    | `/api/admin/user-risk/{userId}`     | → `RiskData` (§7.1)                                |
| POST   | `/api/admin/user-lock`              | `{ user_id, is_locked?\|sports_betlocked?\|lock_targetx? }` |
| GET    | `/api/admin/staff-risk/{staffId}`   | → `StaffRiskData` (§7.2)                           |
| POST   | `/api/admin/staff-lock`             | `{ staff_id, system_locked?\|sports_betlocked? }` |
| GET    | `/lords/net-exposure/sports?userId&userType` | → `{ data: EventGroup[], meta: { totalExposure } }` |

### 9.6 Executives (Access Management) — see [ACCESS_MANAGEMENT.md](ACCESS_MANAGEMENT.md) §3
`GET/POST /lords/access/executives`, `PATCH /lords/access/executives/:id`,
`PATCH …/:id/password`, `PATCH …/:id/lock`, `GET …/:id/activity`.

### 9.7 Dashboard analytics
| Method | Path                              | Purpose                          |
| ------ | --------------------------------- | -------------------------------- |
| GET    | `/api/admin/dashboard`            | Platform deposits/withdrawals/net|
| GET    | `/api/admin/user-stats`           | User totals, trends, top countries |

### 9.8 Socket.IO (`/admin-panel` namespace, auth `{ token: 'Bearer <jwt>' }`)
| Client emit              | Server emits          | Stop event             |
| ------------------------ | --------------------- | ---------------------- |
| `getUsersAllDetails`     | `usersAllDetailsUpdate` | `stopUsersAllDetails` |
| `getExecutiveList`       | `executiveListUpdate` | `stopExecutiveList`    |
| `getExecutiveActivity`   | `executiveActivityUpdate` | `stopExecutiveActivity` |
| `getMyPermissions`       | `myPermissionsUpdate` | (off only)             |

Sockets are an enhancement; the UI degrades gracefully to REST polling if absent.

---

## 10. Backend functionality required (new + existing)

This is what the backend must implement to power the features above. Items marked
**NEW** are the additions a typical older admin backend won't already have.

### 10.1 Hierarchy-scoped staff/user CRUD (existing, must enforce hierarchy)
- A single `staff` table holding all roles incl. `User` and `Executive`, with a
  self-referencing `parent_user_id` and a `role`/`role_level`.
- Listing endpoints (`/lords/users/all-details`, `/api/staff`, `/api/staff/tree`)
  must return **only the caller's subtree** (or everything for super roles), with
  computed columns: `available_credit`, `exposure`, `gt` (sports G/T),
  `casino_gt`, `has_downline`, `bet_locked`, `sports_locked`, `casino_locked`,
  `system_locked`.
- Creation must reject roles not in the caller's `CHILD_ROLES`.

### 10.2 Transaction-password second factor — **NEW**
- Separate `transaction_password_hash` column (distinct from login password).
- **Every** mutating endpoint in §9.3, §9.4, and all executive mutations must
  verify it server-side, rate-limit failures, and log `auth.txn_password.fail`.

### 10.3 Credit / exposure ledger (existing, must support limits) 
- `credit_limit`, `available_credit`, `exposure`, `exp_limit` per account.
- `/lords/user-setting/credit-limit` and `/exposure-limit` adjust these atomically
  and write a transfer/ledger row.

### 10.4 G/T settlement engine — **NEW / extend**
- Track **Sports G/T** and **Casino G/T** per account (running win/loss owed
  between a parent and child).
- `/lords/transfer` (sports) and `/lords/casino-transfer` (casino): positive
  amount = parent collects from child, negative = parent pays child; updates both
  balances atomically and appends to `transfer` statement with
  `transfer_type ∈ {null|'gt'|'casino'}` and `direction ∈
  {deposit,withdraw,collect,pay}`.
- Statement endpoints with pagination + a `transfers/summary` aggregate.

### 10.5 Cascading locks — **NEW**
- Three lock flags per account: `system_locked` (blocks login), `sports_betlocked`
  (blocks sports wagers), `casino_locked`.
- Locking a **staff** node must cascade to its **entire subtree** (enforce at
  login + bet-placement time, ideally via a subtree query or a denormalised
  "effective lock" flag refreshed on change).
- Per-user `lock_targetx` monitoring flag + `is_locked` full lock.

### 10.6 Risk aggregation service — **NEW** (powers §7)
- `GET /api/admin/user-risk/{userId}`: join user profile + financial totals
  (deposits/withdrawals/net in INR + counts) + **IP/login forensics** (distinct
  IPs, per-IP first/last seen & use count, last 15 logins with user agent) + last
  10 bets + computed `risk_flags` (`multiple_ips`, `two_fa_disabled`,
  `high_withdrawal_ratio`, `no_activity`).
- `GET /api/admin/staff-risk/{staffId}`: profile + role + commission + balance +
  **upline chain** (recursive parent walk) + **downline rollup** (direct count,
  subtree count, users count, locked users, aggregated subtree
  deposits/withdrawals/net) + `risk_flags`.
- `POST /api/admin/user-lock` / `/api/admin/staff-lock`: toggle the lock flags
  above (staff lock cascades).
- `GET /lords/net-exposure/sports`: live per-event/market exposure with a total,
  scoped by `userType` (USER = that user only, STAFF = the subtree).
- Requires capturing **login IP + user agent history** and **bet IP** if not
  already stored (see schema §11.4).

### 10.7 Per-key authorization enforcement — **NEW**
- Look up the actor's stored `permissions.authority.<key>` on every business
  endpoint and `403` when false. Super roles bypass by role, but never trust the
  client's cached copy.
- Status gating: reject any actor whose `status != 'active'` with `423 Locked`.

### 10.8 Executive system — **NEW** (see [ACCESS_MANAGEMENT.md](ACCESS_MANAGEMENT.md))
- 8 REST routes, tenancy check (`parent_user_id == caller.id`), audit logging,
  optional JWT revocation on lock/password reset, live socket emits.

### 10.9 Realtime layer (optional but recommended)
- Socket.IO `/admin-panel` namespace emitting `usersAllDetailsUpdate`,
  `executiveListUpdate`, `executiveActivityUpdate`, `myPermissionsUpdate` so
  sidebars/tables refresh and revocations take effect immediately.

### 10.10 Dashboard analytics — **NEW / extend**
- `/api/admin/dashboard` and `/api/admin/user-stats` aggregates (deposits/
  withdrawals by method, net balance, registration trends, top countries).
- `/api/staff/transfers/summary` for the management dashboard.

---

## 11. Database schema

Minimum schema to back everything above (`snake_case`; `JSON` works on MySQL ≥5.7
/ Postgres `JSONB`). The Executive-specific tables are detailed in
[ACCESS_MANAGEMENT.md §5](ACCESS_MANAGEMENT.md); the additions here cover Client
and Risk Management.

### 11.1 `staff` (all roles incl. User & Executive)
| Column                       | Type                                   | Notes                                        |
| ---------------------------- | -------------------------------------- | -------------------------------------------- |
| `id`                         | BIGINT PK AI                           |                                              |
| `username`                   | VARCHAR(64) UNIQUE                      | login handle                                 |
| `email`                      | VARCHAR(190) NULL                      |                                              |
| `phone`, `country`           | VARCHAR                                |                                              |
| `password_hash`              | VARCHAR(255)                           | bcrypt / argon2                              |
| `transaction_password_hash`  | VARCHAR(255)                           | **NEW** second factor                        |
| `role`                       | VARCHAR(32)                            | SuperAdmin…User, Executive                   |
| `role_level`                 | SMALLINT                               | 0–6                                          |
| `parent_user_id`             | BIGINT NULL FK→staff.id                | hierarchy / executive parent                 |
| `percentage`                 | DECIMAL(5,2)                           | commission                                   |
| `status`                     | ENUM('active','inactive','locked')     | default active                               |
| `permissions`                | JSON NULL                              | `StaffPermissions` (non-super only)          |
| `credit_limit`               | DECIMAL(18,2)                          |                                              |
| `available_credit`           | DECIMAL(18,2)                          |                                              |
| `exposure`                   | DECIMAL(18,2)                          |                                              |
| `exp_limit`                  | DECIMAL(18,2) NULL                     | null = unlimited                             |
| `gt`                         | DECIMAL(18,2)                          | **NEW** sports G/T balance                   |
| `casino_gt`                  | DECIMAL(18,2)                          | **NEW** casino G/T balance                   |
| `system_locked`              | BOOL                                   | **NEW** cascades                             |
| `sports_betlocked`           | BOOL                                   | **NEW**                                      |
| `casino_locked`              | BOOL                                   | **NEW**                                      |
| `lock_targetx`               | BOOL                                   | **NEW** per-user monitor flag                |
| `two_fa_status`              | BOOL                                   |                                              |
| `first_login`                | BOOL                                   |                                              |
| `last_login_at`,`last_login_ip` | DATETIME / VARCHAR(45)              |                                              |
| `created_at`,`updated_at`    | DATETIME                               |                                              |

Indexes: `UNIQUE(username)`, `INDEX(parent_user_id, role)`,
`INDEX(parent_user_id, status)`.

### 11.2 `transfer` (balance + G/T statement) — **NEW / extend**
| Column          | Type                                              | Notes                              |
| --------------- | ------------------------------------------------- | ---------------------------------- |
| `id`            | BIGINT PK AI                                      |                                    |
| `from_type`     | ENUM('staff','user')                              |                                    |
| `from_id`       | BIGINT                                            |                                    |
| `to_type`       | ENUM('staff','user')                              |                                    |
| `to_id`         | BIGINT                                            |                                    |
| `amount`        | DECIMAL(18,2)                                     |                                    |
| `direction`     | ENUM('deposit','withdraw','collect','pay')        | balance vs G/T semantics           |
| `transfer_type` | ENUM('gt','casino') NULL                          | null = balance, gt = sports        |
| `created_at`    | DATETIME (indexed)                                |                                    |

Index: `INDEX(from_id, created_at DESC)`, `INDEX(to_id, created_at DESC)`.

### 11.3 `login_history` — **NEW** (powers IP forensics in §7.1)
| Column        | Type            | Notes              |
| ------------- | --------------- | ------------------ |
| `id`          | BIGINT PK AI    |                    |
| `user_id`     | BIGINT FK       | staff/user id      |
| `ip`          | VARCHAR(45)     | indexed            |
| `user_agent`  | VARCHAR(255)    |                    |
| `created_at`  | DATETIME        | indexed            |

Index: `INDEX(user_id, created_at DESC)`, `INDEX(user_id, ip)`.

### 11.4 `bet_history` (must store `ip` for forensics) — extend
Ensure each bet row carries `user_id`, `ip`, `stake`, `currency`, `status`,
`result`, `created_at` so the risk dialog's "recent bets" + exposure can be built.

### 11.5 `executive_activity_log` — see [ACCESS_MANAGEMENT.md §5.2](ACCESS_MANAGEMENT.md)
Append-only audit of every executive mutation (`executive_id`, `parent_user_id`,
`action`, `target_type/id`, `details` JSON, `ip`, `user_agent`, `created_at`).

### 11.6 (Optional) `staff_session`
JWT `jti` tracking for revocation on lock / password reset (see
[ACCESS_MANAGEMENT.md §5.3](ACCESS_MANAGEMENT.md)).

---

## 12. Porting checklist

To upgrade your previous admin panel to this state:

1. **Theme:** copy `src/theme.ts` + the `:root` block of `src/index.css`; load
   Montserrat. Wrap the app in MUI `ThemeProvider`.
2. **Shell:** port `Layout.tsx` (sidebar + sticky appbar + outlet) and
   `Sidebar.tsx` (groups/items + `GROUP_ACCESS`).
3. **Permissions:** copy `constants/permissions.ts` verbatim (group titles, page
   paths, authority keys must match the backend exactly) and `hooks/usePermissions`.
4. **API layer:** point `BASE` in `utils/api.ts` and `SOCKET_URL` in
   `services/socketService.ts` at your backend; port `services/lordsApi.ts`.
5. **Client Management:** port `AdminManagement.tsx` + the 6 tabs; implement the
   §9.2–§9.4 endpoints with hierarchy + transaction-password enforcement (§10.1–10.4).
6. **Risk Management:** port `RiskManagementDialog`, `StaffRiskDialog`,
   `NetExposureTab`; implement §9.5 endpoints + the aggregation service (§10.6) and
   add `login_history` + bet `ip` (§11.3–11.4).
7. **Executives:** follow [ACCESS_MANAGEMENT.md](ACCESS_MANAGEMENT.md) end to end
   (§10.8) — `AccessManagementTab`, the 8 routes, audit log table, socket emits.
8. **Cascading locks (§10.5)** + **per-key authorization (§10.7)** enforced
   server-side.
9. **Realtime (optional):** add the `/admin-panel` Socket.IO namespace + events.
10. **Smoke test order:** login → `GET /lords/access/me/permissions` → sidebar
    renders by role → Agent Listing loads downline → create agent/user → credit
    transfer → G/T settle → open user-risk + staff-risk dialogs → toggle locks →
    create + edit + lock an executive → check activity log.

---

*Generated from the live `adminpanel` source (`theme.ts`, `Layout.tsx`,
`Sidebar.tsx`, `AdminManagement.tsx` + tabs, `users/RiskManagementDialog.tsx`,
`users/StaffRiskDialog.tsx`, `admin-management/NetExposureTab.tsx`,
`constants/permissions.ts`, `services/lordsApi.ts`). Pair with
[ACCESS_MANAGEMENT.md](ACCESS_MANAGEMENT.md) for the Executive feature.*
