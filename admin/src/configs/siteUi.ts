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
  bonus: { status: 'toggle', variant: 'reward_cards', surfaces: 'rakeback, daily, weekly and monthly reward cards on /vip-program and in the VIP panel; redeem-code modal from the user menu' },
  affiliate: { status: 'toggle', variant: 'marketing_dashboard', surfaces: '/affiliate marketing page, /affiliate/overview, referred-users, campaigns, earnings' },
  races: { status: 'toggle', variant: 'tournaments', surfaces: 'home tournaments carousel, Weekly Race tab on the activity board, race info modal' },
  challenges: { status: 'toggle', variant: 'multiplier_grid', surfaces: '/challenges grid with Live/Finished tabs' },
  raffles: { status: 'absent', why: 'No raffle screen; /lottery is the token lottery page, not a raffle.' },
  vault: { status: 'toggle', variant: 'term_lock', surfaces: 'Vault modal from the user menu, with lock-period picker' },
  swap: { status: 'absent', why: 'The wallet has Deposit, Withdraw, Buy Crypto and Tip tabs; no Swap screen.' },
  tips: { status: 'absent', why: 'The wallet Tip tab is a layout only; it calls no tip API.' },
  notifications: { status: 'toggle', variant: 'side_panel', surfaces: 'right-side notification panel with filter chips and unread count' },
  kyc: { status: 'toggle', variant: 'status_card', surfaces: '/settings/verify status cards (L1 details, L2 ID)' },
  gift_cards: { status: 'absent', why: 'No gift-card screen; the redeem modal redeems bonus codes (Bonus).' },
  blog: { status: 'toggle', variant: 'category_feed', surfaces: '/blog category tabs over the site admin blogs, /blog/:slug' },

  casino_lobby: { status: 'fixed', variant: 'aggregator', surfaces: 'the casino lobby is the site itself; use the Casino flag and the game-category flags' },
  banners: { status: 'fixed', variant: 'image_carousel', surfaces: "the home hero carousel (site admin banners, placement 'home')" },

  push_notifications: { status: 'toggle', variant: 'onesignal', surfaces: 'OneSignal web push, loaded only when the backend says push is on' },

  spin_wheel: { status: 'absent', why: 'No wheel screen in this UI.' },
  chat: { status: 'absent', why: 'The header Chat button is disabled; there is no chat screen.' },
  club_membership: { status: 'absent', why: 'No club screens in this UI.' },
  analytics: { status: 'absent', why: 'This UI does not load a Google tag.' },
  live_tv: { status: 'absent', why: 'The match page Live Stream switch is cosmetic; no stream is played.' }
}

export const uiSupport = (feature: string): UiSupport | null => SITE_UI[feature] ?? null
