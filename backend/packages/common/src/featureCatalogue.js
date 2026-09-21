'use strict';

/**
 * The feature catalogue — every feature a site can offer, the named ways it
 * can be offered, and the site templates that pick one of each.
 *
 * GENERATED FROM the "Variant catalogue" block of docs/FEATURE-COMPARISON.md,
 * where every variant is traced to the file that implements it. Change the
 * doc and regenerate; the integrations (push, analytics) and the business
 * policies below are hand-written.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY VARIANTS AND NOT MORE FLAGS
 *
 * Three sites run this platform and each implements the same feature its own
 * way: the VIP club is a 41-level ladder on one, bc.game's 34-level ladder on
 * another. A boolean cannot say which. A variant can, and it is ONE value per
 * feature per site rather than one column per site per feature — adding a
 * fourth site adds rows, not a migration.
 *
 * Each site has its own database, so the SELECTION lives in that site's
 * `site_features` table. This file is the MENU: the same everywhere, so a
 * variant key means the same thing wherever it is stored.
 *
 * A variant is listed only where a site actually implements it. A dropdown
 * option that switches a feature "on" with nothing behind it would be a
 * promise the page cannot keep. Where two sites implement a feature the same
 * way they share one key (`flat` for the vault); `external` is a link out.
 *
 * ── THE KEYS ARE A CONTRACT ─────────────────────────────────────────────
 *
 * A front end reads `variant` from `GET /admin/features/public` and decides
 * what to draw. Renaming a key silently turns that feature off on every site
 * that stored the old one. Add keys; do not rename them.
 *
 * `flag` names the `siteconfig` column that gates the same feature, where one
 * exists; the features service keeps it in step.
 * ═════════════════════════════════════════════════════════════════════════
 */

