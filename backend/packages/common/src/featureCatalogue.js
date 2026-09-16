'use strict';

/**
 * The feature catalogue — every feature a site can offer, the named ways it
 * can be offered, and the site templates that pick one of each.
 *
 * GENERATED FROM the "Variant catalogue" block of docs/FEATURE-COMPARISON.md,
 * where every variant is traced to the file that implements it. Change the
 * doc and regenerate; the push-notification integration below is the one
 * hand-written entry.
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
        "key": "shuffle",
        "label": "Shuffle-style VIP",
        "description": "/vip-program: marketing page signed out; signed in, overview, rewards grid and the tiered ladder, drawn from GET /user/vip and /user/vip/levels."
      },
      {
        "key": "bcgame",
        "label": "bc.game-style VIP",
        "description": "/vip-detail page (a dialog on phones), header ring and /user/enter panel, over hash-games' own 34-level ladder (data/vipConfig.js)."
      },
      {
        "key": "stake",
        "label": "Stake-style VIP",
        "description": "/vip-club page with banner, ranking slider, progress bar, benefits and FAQ; tier names from stake's own card map (api/vip.js)."
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
        "key": "shuffle",
        "label": "Shuffle-style promotions",
        "description": "/promotions tile grid with All/Casino/Sports tabs and pagination, plus a full article page per promotion. Hard-coded content."
      },
      {
        "key": "bcgame",
        "label": "bc.game-style promotions",
        "description": "Event list with tabs and an archive popup, plus a separate /deposit-offer nth-deposit bonus page. Fixtures."
      },
      {
        "key": "stake",
        "label": "Stake-style promotions",
        "description": "Short promo card grid below the live wheel, bonus centre and gift cards on /promotions; on the home page for signed-out visitors."
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
        "key": "stake",
        "label": "Stake-style wheel",
        "description": "Inline SVG wheel on /promotions drawn from GET /user/spin-wheel/slices; free first spin, then cooldown plus deposit; issues a deposit-bonus redeem code."
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
        "key": "stake",
        "label": "Stake-style gift cards",
        "description": "Activate-then-claim card list with deposit and wager progress and claimed history, on /promotions."
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
        "key": "shuffle",
        "label": "Shuffle-style rewards",
        "description": "Four reward cards (instant rakeback, daily, weekly, monthly) inside the signed-in VIP page, plus a redeem-code modal from the user menu."
      },
      {
        "key": "bcgame",
        "label": "bc.game-style bonus hub",
        "description": "/bonus hub in bc.game's reward-type layout with claim-all, a level card, a VIP panel and a Free Plays dialog (GIS free spins)."
      },
      {
        "key": "stake",
        "label": "Stake-style bonus centre",
        "description": "Compact block on /promotions: redeem box, rakeback, recurring bonuses with socket countdowns, the player's codes and recent events."
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
        "key": "shuffle",
        "label": "Shuffle-style affiliate",
        "description": "Public /affiliate marketing page plus a four-tab signed-in dashboard (overview, referred users, campaigns, earnings)."
      },
      {
        "key": "bcgame",
        "label": "bc.game-style referral",
        "description": "/referral-exhibition marketing plus a multi-section /referral dashboard with referral codes, a rewards table and a rate calculator."
      },
      {
        "key": "stake",
        "label": "Stake-style affiliate",
        "description": "Single /affiliate page: overview and link, commission rules, and an available-commission claim-all block."
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
        "key": "shuffle",
        "label": "Shuffle-style tournaments",
        "description": "Home tournaments carousel, a 'Weekly Race' tab on the activity board and a race info modal; reads the prize-less bet-history leaderboard."
      },
      {
        "key": "bcgame",
        "label": "bc.game-style contest",
        "description": "/promotions/daily-contest page plus a contest tab on the home Latest Bets board; a wager contest with the visitor's rank."
      },
      {
        "key": "stake",
        "label": "Stake-style races",
        "description": "Real user/race module: /races daily and weekly boards with operator prize pools, claimable rewards, and a home Races slider when signed in."
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
        "key": "shuffle",
        "label": "Shuffle-style challenges",
        "description": "Multiplier-challenge grid ('first to hit Nx with min bet') with Live/Finished tabs; cards do not open a game. No backend."
      },
      {
        "key": "bcgame",
        "label": "bc.game-style quests",
        "description": "Signed-in quest hub (in progress, completed, expired) plus achievement medals on the profile. Fixtures, no backend."
      },
      {
        "key": "stake",
        "label": "Stake-style challenges",
        "description": "Multiplier-challenge grid with sorting whose cards open real in-house games, beside the bets leaderboard. Terms hard-coded, no backend."
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
        "key": "shuffle",
        "label": "Shuffle-style token suite",
        "description": "SHFL lottery page, airdrop page, token page and an airdrop tab on the activity board. Hard-coded, no backend."
      },
      {
        "key": "bcgame",
        "label": "bc.game-style raffle",
        "description": "Weekly ticket raffle page (jackpot, prize ladder, winners, my tickets) plus a home rail of external lottery draws. Fixtures, no backend."
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
        "key": "flat",
        "label": "Flat vault (shuffle and bc.game)",
        "description": "One balance in and out; transfer-in uses the shortest active lock term, transfer-out closes unlocked deposits. shuffle draws it as a header modal, bc.game as the /wallet/vault tab. Shared by shuffle and hash-games."
      },
      {
        "key": "stake",
        "label": "Stake-style term vault",
        "description": "Vault modal with a lock-period picker and per-deposit rows over GET /user/vault and /lock-options."
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
        "key": "bcgame",
        "label": "bc.game-style swap",
        "description": "Full-page /wallet/swap with 25/50/75/100% buttons, a USD min/max clamp and a completion popup; live estimate and trade."
      },
      {
        "key": "stake",
        "label": "Stake-style swap",
        "description": "Swap tab in the wallet modal with the server-quoted fee, and the last 8 swaps; live over HTTP."
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
        "key": "bcgame",
        "label": "bc.game-style chat",
        "description": "Multi-language chat drawer with rich cards, rich list, emoji and GIF pickers, plus /chat-public on phones. Fixtures today."
      },
      {
        "key": "stake",
        "label": "Stake-style chat",
        "description": "Two-room right-rail chat with tip and rain, friends and online counters, all live over the platform socket and GET /user/presence."
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
        "key": "shuffle",
        "label": "Shuffle-style side panel",
        "description": "Right-sidebar notification panel with filter chips. Not wired yet: the /user/notifications calls are declared but unused."
      },
      {
        "key": "bcgame",
        "label": "bc.game-style notification centre",
        "description": "Notice list over GET /user/notifications with unread counts, read and read-all, plus a comments tab."
      },
      {
        "key": "stake",
        "label": "Stake-style bell",
        "description": "Header bell dropdown (full-screen on phones). Not wired yet: always the empty state."
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
        "key": "shuffle",
        "label": "Shuffle-style hero",
        "description": "Wide image-only carousel from placement 'home' (one row); falls back to captured slides."
      },
      {
        "key": "bcgame",
        "label": "bc.game-style hero",
        "description": "bc.game slides whose artwork is replaced by placements home_top_1..N; title and link stay captured."
      },
      {
        "key": "stake",
        "label": "Stake-style hero",
        "description": "Card slides built from every 'hero-*' placement with a title: operator title, subtitle and CTA."
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
        "key": "shuffle",
        "label": "Shuffle-style blog",
        "description": "Tile-grid blog with pagination and full article pages; the same layout as promotions. Captured posts today."
      },
      {
        "key": "external",
        "label": "External blog link (bc.game)",
        "description": "Sidebar link to an off-site blog; nothing hosted."
      },
      {
        "key": "stake",
        "label": "Stake-style blog",
        "description": "Category-tabbed feed over GET /admin/blogs; post pages are captured only."
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
        "key": "shuffle",
        "label": "Shuffle-style lobby",
        "description": "Aggregator-first: rows from casino/games collections, category and provider browsing, favourites, recently played, js-games v2 launch."
      },
      {
        "key": "bcgame",
        "label": "bc.game-style lobby",
        "description": "Tabbed lobby with themes, sections and tag pages; originals from js-games v1, the rest fixtures; favourites and recent live."
      },
      {
        "key": "stake",
        "label": "Stake-style lobby",
        "description": "In-house-first: js-games v1 curated collections, socket originals, 'Continue Playing' from bet history; no favourites."
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
        "key": "shuffle",
        "label": "Shuffle-style verify card",
        "description": "Status-only two-level card (L1 details, L2 ID) in settings; no upload."
      },
      {
        "key": "bcgame",
        "label": "bc.game-style verification",
        "description": "Verification cockpit with document type, uploads (JPEG/PNG/PDF, 5 MB) and status panes mapped from all five platform statuses."
      },
      {
        "key": "stake",
        "label": "Stake-style verification",
        "description": "Requirement-list settings tab with an inline submit form and the raw platform status."
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

const FEATURES = Object.freeze([...GENERATED, PUSH_NOTIFICATIONS]);

/**
 * Site templates — the dropdown when a site is created. Each is the set of
 * variants that clone implements today; any feature can then be changed alone.
 */
