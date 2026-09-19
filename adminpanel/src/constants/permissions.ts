/* ─────────────────────────────────────────────────────────────────
   Access Management — single source of truth.
   Sidebar visibility, route guards, and the AccessManagementTab UI
   all derive from these tables.
   ───────────────────────────────────────────────────────────────── */

import { SHUFFLE_PAGE_GROUPS } from './shuffleNav';

export interface PageDef {
  path: string;
  label: string;
}

export interface GroupDef {
  title: string;
  pages: PageDef[];
}

export interface AuthorityDef {
  key: string;
  label: string;
  description?: string;
}

/* ── Pages, organised by sidebar group (Shuffle operator scope) ── */
export const PAGE_GROUPS: GroupDef[] = SHUFFLE_PAGE_GROUPS;

/* ── Action-level authority toggles ────────────────────────────── */
export const AUTHORITY_GROUPS: { title: string; items: AuthorityDef[] }[] = [
  {
    title: "User Management",
    items: [
      { key: "canCreateUser",        label: "Create User" },
      { key: "canCreateAgent",       label: "Create Agent / Staff" },
      { key: "canEditUser",          label: "Edit User" },
      { key: "canDeleteUser",        label: "Delete User" },
      { key: "canChangeUserPassword",label: "Reset User Password" },
      { key: "canLockUser",          label: "Lock / Unlock User" },
      { key: "canChangeExposureLimit", label: "Change Exposure Limit" },
      { key: "canManageKYC",         label: "Manage KYC" },
    ],
  },
  {
    title: "Transactions",
    items: [
      { key: "canDepositWithdraw",   label: "Deposit / Withdraw Funds",
        description: "Move real money between this account and its downline." },
      { key: "canApproveDeposit",    label: "Approve / Reject Deposit" },
      { key: "canApproveWithdraw",   label: "Approve / Reject Withdraw" },
    ],
  },
  {
    title: "Settlement",
    items: [
      { key: "canSettleSports",      label: "Sports / Market Settlement" },
      { key: "canSettleFancy",       label: "Fancy Settlement" },
    ],
  },
  {
    title: "Marketing",
    items: [
      { key: "canCreateRedeemCode",  label: "Create Redeem Code" },
      { key: "canIssueGiftCard",     label: "Issue Gift Card" },
      { key: "canIssueBonus",        label: "Issue Bonus" },
      { key: "canSendNotification",  label: "Send Notification" },
    ],
  },
  {
    title: "Reports & Config",
    items: [
      { key: "canViewReports",       label: "View Reports" },
      { key: "canExportCSV",         label: "Export Data (CSV)" },
      { key: "canEditSiteConfig",    label: "Edit Site Config" },
      { key: "canEditPriorities",    label: "Edit Providers / Vendors / Type Priority" },
    ],
  },
  {
    title: "Access Management",
    items: [
      {
        key: "canManageStaff",
        label: "Manage Executives",
        description: "Allows this user to open Access Management and create / edit / view activity for their executives.",
      },
    ],
  },
];

/* Flat list of all authority keys — handy for default state */
export const ALL_AUTHORITY_KEYS: string[] = AUTHORITY_GROUPS.flatMap(g =>
  g.items.map(i => i.key)
);

/**
 * Maps Access Management toggles to gateway permission strings.
 * Without this, keys like `canCreateRedeemCode` are stored verbatim and rejected
 * by the server as unknown grants.
 */
export const AUTHORITY_BACKEND_GRANTS: Record<string, string[]> = {
  canCreateUser: ['users:write'],
  canCreateAgent: ['staff:write'],
  canEditUser: ['users:write'],
  canDeleteUser: ['users:delete'],
  canChangeUserPassword: ['users:write'],
  canLockUser: ['users:lock'],
  canChangeExposureLimit: ['users:write'],
  canManageKYC: ['users:write'],
  canDepositWithdraw: ['wallet:credit', 'wallet:debit'],
  canApproveDeposit: ['deposits:approve'],
  canApproveWithdraw: ['withdrawals:approve'],
  canSettleSports: ['sports:settle'],
  canSettleFancy: ['sports:settle'],
  canCreateRedeemCode: ['redeem:write'],
  canIssueGiftCard: ['wallet:credit'],
  canIssueBonus: ['wallet:credit'],
  canSendNotification: ['config:write'],
  canViewReports: ['reports:read'],
  canExportCSV: ['reports:read'],
  canEditSiteConfig: ['config:write', 'config:read'],
  canEditPriorities: ['config:write', 'casino:manage'],
  canManageStaff: ['staff:write'],
};

export const ALL_GROUP_TITLES: string[] = PAGE_GROUPS.map(g => g.title);

export const ALL_PAGE_PATHS: string[] = Array.from(
  new Set(PAGE_GROUPS.flatMap(g => g.pages.map(p => p.path)))
);

/* ── Permission shape stored per staff row ─────────────────────── */
export interface StaffPermissions {
  /** group title -> visible (overrides individual page when false) */
  groups: Record<string, boolean>;
  /** route path -> visible */
  pages: Record<string, boolean>;
  /** authority key -> granted */
  authority: Record<string, boolean>;
}

export const buildEmptyPermissions = (): StaffPermissions => ({
  groups: Object.fromEntries(ALL_GROUP_TITLES.map(t => [t, false])),
  pages: Object.fromEntries(ALL_PAGE_PATHS.map(p => [p, false])),
  authority: Object.fromEntries(ALL_AUTHORITY_KEYS.map(k => [k, false])),
});

export const buildFullPermissions = (): StaffPermissions => ({
  groups: Object.fromEntries(ALL_GROUP_TITLES.map(t => [t, true])),
  pages: Object.fromEntries(ALL_PAGE_PATHS.map(p => [p, true])),
  authority: Object.fromEntries(ALL_AUTHORITY_KEYS.map(k => [k, true])),
});

/* Agent-hierarchy roles short-circuit the permission system.
   They use the legacy GROUP_ACCESS whitelist in Sidebar.tsx and have full
   `can()` authority — their scope is constrained by role level (CHILD_ROLES)
   rather than per-key permission flags. Only "Executive" runs through
   usePermissions() / lordsApi.getMyPermissions(). */
/**
 * Compare role names WITHOUT spacing or case.
 *
 * The `roles` table spells them with a space — `Super Admin`, `Sub Admin`,
 * `Super Master` — and every list in this app spells them closed-up. An exact
 * match therefore succeeded only for the three that happen to be one word
 * (`Admin`, `Master`, `Agent`) and silently failed for the rest, including the
 * platform owner. Normalise on both sides of every role comparison.
 */
export const roleKey = (name: string) => String(name || '').replace(/[\s_-]+/g, '').toLowerCase();

export const SUPER_ROLES = [
  "SuperAdmin",
  "MotherAdmin",
  "Admin",
  "SubAdmin",
  "Master",
  "Agent",
  "SubAgent",
  /** Platform owner alias used in some DB seeds */
  "SuperMaster",
] as const;

/* ── Retired authority keys ────────────────────────────────────────
   The credit-limit / G-T-settlement model is gone. Executives created
   before the change still carry these keys in their stored permissions,
   so DEPOSIT_WITHDRAW_KEYS is what callers should check: the new key,
   plus the legacy ones it replaced. That way nobody silently loses the
   ability to move money at deploy time.
   ──────────────────────────────────────────────────────────────── */
export const DEPOSIT_WITHDRAW_KEYS = [
  "canDepositWithdraw",
  "canChangeCreditLimit",  // legacy
  "canTransferCredit",     // legacy
  "canTransferCasino",     // legacy
] as const;
