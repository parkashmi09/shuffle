/**
 * What THIS client's frontend can draw — and so what the owner panel offers for it.
 *
 * shuffle runs its own fixed UI (`frontend/`, Vite). It has one layout per feature, so a
 * layout "variant" changes nothing there; only ON/OFF and the policies do.
 * Each catalogue feature is one of:
 *
 *   toggle  the UI has a screen for it; when off the backend refuses its API. The owner gets an
 *           ON/OFF switch only; the variant is pinned to `variant`.
 *   fixed   part of the UI that cannot be hidden here (the casino lobby, the home hero). Always on,
 *           pinned to `variant`; no switch, because "off" would leave a visible section that the
 *           backend refuses.
 *   absent  the UI has no screen for it (`why` says what is there instead). Shown as "Not in this UI",
 *           always off (variant `none`), so the backend refuses it too.
 *
 * `variant` is the backend catalogue key the site row is stored with (a valid variant of that
 * feature, the one closest to this UI). The owner's save pins every row to this table
 * (`pinToUi` in lib/entitlements/store.ts), so the document can never say otherwise.
 */

export const UI_LABEL = 'Site UI'

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

/** Owner options that do nothing in this UI (their page does not exist here). Hidden, value kept. */
export const HIDDEN_OPTIONS = new Set(['races.tournaments_page'])

export const uiSupport = (feature: string): UiSupport | null => SITE_UI[feature] ?? null

/** The variant this UI pins a feature to when it is on; `none` for a feature it does not have. */
export const pinnedVariant = (feature: string): string | null => {
  const s = SITE_UI[feature]

  if (!s) return null

  return s.status === 'absent' ? 'none' : s.variant
}

/**
 * Pins a document's features and variants to this UI. A toggle keeps the owner's ON/OFF; a fixed
 * feature is always on; an absent one always off. Policies and unknown keys pass through.
 */
export function pinToUi(features: Record<string, boolean>, variants: Record<string, string>) {
  const f = { ...features }
  const v = { ...variants }

  for (const [key, s] of Object.entries(SITE_UI)) {
    if (s.status === 'absent') {
      v[key] = 'none'
      f[key] = false
    } else {
      v[key] = s.variant
      if (s.status === 'fixed') f[key] = true
    }
  }

  return { features: f, variants: v }
}