const TEMPLATES = Object.freeze({
  "shuffle": {
    "label": "Shuffle clone",
    "description": "The shuffle.com layout: VIP page, promotions, weekly race, flat vault, KYC in settings.",
    "variants": {
      "vip": "shuffle",
      "promotions": "shuffle",
      "spin_wheel": "none",
      "gift_cards": "none",
      "bonus": "shuffle",
      "affiliate": "shuffle",
      "races": "shuffle",
      "challenges": "shuffle",
      "raffles": "shuffle",
      "vault": "flat",
      "swap": "none",
      "chat": "none",
      "notifications": "shuffle",
      "banners": "shuffle",
      "blog": "shuffle",
      "casino_lobby": "shuffle",
      "club_membership": "none",
      "kyc": "shuffle",
      "push_notifications": "none"
    }
  },
  "bcgame": {
    "label": "BC.Game clone (hash-games)",
    "description": "The bc.game layout: 34-level VIP club, bonus hub, drawer chat, swap, an external blog link.",
    "variants": {
      "vip": "bcgame",
      "promotions": "bcgame",
      "spin_wheel": "none",
      "gift_cards": "none",
      "bonus": "bcgame",
      "affiliate": "bcgame",
      "races": "bcgame",
      "challenges": "bcgame",
      "raffles": "bcgame",
      "vault": "flat",
      "swap": "bcgame",
      "chat": "bcgame",
      "notifications": "bcgame",
      "banners": "bcgame",
      "blog": "external",
      "casino_lobby": "bcgame",
      "club_membership": "none",
      "kyc": "bcgame",
      "push_notifications": "none"
    }
  },
  "stake": {
    "label": "Stake clone",
    "description": "The stake.com layout: races, spin wheel, gift cards, chat with presence, vault, blog.",
    "variants": {
      "vip": "stake",
      "promotions": "stake",
      "spin_wheel": "stake",
      "gift_cards": "stake",
      "bonus": "stake",
      "affiliate": "stake",
      "races": "stake",
      "challenges": "stake",
      "raffles": "none",
      "vault": "stake",
      "swap": "stake",
      "chat": "stake",
      "notifications": "stake",
      "banners": "stake",
      "blog": "stake",
      "casino_lobby": "stake",
      "club_membership": "none",
      "kyc": "stake",
      "push_notifications": "none"
    }
  }
});

const FEATURE_KEYS = Object.freeze(FEATURES.map((f) => f.key));
const TEMPLATE_KEYS = Object.freeze(Object.keys(TEMPLATES));

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

module.exports = { FEATURES, TEMPLATES, FEATURE_KEYS, TEMPLATE_KEYS, featureByKey, variantOf };