const GENERATED = [
    {
      "key": "vip",
      "label": "VIP club",
      "category": "engagement",
      "flag": "vipclub",
      "variants": [
        {
          "key": "program_page",
          "label": "Program page with ladder",
          "description": "/vip-program: marketing page signed out; signed in, overview, rewards grid and the tiered ladder, drawn from GET /user/vip and /user/vip/levels.",
          "builtFor": "shuffle"
        },
        {
          "key": "ring_panel",
          "label": "Header ring and detail page",
          "description": "/vip-detail page (a dialog on phones), header ring and /user/enter panel, over hash-games' own 34-level ladder (data/vipConfig.js).",
          "builtFor": "hash-games"
        },
        {
          "key": "club_slider",
          "label": "Club page with ranking slider",
          "description": "/vip-club page with banner, ranking slider, progress bar, benefits and FAQ; tier names from stake's own card map (api/vip.js).",
          "builtFor": "stake-site"
        },
        {
          "key": "club_ladder",
          "label": "Club page with a 75-level ladder",
          "description": "/vip-club page with the level ring, bonus table and per-tier levels accordion, over Addaplay's own 75-level ladder (VIP 01\u2013VIP 75, brownz\u2192diamond). Selecting it switches the BACKEND ladder: GET /user/vip, /user/vip/levels, USER_INFO, the bonus gates (VIP 20/25/30) and the player reports all rank on it (packages/common/src/vipLadders.js).",
          "builtFor": "addaplay"
        },
        {
          "key": "none",
          "label": "Off",
          "description": "No VIP surface."
        }
      ]
    },
    {
      "key": "promotions",
      "label": "Promotions",
      "category": "engagement",
      "flag": null,
      "variants": [
        {
          "key": "tile_grid",
          "label": "Tile grid with tabs",
          "description": "/promotions tile grid with All/Casino/Sports tabs and pagination, plus a full article page per promotion. Hard-coded content.",
          "builtFor": "shuffle"
        },
        {
          "key": "event_list",
          "label": "Event list with archive",
          "description": "Event list with tabs and an archive popup, plus a separate /deposit-offer nth-deposit bonus page. Fixtures.",
          "builtFor": "hash-games"
        },
        {
          "key": "promo_cards",
          "label": "Promo card grid",
          "description": "Short promo card grid below the live wheel, bonus centre and gift cards on /promotions; on the home page for signed-out visitors.",
          "builtFor": "stake-site"
        },
        {
          "key": "none",
          "label": "Off",
          "description": "No promotions surface."
        }
      ]
    },
    {
      "key": "spin_wheel",
      "label": "Spin wheel",
      "category": "engagement",
      "flag": "wheelspin",
      "variants": [
        {
          "key": "inline_wheel",
          "label": "Inline wheel on promotions",
          "description": "Inline SVG wheel on /promotions drawn from GET /user/spin-wheel/slices; free first spin, then cooldown plus deposit; issues a deposit-bonus redeem code.",
          "builtFor": "stake-site"
        },
        {
          "key": "none",
          "label": "Off",
          "description": "No wheel."
        }
      ]
    },
    {
      "key": "gift_cards",
      "label": "Gift cards",
      "category": "engagement",
      "flag": "giftcards",
      "variants": [
        {
          "key": "claim_cards",
          "label": "Activate-then-claim cards",
          "description": "Activate-then-claim card list with deposit and wager progress and claimed history, on /promotions.",
          "builtFor": "stake-site"
        },
        {
          "key": "none",
          "label": "Off",
          "description": "No gift card surface."
        }
      ]
    },
    {
      "key": "bonus",
      "label": "Bonus and rakeback",
      "category": "engagement",
      "flag": "bonus",
      "variants": [
        {
          "key": "reward_cards",
          "label": "Reward cards inside the VIP page",
          "description": "Four reward cards (instant rakeback, daily, weekly, monthly) inside the signed-in VIP page, plus a redeem-code modal from the user menu.",
          "builtFor": "shuffle"
        },
        {
          "key": "reward_hub",
          "label": "Reward hub page",
          "description": "/bonus hub in bc.game's reward-type layout with claim-all, a level card, a VIP panel and a Free Plays dialog (GIS free spins).",
          "builtFor": "hash-games"
        },
        {
          "key": "bonus_centre",
          "label": "Bonus centre block",
          "description": "Compact block on /promotions: redeem box, rakeback, recurring bonuses with socket countdowns, the player's codes and recent events.",
          "builtFor": "stake-site"
        },
        {
          "key": "none",
          "label": "Off",
          "description": "No bonus surface."
        }
      ]
    },
    {
      "key": "affiliate",
      "label": "Affiliate / referral",
      "category": "engagement",
      "flag": "affiliate",
      "variants": [
        {
          "key": "marketing_dashboard",
          "label": "Marketing page and dashboard",
          "description": "Public /affiliate marketing page plus a four-tab signed-in dashboard (overview, referred users, campaigns, earnings).",
          "builtFor": "shuffle"
        },
        {
          "key": "referral_hub",
          "label": "Referral hub",
          "description": "/referral-exhibition marketing plus a multi-section /referral dashboard with referral codes, a rewards table and a rate calculator.",
          "builtFor": "hash-games"
        },
        {
          "key": "single_page",
          "label": "Single affiliate page",
          "description": "Single /affiliate page: overview and link, commission rules, and an available-commission claim-all block.",
          "builtFor": "stake-site"
        },
        {
          "key": "none",
          "label": "Off",
          "description": "No affiliate surface."
        }
      ]
    },
    {
      "key": "races",
      "label": "Races and leaderboards",
      "category": "engagement",
      "flag": null,
      "variants": [
        {
          "key": "tournaments",
          "label": "Tournaments carousel and board tab",
          "description": "Home tournaments carousel, a 'Weekly Race' tab on the activity board and a race info modal; reads the prize-less bet-history leaderboard.",
          "builtFor": "shuffle"
        },
        {
          "key": "daily_contest",
          "label": "Daily contest page",
          "description": "/promotions/daily-contest page plus a contest tab on the home Latest Bets board; a wager contest with the visitor's rank.",
          "builtFor": "hash-games"
        },
        {
          "key": "race_boards",
          "label": "Daily and weekly race boards",
          "description": "Real user/race module: /races daily and weekly boards with operator prize pools, claimable rewards, and a home Races slider when signed in.",
          "builtFor": "stake-site"
        },
        {
          "key": "none",
          "label": "Off",
          "description": "No race or contest surface."
        }
      ]
    },
    {
      "key": "challenges",
      "label": "Challenges / quests",
      "category": "engagement",
      "flag": null,
      "variants": [
        {
          "key": "multiplier_grid",
          "label": "Multiplier grid",
          "description": "Multiplier-challenge grid ('first to hit Nx with min bet') with Live/Finished tabs; cards do not open a game. No backend.",
          "builtFor": "shuffle"
        },
        {
          "key": "quest_hub",
          "label": "Quest hub with achievements",
          "description": "Signed-in quest hub (in progress, completed, expired) plus achievement medals on the profile. Fixtures, no backend.",
          "builtFor": "hash-games"
        },
        {
          "key": "live_multiplier",
          "label": "Multiplier grid over live games",
          "description": "Multiplier-challenge grid with sorting whose cards open real in-house games, beside the bets leaderboard. Terms hard-coded, no backend.",
          "builtFor": "stake-site"
        },
        {
          "key": "none",
          "label": "Off",
          "description": "No challenges surface."
        }
      ]
    },
    {
      "key": "raffles",
      "label": "Raffles / lottery / airdrop",
      "category": "engagement",
      "flag": "lotto",
      "variants": [
        {
          "key": "token_suite",
          "label": "Token suite: lottery, airdrop, token page",
          "description": "SHFL lottery page, airdrop page, token page and an airdrop tab on the activity board. Hard-coded, no backend.",
          "builtFor": "shuffle"
        },
        {
          "key": "ticket_raffle",
          "label": "Weekly ticket raffle",
          "description": "Weekly ticket raffle page (jackpot, prize ladder, winners, my tickets) plus a home rail of external lottery draws. Fixtures, no backend.",
          "builtFor": "hash-games"
        },
        {
          "key": "none",
          "label": "Off",
          "description": "No raffle or lottery surface."
        }
      ]
    },
    {
      "key": "vault",
      "label": "Vault",
      "category": "wallet",
      "flag": null,
      "variants": [
        {
          "key": "flat_balance",
          "label": "Flat balance",
          "description": "One balance in and out; transfer-in uses the shortest active lock term, transfer-out closes unlocked deposits. shuffle draws it as a header modal, bc.game as the /wallet/vault tab. Shared by shuffle and hash-games."
        },
        {
          "key": "term_lock",
          "label": "Term locks with a period picker",
          "description": "Vault modal with a lock-period picker and per-deposit rows over GET /user/vault and /lock-options.",
          "builtFor": "stake-site"
        },
        {
          "key": "none",
          "label": "Off",
          "description": "No vault."
        }
      ]
    },
    {
      "key": "swap",
      "label": "Swap",
      "category": "wallet",
      "flag": null,
      "variants": [
        {
          "key": "swap_page",
          "label": "Full swap page",
          "description": "Full-page /wallet/swap with 25/50/75/100% buttons, a USD min/max clamp and a completion popup; live estimate and trade.",
          "builtFor": "hash-games"
        },
        {
          "key": "wallet_tab",
          "label": "Swap tab in the wallet",
          "description": "Swap tab in the wallet modal with the server-quoted fee, and the last 8 swaps; live over HTTP.",
          "builtFor": "stake-site"
        },
        {
          "key": "none",
          "label": "Off",
          "description": "No swap."
        }
      ]
    },
    {
      "key": "chat",
      "label": "Chat / social / presence",
      "category": "content",
      "flag": null,
      "variants": [
        {
          "key": "drawer",
          "label": "Chat drawer",
          "description": "Multi-language chat drawer with rich cards, rich list, emoji and GIF pickers, plus /chat-public on phones. Fixtures today.",
          "builtFor": "hash-games"
        },
        {
          "key": "right_rail",
          "label": "Right-rail chat with tip and rain",
          "description": "Two-room right-rail chat with tip and rain, friends and online counters, all live over the platform socket and GET /user/presence.",
          "builtFor": "stake-site"
        },
        {
          "key": "none",
          "label": "Off",
          "description": "No chat (the chat icon is hidden or disabled)."
        }
      ]
    },
    {
      "key": "notifications",
      "label": "Notifications",
      "category": "content",
      "flag": null,
      "variants": [
        {
          "key": "side_panel",
          "label": "Side panel with filters",
          "description": "Right-sidebar notification panel with filter chips. Not wired yet: the /user/notifications calls are declared but unused.",
          "builtFor": "shuffle"
        },
        {
          "key": "notice_centre",
          "label": "Notice centre with unread counts",
          "description": "Notice list over GET /user/notifications with unread counts, read and read-all, plus a comments tab.",
          "builtFor": "hash-games"
        },
        {
          "key": "header_bell",
          "label": "Header bell dropdown",
          "description": "Header bell dropdown (full-screen on phones). Not wired yet: always the empty state.",
          "builtFor": "stake-site"
        },
        {
          "key": "none",
          "label": "Off",
          "description": "No notification surface."
        }
      ]
    },
    {
      "key": "banners",
      "label": "Hero banners",
      "category": "content",
      "flag": "home_heroSection",
      "variants": [
        {
          "key": "image_carousel",
          "label": "Image carousel",
          "description": "Wide image-only carousel from placement 'home' (one row); falls back to captured slides.",
          "builtFor": "shuffle"
        },
        {
          "key": "artwork_slides",
          "label": "Artwork slides",
          "description": "bc.game slides whose artwork is replaced by placements home_top_1..N; title and link stay captured.",
          "builtFor": "hash-games"
        },
        {
          "key": "card_slides",
          "label": "Card slides with title and CTA",
          "description": "Card slides built from every 'hero-*' placement with a title: operator title, subtitle and CTA.",
          "builtFor": "stake-site"
        },
        {
          "key": "none",
          "label": "Off",
          "description": "No hero."
        }
      ]
    },
    {
      "key": "blog",
      "label": "Blog",
      "category": "content",
      "flag": null,
      "variants": [
        {
          "key": "tile_grid",
          "label": "Tile grid with article pages",
          "description": "Tile-grid blog with pagination and full article pages; the same layout as promotions. Captured posts today.",
          "builtFor": "shuffle"
        },
        {
          "key": "external_link",
          "label": "Link to an off-site blog",
          "description": "Sidebar link to an off-site blog; nothing hosted."
        },
        {
          "key": "category_feed",
          "label": "Category-tabbed feed",
          "description": "Category-tabbed feed over GET /admin/blogs; post pages are captured only.",
          "builtFor": "stake-site"
        },
        {
          "key": "none",
          "label": "Off",
          "description": "No blog."
        }
      ]
    },
    {
      "key": "casino_lobby",
      "label": "Casino lobby",
      "category": "casino",
      "flag": "casino",
      "variants": [
        {
          "key": "aggregator",
          "label": "Aggregator-first lobby",
          "description": "Aggregator-first: rows from casino/games collections, category and provider browsing, favourites, recently played, js-games v2 launch.",
          "builtFor": "shuffle"
        },
        {
          "key": "tabbed_themes",
          "label": "Tabbed themes lobby",
          "description": "Tabbed lobby with themes, sections and tag pages; originals from js-games v1, the rest fixtures; favourites and recent live.",
          "builtFor": "hash-games"
        },
        {
          "key": "in_house",
          "label": "In-house-first lobby",
          "description": "In-house-first: js-games v1 curated collections, socket originals, 'Continue Playing' from bet history; no favourites.",
          "builtFor": "stake-site"
        },
        {
          "key": "none",
          "label": "Off",
          "description": "Casino hidden."
        }
      ]
    },
    {
      "key": "club_membership",
      "label": "Club membership",
      "category": "engagement",
      "flag": "clubmembership",
      "variants": [
        {
          "key": "none",
          "label": "Off",
          "description": "No site implements clubs yet; the user/club and club-broadcasts backend is unused."
        }
      ]
    },
    {
      "key": "kyc",
      "label": "KYC",
      "category": "wallet",
      "flag": null,
      "variants": [
        {
          "key": "status_card",
          "label": "Status card in settings",
          "description": "Status-only two-level card (L1 details, L2 ID) in settings; no upload.",
          "builtFor": "shuffle"
        },
        {
          "key": "document_cockpit",
          "label": "Document cockpit with uploads",
          "description": "Verification cockpit with document type, uploads (JPEG/PNG/PDF, 5 MB) and status panes mapped from all five platform statuses.",
          "builtFor": "hash-games"
        },
        {
          "key": "requirement_list",
          "label": "Requirement list with inline submit",
          "description": "Requirement-list settings tab with an inline submit form and the raw platform status.",
          "builtFor": "stake-site"
        },
        {
          "key": "none",
          "label": "Off",
          "description": "Verification hidden."
        }
      ]
    }
  ];

