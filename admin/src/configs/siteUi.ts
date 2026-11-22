/**
 * What THIS client's frontend can draw — the same table as the owner panel's
 * (owner-panel/src/configs/siteUi.ts; keep the two equal). shuffle runs its own fixed UI
 * (`frontend/`), which has one layout per feature, so the Features page shows a feature as
 * "This site's UI" (no variant name), "Always on in this UI" or "Not in this UI". Staff see
 * this, so no other site's name appears in any label here.
 * The values themselves still come from the backend (the owner's document), read-only.
 */

export const UI_LABEL = "This site's UI"

export type UiSupport = { status: 'toggle'; variant: string; surfaces: string } | { status: 'fixed'; variant: string; surfaces: string } | { status: 'absent'; why: string }

export const SITE_UI: Record<string, UiSupport> = {
  vip: { status: 'toggle', variant: 'program_page', surfaces: '/vip-program (public page signed out; overview, rewards and levels signed in), header VIP panel' },
  promotions: { status: 'toggle', variant: 'tile_grid', surfaces: '/promotions tiles with All/Casino/Sports tabs, /promotions/:slug and /sports/promotions/:slug articles' },
  bonus: { status: 'toggle', variant: 'reward_cards', surfaces: 'rakeback, daily, weekly and monthly reward cards plus Daily Reload / Pre-Monthly cards on /vip-program and in the VIP panel, Daily Reload calendar on /vip-program; redeem-code modal from the user menu' },
  affiliate: { status: 'toggle', variant: 'marketing_dashboard', surfaces: '/affiliate marketing page, /affiliate/overview, referred-users, campaigns, earnings' },
  races: { status: 'toggle', variant: 'tournaments', surfaces: 'home tournaments carousel, Weekly Race tab on the activity board, race info modal with a History tab of settled races' },
  challenges: { status: 'toggle', variant: 'multiplier_grid', surfaces: '/challenges grid with Live/Finished tabs, a signed-in Quests tab (daily quests), medal strip on Settings → Account' },
  raffles: { status: 'toggle', variant: 'ticket_raffle', surfaces: 'Raffle dialog from the user menu: weekly draw countdown, prize pool, my tickets, free ticket claim, last draw winners' },
  vault: { status: 'toggle', variant: 'term_lock', surfaces: 'Vault modal from the user menu, with lock-period picker, interest earned and vault transactions' },
  swap: { status: 'toggle', variant: 'wallet_tab', surfaces: 'wallet Swap tab: server-quoted fee, swap, last 8 swaps' },
  tips: { status: 'toggle', variant: 'peer_to_peer', surfaces: 'wallet Tip tab with username lookup (POST /user/tip/send), Accept Tips switch in Settings → Preferences' },
  notifications: { status: 'toggle', variant: 'side_panel', surfaces: 'right-side notification panel with filter chips and unread count' },
  kyc: { status: 'toggle', variant: 'status_card', surfaces: '/settings/verify status cards (L1 details, L2 ID)' },
  gift_cards: { status: 'toggle', variant: 'claim_cards', surfaces: 'Gift Cards tab of the redeem dialog (user menu): activate, deposit/wager progress, claim, claimed history' },
  blog: { status: 'toggle', variant: 'category_feed', surfaces: '/blog category tabs over the site admin blogs, /blog/:slug' },

  casino_lobby: { status: 'fixed', variant: 'aggregator', surfaces: 'the casino lobby is the site itself; use the Casino flag and the game-category flags' },
  banners: { status: 'fixed', variant: 'image_carousel', surfaces: "the home hero carousel (site admin banners, placement 'home')" },

  push_notifications: { status: 'toggle', variant: 'onesignal', surfaces: 'OneSignal web push, loaded only when the backend says push is on' },

  spin_wheel: { status: 'toggle', variant: 'inline_wheel', surfaces: 'Spin Wheel dialog from the user menu: wheel, eligibility, spin (deposit-bonus code), your spins' },
  chat: { status: 'absent', why: 'The header Chat button is disabled; there is no chat screen.' },
  club_membership: { status: 'absent', why: 'No club screens in this UI.' },
  analytics: { status: 'toggle', variant: 'gtm', surfaces: 'Google Tag Manager container (the owner-set containerId) loaded on every player page when on' },
  live_tv: { status: 'toggle', variant: 'gated', surfaces: 'the TV button on a sports match (minimum balance and inactive hours under Settings)' },
  bonus_centre: { status: 'toggle', variant: 'block', surfaces: 'Bonus Centre block on /vip-program: my codes, bonus history, bonus games, events (needs Bonus on)' }
}

export const uiSupport = (feature: string): UiSupport | null => SITE_UI[feature] ?? null
