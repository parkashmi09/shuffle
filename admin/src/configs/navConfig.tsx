// Third-party Imports
import type * as Icon from 'lucide-react'

type IconName = keyof typeof Icon

export type MenuLeafSubItem = {
  label: string
  href: string
  activePath?: string
  badge?: string
  badgeClassName?: string
  target?: '_blank' | '_self' | '_parent' | '_top'
  /** Any one of these grants shows the entry. Absent = everyone signed in. */
  permission?: string | string[]
  /** Hidden when this operator flag is off (`sports`, `casino`, …). */
  flag?: string
}

export type MenuGroupSubItem = {
  label: string
  childItems: MenuLeafSubItem[]
  permission?: string | string[]
  flag?: string
}

export type MenuSubItem = MenuLeafSubItem | MenuGroupSubItem

export type MenuItem = {
  icon: IconName
  label: string
  permission?: string | string[]
  flag?: string
} & (
  | {
      href: string
      badge?: string
      badgeClassName?: string
      childItems?: never
      target?: '_blank' | '_self' | '_parent' | '_top'
    }
  | {
      href?: never
      badge?: string
      badgeClassName?: string
      childItems: MenuSubItem[]
    }
)

export type NavItem = {
  groupLabel?: string
  items: MenuItem[]
}

/**
 * The operator menu. Permissions are the platform's `resource:action` grants
 * (see ADMIN-FEATURE-INVENTORY.md); the sidebar hides what the current role
 * cannot reach and the page still refuses server-side, so this is a courtesy,
 * not the guard.
 */
export const navItems: NavItem[] = [
  {
    items: [{ icon: 'LayoutDashboard', label: 'Dashboard', href: '/dashboard', permission: 'reports:read' }]
  },
  {
    groupLabel: 'Players',
    items: [
      { icon: 'Users', label: 'Players', href: '/players', activePath: '/players', permission: 'users:read' } as MenuItem,
      { icon: 'ShieldCheck', label: 'KYC', href: '/kyc', permission: 'users:read' },
      { icon: 'Landmark', label: 'Bank details', href: '/bank-details', permission: 'users:read' }
    ]
  },
  {
    groupLabel: 'Finance',
    items: [
      {
        icon: 'ArrowDownToLine',
        label: 'Deposits',
        permission: 'deposits:read',
        childItems: [
          { label: 'Fiat', href: '/deposits/fiat' },
          { label: 'Crypto', href: '/deposits/crypto' },
          { label: 'Payment orders', href: '/deposits/orders' }
        ]
      },
      {
        icon: 'ArrowUpFromLine',
        label: 'Withdrawals',
        permission: 'withdrawals:read',
        childItems: [
          { label: 'Fiat', href: '/withdrawals/fiat' },
          { label: 'Crypto', href: '/withdrawals/crypto' }
        ]
      },
      { icon: 'Wallet', label: 'Wallets', href: '/wallets', permission: 'wallet:read' },
      { icon: 'ArrowLeftRight', label: 'Transfers', href: '/transfers', permission: 'staff:read' },
      { icon: 'Coins', label: 'Exchange rates', href: '/exchange-rates', permission: 'config:read' },
      { icon: 'Vault', label: 'Vault', href: '/vault', permission: 'wallet:read' },
      { icon: 'Handshake', label: 'P2P trading', href: '/p2p', permission: 'wallet:read' }
    ]
  },
  {
    groupLabel: 'Promotions',
    items: [
      { icon: 'Gift', label: 'Bonus', href: '/bonus', permission: 'wallet:read', flag: 'bonus' },
      { icon: 'Ticket', label: 'Redeem codes', href: '/redeem-codes', permission: 'wallet:read' },
      { icon: 'CreditCard', label: 'Gift cards', href: '/gift-cards', permission: 'wallet:read', flag: 'giftcards' },
      { icon: 'Disc3', label: 'Spin wheel', href: '/spin-wheel', permission: 'config:read', flag: 'wheelspin' },
      { icon: 'Crown', label: 'VIP & club', href: '/vip', permission: 'config:read', flag: 'vipclub' },
      { icon: 'Link', label: 'Affiliate', href: '/affiliate', permission: 'config:read', flag: 'affiliate' },
      { icon: 'Trophy', label: 'Races', href: '/races', permission: 'config:read' }
    ]
  },
  {
    groupLabel: 'Casino',
    items: [
      {
        icon: 'Dices',
        label: 'Casino',
        permission: 'casino:read',
        flag: 'casino',
        childItems: [
          { label: 'Game catalogue', href: '/casino/games' },
          { label: 'Curation & priority', href: '/casino/curation' },
          { label: 'In-house games', href: '/casino/in-house' },
          { label: 'Bet history', href: '/casino/bets' },
          { label: 'Wager report', href: '/casino/wager-report' }
        ]
      }
    ]
  },
  {
    groupLabel: 'Sports',
    items: [
      {
        icon: 'Goal',
        label: 'Sports',
        permission: 'sports:read',
        flag: 'sports',
        childItems: [
          { label: 'Bets', href: '/sports/bets' },
          { label: 'Settlement', href: '/sports/settlement', permission: 'sports:settle' },
          { label: 'Results', href: '/sports/results' },
          { label: 'Catalogue & locks', href: '/sports/catalogue' },
          { label: 'Wager report', href: '/sports/wager-report' }
        ]
      }
    ]
  },
  {
    groupLabel: 'Team',
    items: [
      { icon: 'Network', label: 'Staff & agents', href: '/staff', activePath: '/staff', permission: 'staff:read' } as MenuItem,
      { icon: 'KeyRound', label: 'Executives', href: '/access/executives', permission: 'staff:read' },
      { icon: 'Megaphone', label: 'Marketing', href: '/marketing', permission: 'staff:read' },
      { icon: 'ScrollText', label: 'Activity log', href: '/audit', permission: 'audit:read' }
    ]
  },
  {
    groupLabel: 'Content',
    items: [
      { icon: 'Image', label: 'Banners', href: '/content/banners', permission: 'config:read' },
      { icon: 'Newspaper', label: 'Blogs', href: '/content/blogs', permission: 'config:read' },
      { icon: 'Bell', label: 'Notifications', href: '/content/notifications', permission: 'config:write' }
    ]
  },
  {
    groupLabel: 'Reports',
    items: [
      { icon: 'FileBarChart', label: 'Player reports', href: '/reports/players', permission: 'reports:read' },
      { icon: 'BookOpen', label: 'Statements', href: '/reports/statements', permission: 'reports:read' },
      { icon: 'ShieldAlert', label: 'Risk', href: '/reports/risk', permission: 'reports:read' }
    ]
  },
  {
    groupLabel: 'Settings',
    items: [
      {
        icon: 'Settings2',
        label: 'Site config',
        permission: 'config:read',
        childItems: [
          { label: 'Features', href: '/site-config/features' },
          { label: 'Feature flags', href: '/site-config/flags' },
          { label: 'Affiliate rates', href: '/site-config/affiliate' },
          { label: 'Email (SMTP)', href: '/site-config/email' },
          { label: 'Sports switch', href: '/site-config/sports' }
        ]
      },
      { icon: 'UserCog', label: 'My account', href: '/account' }
    ]
  }
]