const PUSH_NOTIFICATIONS = {
  key: 'push_notifications',
  label: 'Push notifications',
  category: 'integration',
  flag: null,
  variants: [
    {
      key: 'onesignal',
      label: 'OneSignal',
      description: 'Web push through OneSignal. Players are targeted by their platform id (external_id).',
      /** Shown to the browser. The App ID is public by design — the web SDK needs it. */
      publicFields: ['appId'],
      configFields: [
        { key: 'appId', label: 'OneSignal App ID', required: true, pattern: '^[0-9a-fA-F-]{36}$' },
        { key: 'segment', label: 'Test segment', required: false, placeholder: 'Subscribed Users' },
      ],
      /** Sealed at rest in `secrets`; never returned by any route. */
      secretFields: [{ key: 'apiKey', label: 'REST API key', required: true }],
    },
    { key: 'fcm', label: 'Firebase (FCM)', description: 'The legacy device-token path. Needs a Firebase service account on the backend.' },
    { key: 'none', label: 'Off', description: 'Notifications are recorded in the inbox but not pushed.' },
  ],
};

/**
 * Site analytics — which Google tag the player pages load, and its id.
 *
 * Hand-written, like the push integration. Both ids are PUBLIC by design (the
 * browser loads the tag with them), so they are `publicFields` and reach the
 * page through `GET /admin/features/public` and the socket's `getSiteConfig`.
 * The front end injects the tag itself; nothing is hard-coded in its HTML.
 */
