/**
 * Sidebar + Access Management pages that are in scope for Shuffle.
 *
 * Sports admin is omitted until `services/sports` boots (see docs). Routes stay
 * in App.tsx but are not linked here, so operators are not sent to screens
 * that only 404 against a down sports service.
 */
export interface ShuffleNavPage {
  path: string;
  label: string;
}

export interface ShuffleNavGroup {
  title: string;
  pages: ShuffleNavPage[];
}

export const SHUFFLE_PAGE_GROUPS: ShuffleNavGroup[] = [
  {
    title: 'Main',
    pages: [
      { path: '/admin-dashboard', label: 'Dashboard' },
      { path: '/users', label: 'Users' },
      { path: '/reports', label: 'User Reports' },
      { path: '/kyc', label: 'User KYC' },
      { path: '/wallet', label: 'Wallet' },
      { path: '/redeemcode', label: 'Redeem Codes' },
      { path: '/turnover-report', label: 'Turnover Report' },
    ],
  },
  {
    title: 'Agent Panel',
    pages: [
      { path: '/admin-dashboard', label: 'Dashboard' },
      { path: '/users', label: 'Users' },
    ],
  },
  {
    title: 'Admin',
    pages: [
      { path: '/admin-management', label: 'Client Management' },
      { path: '/activity-log', label: 'Activity Log' },
      { path: '/percentage-hierarchy', label: 'Percentage Hierarchy' },
    ],
  },
  {
    title: 'Cash Flow',
    pages: [{ path: '/vaultpro', label: 'Vault Pro' }],
  },
  {
    title: 'History',
    pages: [{ path: '/history', label: 'Bet History' }],
  },
  {
    title: 'Transactions',
    pages: [
      { path: '/deposit', label: 'Deposit' },
      { path: '/withdraw', label: 'Withdraw' },
      { path: '/account-statement', label: 'Account Statement' },
    ],
  },
  {
    title: 'Marketing',
    pages: [
      { path: '/affiliate', label: 'Affiliate' },
      { path: '/giftcard-admin', label: 'Gift Cards' },
      { path: '/spinwheel', label: 'Spin Wheel' },
      { path: '/races', label: 'Races' },
      { path: '/blog', label: 'Blog' },
      { path: '/promotions', label: 'Promotions' },
    ],
  },
  {
    title: 'Settings',
    pages: [
      { path: '/siteconfig', label: 'Site Config' },
      { path: '/providers-priority', label: 'Providers Priority' },
      { path: '/vendor-priority', label: 'Vendor Priority' },
      { path: '/type-priority', label: 'Type Priority' },
      { path: '/trending-games', label: 'Trending Games' },
      { path: '/only-on-stake', label: 'Only on Shuffle' },
    ],
  },
  {
    title: 'Services',
    pages: [{ path: '/notification', label: 'Notification' }],
  },
];

/** Legacy GROUP_ACCESS whitelist keys → sidebar group titles. */
export const SHUFFLE_GROUP_ACCESS: Record<string, string[]> = {
  SuperAdmin: [
    'Main',
    'Admin',
    'Cash Flow',
    'History',
    'Transactions',
    'Marketing',
    'Settings',
    'Services',
  ],
  MotherAdmin: [
    'Main',
    'Admin',
    'Cash Flow',
    'History',
    'Transactions',
    'Marketing',
    'Settings',
    'Services',
  ],
  Admin: ['Agent Panel', 'Admin', 'History', 'Transactions'],
  SubAdmin: ['Agent Panel', 'Admin', 'History', 'Transactions'],
  Master: ['Agent Panel', 'Admin', 'History', 'Transactions'],
  Agent: ['Agent Panel', 'Admin', 'History', 'Transactions'],
  SubAgent: ['Agent Panel', 'Admin', 'History', 'Transactions'],
  Executive: [],
};