const ANALYTICS = {
  key: 'analytics',
  label: 'Analytics (Google tag)',
  category: 'integration',
  flag: null,
  variants: [
    {
      key: 'gtm',
      label: 'Google Tag Manager',
      description: 'Loads the GTM container; GA4 and every other tag are configured inside it.',
      publicFields: ['containerId'],
      configFields: [{ key: 'containerId', label: 'GTM container ID', required: true, pattern: '^GTM-[A-Z0-9]{4,12}$', placeholder: 'GTM-XXXXXXX' }],
    },
    {
      key: 'gtag',
      label: 'Google Analytics 4 (gtag.js)',
      description: 'Loads gtag.js directly with one GA4 measurement id — no container.',
      publicFields: ['measurementId'],
      configFields: [{ key: 'measurementId', label: 'GA4 measurement ID', required: true, pattern: '^G-[A-Z0-9]{4,12}$', placeholder: 'G-XXXXXXXXXX' }],
    },
    { key: 'none', label: 'Off', description: 'No analytics tag is loaded.' },
  ],
};

/**
 * Business policies — hand-written, like the integration above.
 *
 * `kind: 'policy'` means always in force: there is no on/off switch, only the
 * variant, and a site that never chose one reads `defaultVariant` — which is
 * today's behaviour, so adding these closed nobody's cashier. `none` closes
 * the channel. Templates never set these; a template silently reopening a
 * cashier an operator had closed is the wrong direction to fail in.
 * Enforced in the services by packages/common/src/sitePolicy.js.
 */
const POLICIES = [
  {
    key: 'business_model',
    label: 'Business model',
    category: 'business',
    kind: 'policy',
    flag: null,
    defaultVariant: 'hybrid',
    variants: [
      { key: 'b2c', label: 'B2C — direct players', description: 'Anyone may sign up and use the cashier themselves.' },
      { key: 'b2b', label: 'B2B — agent network', description: 'Public sign-up is closed. Players are created by agents in the staff tree and funded by transfer.' },
      { key: 'hybrid', label: 'Hybrid', description: 'Public sign-up is open, and agents may also create and fund players. The default.' },
    ],
  },
  {
    key: 'deposit_mode',
    label: 'Deposits',
    category: 'business',
    kind: 'policy',
    flag: null,
    defaultVariant: 'both',
    variants: [
      { key: 'automatic', label: 'Automatic only', description: 'Gateway and crypto deposits, credited by the provider callback. Manual transfer submissions are refused.' },
      { key: 'manual', label: 'Manual only', description: 'The player submits a transfer reference and screenshot; staff approve it. Gateway and crypto deposits are refused.' },
      { key: 'both', label: 'Automatic and manual', description: 'Both routes are open. The default.' },
      { key: 'none', label: 'Closed', description: 'No new deposits. Pending ones can still be approved, and provider callbacks still credit.' },
    ],
  },
  {
    key: 'withdrawal_mode',
    label: 'Withdrawals',
    category: 'business',
    kind: 'policy',
    flag: null,
    defaultVariant: 'both',
    variants: [
      { key: 'automatic', label: 'Automatic only', description: 'Paid out by the gateway (needs AUTO_WITHDRAWALS_ENABLED on the backend). Manual requests are refused.' },
      { key: 'manual', label: 'Manual only', description: 'The player requests; the cashier team reviews and pays by hand. Gateway payouts are refused.' },
      { key: 'both', label: 'Automatic and manual', description: 'Both routes are open. The default.' },
      { key: 'none', label: 'Closed', description: 'No new withdrawal requests. Pending ones can still be decided.' },
    ],
  },
];

const FEATURES = Object.freeze([...POLICIES, ...GENERATED, PUSH_NOTIFICATIONS, ANALYTICS]);

/**
 * Site templates — the dropdown when a site is created. Each is the set of
 * variants that clone implements today; any feature can then be changed alone.
 */
const TEMPLATES = Object.freeze({
    "shuffle": {
      "label": "Shuffle clone",
      "description": "The shuffle.com layout: VIP page, promotions, weekly race, flat vault, KYC in settings.",
      "variants": {
        "vip": "program_page",
        "promotions": "tile_grid",
        "spin_wheel": "none",
        "gift_cards": "none",
        "bonus": "reward_cards",
        "affiliate": "marketing_dashboard",
        "races": "tournaments",
        "challenges": "multiplier_grid",
        "raffles": "token_suite",
        "vault": "flat_balance",
        "swap": "none",
        "chat": "none",
        "notifications": "side_panel",
        "banners": "image_carousel",
        "blog": "tile_grid",
        "casino_lobby": "aggregator",
        "club_membership": "none",
        "kyc": "status_card",
        "push_notifications": "none"
      }
    },
    "bcgame": {
      "label": "BC.Game clone (hash-games)",
      "description": "The bc.game layout: 34-level VIP club, bonus hub, drawer chat, swap, an external blog link.",
      "variants": {
        "vip": "ring_panel",
        "promotions": "event_list",
        "spin_wheel": "none",
        "gift_cards": "none",
        "bonus": "reward_hub",
        "affiliate": "referral_hub",
        "races": "daily_contest",
        "challenges": "quest_hub",
        "raffles": "ticket_raffle",
        "vault": "flat_balance",
        "swap": "swap_page",
        "chat": "drawer",
        "notifications": "notice_centre",
        "banners": "artwork_slides",
        "blog": "external_link",
        "casino_lobby": "tabbed_themes",
        "club_membership": "none",
        "kyc": "document_cockpit",
        "push_notifications": "none"
      }
    },
    "stake": {
      "label": "Stake clone",
      "description": "The stake.com layout: races, spin wheel, gift cards, chat with presence, vault, blog.",
      "variants": {
        "vip": "club_slider",
        "promotions": "promo_cards",
        "spin_wheel": "inline_wheel",
        "gift_cards": "claim_cards",
        "bonus": "bonus_centre",
        "affiliate": "single_page",
        "races": "race_boards",
        "challenges": "live_multiplier",
        "raffles": "none",
        "vault": "term_lock",
        "swap": "wallet_tab",
        "chat": "right_rail",
        "notifications": "header_bell",
        "banners": "card_slides",
        "blog": "category_feed",
        "casino_lobby": "in_house",
        "club_membership": "none",
        "kyc": "requirement_list",
        "push_notifications": "none"
      }
    },
    "addaplay": {
      "label": "Addaplay (the platform's own front end)",
      "description": "The reference front end over this platform's own routes: Addaplay's 75-level VIP ladder, spin wheel, gift cards, bonus centre, affiliate, swap and blog; no races, chat or club.",
      "variants": {
        "vip": "club_ladder",
        "promotions": "promo_cards",
        "spin_wheel": "inline_wheel",
        "gift_cards": "claim_cards",
        "bonus": "bonus_centre",
        "affiliate": "single_page",
        "races": "none",
        "challenges": "none",
        "raffles": "none",
        "vault": "none",
        "swap": "wallet_tab",
        "chat": "none",
        "notifications": "header_bell",
        "banners": "card_slides",
        "blog": "category_feed",
        "casino_lobby": "in_house",
        "club_membership": "none",
        "kyc": "requirement_list",
        "push_notifications": "none"
      }
    }
  });

/**
 * What a variant used to be called, per feature.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────
 *
 * The variants were named after the clone each one was built from —
 * `shuffle`, `bcgame`, `stake` — which told an operator nothing: "Stake-style
 * lobby" is not a choice anyone outside this repo can make. They are named
 * for what they ARE now (`in_house`, `aggregator`, `tabbed_themes`), and a
 * stored row still holding an old name is read through this map.
 *
 * The provenance is not lost: each variant carries `builtFor`, so the site it
 * came from is still one field away for anyone porting a screen.
 *
 * Migration 048 rewrites the rows; this map is what makes the deploy that
 * precedes it, and any client still sending an old name, keep working.
 */
const LEGACY_VARIANTS = Object.freeze({
    "vip": {
      "shuffle": "program_page",
      "bcgame": "ring_panel",
      "stake": "club_slider",
      "addaplay": "club_ladder"
    },
    "promotions": {
      "shuffle": "tile_grid",
      "bcgame": "event_list",
      "stake": "promo_cards"
    },
    "spin_wheel": {
      "stake": "inline_wheel"
    },
    "gift_cards": {
      "stake": "claim_cards"
    },
    "bonus": {
      "shuffle": "reward_cards",
      "bcgame": "reward_hub",
      "stake": "bonus_centre"
    },
    "affiliate": {
      "shuffle": "marketing_dashboard",
      "bcgame": "referral_hub",
      "stake": "single_page"
    },
    "races": {
      "shuffle": "tournaments",
      "bcgame": "daily_contest",
      "stake": "race_boards"
    },
    "challenges": {
      "shuffle": "multiplier_grid",
      "bcgame": "quest_hub",
      "stake": "live_multiplier"
    },
    "raffles": {
      "shuffle": "token_suite",
      "bcgame": "ticket_raffle"
    },
    "vault": {
      "flat": "flat_balance",
      "stake": "term_lock"
    },
    "swap": {
      "bcgame": "swap_page",
      "stake": "wallet_tab"
    },
    "chat": {
      "bcgame": "drawer",
      "stake": "right_rail"
    },
    "notifications": {
      "shuffle": "side_panel",
      "bcgame": "notice_centre",
      "stake": "header_bell"
    },
    "banners": {
      "shuffle": "image_carousel",
      "bcgame": "artwork_slides",
      "stake": "card_slides"
    },
    "blog": {
      "shuffle": "tile_grid",
      "external": "external_link",
      "stake": "category_feed"
    },
    "casino_lobby": {
      "shuffle": "aggregator",
      "bcgame": "tabbed_themes",
      "stake": "in_house"
    },
    "kyc": {
      "shuffle": "status_card",
      "bcgame": "document_cockpit",
      "stake": "requirement_list"
    }
  });

/** The current key for a variant name, old or new. Unknown names pass through. */
const resolveVariantKey = (feature, variant) => LEGACY_VARIANTS[feature]?.[variant] ?? variant;

const FEATURE_KEYS = Object.freeze(FEATURES.map((f) => f.key));
const TEMPLATE_KEYS = Object.freeze(Object.keys(TEMPLATES));

/** The variant a feature reads when nothing is stored. */
const defaultVariantOf = (key) => featureByKey(key)?.defaultVariant ?? 'none';
const isPolicy = (key) => featureByKey(key)?.kind === 'policy';

const featureByKey = (key) => FEATURES.find((f) => f.key === key) ?? null;
const variantOf = (featureKey, variantKey) =>
  featureByKey(featureKey)?.variants.find((v) => v.key === variantKey) ?? null;

// Fail at require time, not at the first operator click, if a template names a
// feature or a variant the catalogue does not have.
for (const [name, template] of Object.entries(TEMPLATES)) {
  for (const [feature, variant] of Object.entries(template.variants)) {
    if (!variantOf(feature, variant)) {
      throw new Error(`featureCatalogue: template "${name}" sets ${feature}=${variant}, which is not a variant of that feature`);
    }
  }
}

module.exports = { FEATURES, TEMPLATES, FEATURE_KEYS, TEMPLATE_KEYS, featureByKey, variantOf, defaultVariantOf, isPolicy, LEGACY_VARIANTS, resolveVariantKey };
