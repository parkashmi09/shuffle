/**
 * Every backend path this panel calls, in one place.
 *
 * WHY A REGISTRY RATHER THAN PATHS AT THE CALL SITE
 *
 * The platform moved from a monolith to four services behind a gateway, and the
 * gateway rewrites old paths onto new ones — but only where a rewrite is
 * possible. It cannot change a verb, move a request body into a query string,
 * or fill in a path parameter, so a large share of the old admin paths are
 * deliberately NOT mapped and answer 404. Calling the new path directly is the
 * only way to know a route is really there.
 *
 * `backend/tools/verify-frontend-routes.js` reads this file and asserts every
 * entry matches a route the backend actually mounts. A typo here fails that
 * check instead of failing in an operator's browser.
 *
 * ── `admin` IS AN AUDIENCE, NOT A SERVICE ───────────────────────────────
 *
 * The staff-facing routes of ALL FOUR services live under `/api/v1/admin/…`:
 *
 *   /api/v1/admin/staff          admin-service   (its own modules skip the
 *   /api/v1/admin/banners                         repeated service segment)
 *   /api/v1/admin/user/wallet    user-service
 *   /api/v1/admin/casino/games   casino-service
 *   /api/v1/admin/sports/bets    sports-service
 *
 * So `ADMIN_USER` below is "the staff view of user-service", not "the user
 * admin". Getting this wrong is how 161 admin routes 404'd through the gateway
 * at one point — the prefixes are ordered longest-first for exactly that reason.
 *
 * `:param` segments are filled by `buildPath()` from `utils/api`.
 */

const ADMIN = '/api/v1/admin';
const ADMIN_USER = '/api/v1/admin/user';
const ADMIN_CASINO = '/api/v1/admin/casino';
const ADMIN_SPORTS = '/api/v1/admin/sports';

export const ENDPOINTS = {
  /* ── staff sign-in ─────────────────────────────────────────────────────
   * The login field is `email`, not `username` — the legacy handler logged
   * every submitted password in cleartext and answered 'Bad email' and 'Bad
   * password' separately, so it enumerated accounts by body AND by timing.
   */
  auth: {
    login: `${ADMIN}/auth/login`,
    executiveLogin: `${ADMIN}/auth/executive/login`,
    firstLoginPassword: `${ADMIN}/auth/first-login-password`,
    logout: `${ADMIN}/auth/logout`,

    /**
     * Second-factor enrolment for the SIGNED-IN operator.
     *
     * None of these takes a staff id — the account comes from the token. That
     * is deliberate and it is the difference from the player module these
     * mirror, which was unauthenticated and took a `uid` from the body, so
     * `POST /2fa/disable` with someone else's id turned off their 2FA.
     */
    twoFactorStatus: `${ADMIN}/auth/2fa`,
    twoFactorBegin: `${ADMIN}/auth/2fa/begin`,
    twoFactorConfirm: `${ADMIN}/auth/2fa/confirm`,
    twoFactorDisable: `${ADMIN}/auth/2fa/disable`,
  },

  /* ── the hierarchy and the money in it ─────────────────────────────────*/
  staff: {
    list: `${ADMIN}/staff/`,
    create: `${ADMIN}/staff/`,
    get: `${ADMIN}/staff/:staffId`,
    update: `${ADMIN}/staff/:staffId`,
    remove: `${ADMIN}/staff/:staffId`,
    tree: `${ADMIN}/staff/tree`,
    players: `${ADMIN}/staff/players`,
    analytics: `${ADMIN}/staff/analytics/:staffId`,
    rollup: `${ADMIN}/staff/rollup/:staffId`,
    percentChain: `${ADMIN}/staff/:staffId/percent-chain`,
    percentTree: `${ADMIN}/staff/:staffId/percent-tree`,
    whatsappRef: `${ADMIN}/staff/:staffId/whatsapp-ref`,
    transactions: `${ADMIN}/staff/transactions`,
    transfers: `${ADMIN}/staff/transfers`,
    transfersFor: `${ADMIN}/staff/transfers/:staffId`,
    transfersSummary: `${ADMIN}/staff/transfers/summary`,
    /**
     * Moving money between staff accounts.
     *
     * Needs `wallet:adjust` now, where legacy used the same middleware as every
     * other route on the router — so a caller whose token lacks it gets a 403
     * where it used to get a 200.
     */
    transfer: `${ADMIN}/staff/transfer`,
    /**
     * Changing a password.
     *
     * ONE endpoint for "my own" and "somebody else's", distinguished by whether
     * the body carries `targetId`. `POST /api/staff/reset-password-for-staff` is
     * deliberately not rewritten — a rewrite cannot change the verb, so a client
     * on the old path must move to PATCH.
     */
    password: `${ADMIN}/staff/password`,
    bulkStatus: `${ADMIN}/staff/bulk-status`,
  },

  /* ── players ───────────────────────────────────────────────────────────
   * `DELETE` CLOSES AND ANONYMISES an account; it does not erase it. Legacy
   * read `information_schema` for anything named `user_id`/`uid`/`user` and
   * DELETEd from every one — every deposit, withdrawal, bet and ledger row the
   * player ever produced, unrecoverably, on a licensed gambling platform.
   */
  players: {
    create: `${ADMIN}/players/`,
    update: `${ADMIN}/players/:playerId`,
    close: `${ADMIN}/players/:playerId`,
  },

  /* ── operator controls over one account ────────────────────────────────
   * The best-guarded corner of the legacy platform, and the only one with a
   * TRANSACTION PASSWORD on every write. That is preserved: these all take one.
   */
  accounts: {
    list: `${ADMIN}/accounts/`,
    password: `${ADMIN}/accounts/password`,
    status: `${ADMIN}/accounts/status`,
    exposureLimit: `${ADMIN}/accounts/exposure-limit`,
    creditLimit: `${ADMIN}/accounts/credit-limit`,
    refill: `${ADMIN}/accounts/refill`,
    statement: `${ADMIN}/accounts/statement`,
    sportsExposure: `${ADMIN}/accounts/exposure/sports`,
  },

  /* ── sub-logins and their authority ────────────────────────────────────
   * A grant is compared against the CREATOR's own authority now. Legacy
   * validated the payload's SHAPE and never its size, so an oversized grant was
   * stored and a later promotion of the parent silently promoted every
   * executive beneath them.
   */
  access: {
    myPermissions: `${ADMIN}/access/me/permissions`,
    executives: `${ADMIN}/access/executives`,
    updateExecutive: `${ADMIN}/access/executives/:executiveId`,
    executiveStatus: `${ADMIN}/access/executives/:executiveId/status`,
    executivePassword: `${ADMIN}/access/executives/:executiveId/password`,
    executiveActivity: `${ADMIN}/access/executives/:executiveId/activity`,
    marketingUsers: `${ADMIN}/access/marketing-users`,
    marketingUserStatus: `${ADMIN}/access/marketing-users/:executiveId/status`,
    marketingUserPassword: `${ADMIN}/access/marketing-users/:executiveId/password`,
    activity: `${ADMIN}/access/activity`,
  },

  audit: {
    activity: `${ADMIN}/audit/activity`,
  },

  /* ── headline figures ──────────────────────────────────────────────────
   * Six of the nine legacy routes were unauthenticated, including two that
   * returned every column of every deposit and withdrawal made today.
   * `/today-transactions` additionally NEVER WORKED — it called `pool.query`
   * and `pool` was declared nowhere.
   */
  dashboard: {
    summary: `${ADMIN}/dashboard/`,
    userStats: `${ADMIN}/dashboard/user-stats`,
    today: `${ADMIN}/dashboard/today`,
    totals: `${ADMIN}/dashboard/totals`,
    member: `${ADMIN}/dashboard/members/:userId`,
    /**
     * The rows behind a headline figure.
     *
     * `today` reads `deposits`/`withdrawals`; the totals sum six OTHER tables,
     * so a list opened from a total never contained the rows behind it. These
     * two read the same sources the totals do, over any window.
     */
    movements: `${ADMIN}/dashboard/movements`,
    registrations: `${ADMIN}/dashboard/registrations`,
  },

  /* ── reports ───────────────────────────────────────────────────────────
   * THE WHOLE LEGACY `/reports` ROUTER WAS UNAUTHENTICATED, on three routes
   * that read the customer database. The CSV export returned every direct
   * player — id, name, referral code and balance — to anyone who asked.
   */
  reports: {
    players: `${ADMIN}/reports/players`,
    player: `${ADMIN}/reports/players/:userId`,
    export: `${ADMIN}/reports/players/export`,
    balanceSheet: `${ADMIN}/reports/balance-sheet/:userId`,
    playerSheet: `${ADMIN}/reports/player-sheet/:uid`,
    /** The agent tree — players below the caller, and the staff who anchor them. */
    agentUsers: `${ADMIN}/reports/agent-users`,
    /** Risk review. Both were missed by the port; the staff view is new. */
    userRisk: `${ADMIN}/reports/user-risk/:userId`,
    staffRisk: `${ADMIN}/reports/staff-risk/:staffId`,
  },

  /**
   * The "hisab", on screen and in print.
   *
   * Legacy served two DIFFERENT PDFs on `/:staffId` and `/:staffId/pdf`, built
   * from different queries — and a third renderer for the player report, whose
   * sports P&L came from the bet rows while the statement's came from
   * `credits_ledger`. Those disagree on any voided or manually adjusted bet, so
   * the platform could print two profit figures for one player and say nothing
   * about which to believe. One renderer now.
   */
  statements: {
    staff: `${ADMIN}/statements/:staffId`,
    staffStatement: `${ADMIN}/statements/:staffId/statement`,
    staffBets: `${ADMIN}/statements/:staffId/bets`,
    staffPdf: `${ADMIN}/statements/:staffId/pdf`,
    userStatement: `${ADMIN}/statements/user/:userId/statement`,
    userBets: `${ADMIN}/statements/user/:userId/bets`,
    userPdf: `${ADMIN}/statements/user/:userId/pdf`,
  },

  /* ── locks ─────────────────────────────────────────────────────────────
   * Two of the three lock fields legacy accepted name columns that DO NOT
   * EXIST, and all three went into one statement — so a request setting the
   * sports lock alongside either of the others failed entirely. Locking an
   * agent also reached only their DIRECT children, leaving the branch below
   * still trading, and the handler ignored the row count and reported success
   * either way.
   */
  locks: {
    update: `${ADMIN}/locks/`,
    ref: `${ADMIN}/locks/ref/:slug`,
    transfers: `${ADMIN}/locks/transfers/:userId`,
  },

  /* ── site content ──────────────────────────────────────────────────────*/
  banners: {
    list: `${ADMIN}/banners/`,
    create: `${ADMIN}/banners/`,
    binary: `${ADMIN}/banners/binary`,
    byType: `${ADMIN}/banners/:type`,
    setActive: `${ADMIN}/banners/:type/active`,
    image: `${ADMIN}/banners/image/:filename`,
  },

  blogs: {
    list: `${ADMIN}/blogs/`,
    create: `${ADMIN}/blogs/`,
    get: `${ADMIN}/blogs/:id`,
    update: `${ADMIN}/blogs/:id`,
    remove: `${ADMIN}/blogs/:id`,
    bySlug: `${ADMIN}/blogs/slug/:slug`,
    removeBySlug: `${ADMIN}/blogs/slug/:slug`,
    byCategory: `${ADMIN}/blogs/category/:category`,
    image: `${ADMIN}/blogs/:id/image`,
  },
  promotions: {
    list: `${ADMIN}/promotions/`,
    create: `${ADMIN}/promotions/`,
    get: `${ADMIN}/promotions/:id`,
    update: `${ADMIN}/promotions/:id`,
    remove: `${ADMIN}/promotions/:id`,
    bySlug: `${ADMIN}/promotions/slug/:segment/:slug`,
    removeBySlug: `${ADMIN}/promotions/slug/:segment/:slug`,
    image: `${ADMIN}/promotions/:id/image`,
  },

  /* ── platform settings ─────────────────────────────────────────────────
   * `/public` is the unauthenticated feature-flag read the player app uses; it
   * is an allow-list, not the `siteconfig` row minus a few fields, because that
   * row also holds the platform's SMTP password.
   */
  siteConfig: {
    public: `${ADMIN}/site-config/public`,
    affiliate: `${ADMIN}/site-config/affiliate`,
    sports: `${ADMIN}/site-config/sports`,
    /**
     * VIP bonus + Instant Rakeback payout currencies — `GET`/`PUT`.
     * Separate from the boolean currency flags on `/global`.
     */
    rewards: `${ADMIN}/site-config/rewards`,
    email: `${ADMIN}/site-config/email`,
    emailTest: `${ADMIN}/site-config/email/test`,
    /**
     * The feature-flag screen — `GET`/`PUT`.
     *
     * Legacy's `PUT /api/admin/config/global` built its SET clause from the
     * request body, so any column on `siteconfig` was writable by naming it,
     * including `gmailapppassword`. The replacement allow-lists the flags and
     * REFUSES a body naming anything else, rather than applying the rest.
     */
    global: `${ADMIN}/site-config/global`,
    /**
     * One player's own preferences — `GET`/`PUT`.
     *
     * UI state only (notifications, theme, language, hide-balance); nothing
     * here can lock an account or change a limit. Scoped to the caller's tree,
     * which legacy's check meant to do and did not — it compared a player id
     * against a list of staff ids.
     */
    userSettings: `${ADMIN}/site-config/user/:userId`,
  },

  /* ── push notifications ────────────────────────────────────────────────
   * `POST /firebase/send-bulk` had NO middleware: anyone reaching the port
   * could push a message of their own writing to every registered device on the
   * platform, from the operator's own app. `GET /allToken` handed out every FCM
   * token, which is enough to push to those devices through Firebase directly.
   */
  notifications: {
    devices: `${ADMIN}/notifications/devices`,
    send: `${ADMIN}/notifications/send`,
    broadcast: `${ADMIN}/notifications/broadcast`,
    history: `${ADMIN}/notifications/history/:userId`,
    unread: `${ADMIN}/notifications/unread/:userId`,
  },

  /* ── acquisition analytics ─────────────────────────────────────────────
   * Read-only, and the guarantee is enforced by refusing any verb but GET
   * before a handler runs. The account type is re-read from the database rather
   * than trusted from a JWT claim.
   */
  marketing: {
    me: `${ADMIN}/marketing/me`,
    signups: `${ADMIN}/marketing/analytics/signups`,
    deposits: `${ADMIN}/marketing/analytics/deposits`,
    retention: `${ADMIN}/marketing/analytics/retention`,
    topAgents: `${ADMIN}/marketing/analytics/top-agents`,
    customers: `${ADMIN}/marketing/customers`,
  },

  /* ══ the staff view of user-service ════════════════════════════════════*/

  /** `GET /users` was `SELECT * FROM users` — every player's bcrypt hash. */
  directory: {
    list: `${ADMIN_USER}/directory/`,
    get: `${ADMIN_USER}/directory/:userId`,
    summary: `${ADMIN_USER}/directory/summary`,
    close: `${ADMIN_USER}/directory/:userId`,
  },

  /**
   * The only service that writes a balance.
   *
   * `POST /updatebalance` and `/adminwalletadd` both land on `adjust`, which
   * takes a signed delta, locks the row and writes a ledger entry. Legacy wrote
   * an absolute value with no lock and no ledger.
   */
  wallet: {
    adjust: `${ADMIN_USER}/wallet/adjust`,
    /**
     * `GET /getwallet` — every player's wallet, paged and staff-scoped.
     *
     * The legacy path IS rewritten by the gateway, but onto the PLAYER route
     * `/api/v1/user/wallet/balances`, which answers with the balance of
     * whoever the token belongs to. A staff token there is a 401, so the
     * operator console calls this one.
     */
    list: `${ADMIN_USER}/wallet/balances`,
    balances: `${ADMIN_USER}/wallet/:userId/balances`,
    history: `${ADMIN_USER}/wallet/:userId/history`,
    reconcile: `${ADMIN_USER}/wallet/:userId/reconcile`,
  },

  transactionHistory: {
    deposits: `${ADMIN_USER}/history/deposits`,
    withdrawals: `${ADMIN_USER}/history/withdrawals`,
    cryptoDeposits: `${ADMIN_USER}/history/crypto/deposits`,
    cryptoStats: `${ADMIN_USER}/history/crypto/stats`,
    fiatDeposits: `${ADMIN_USER}/history/fiat/deposits`,
    fiatStats: `${ADMIN_USER}/history/fiat/stats`,
    forUser: `${ADMIN_USER}/history/user/:userId`,
    profitLossUser: `${ADMIN_USER}/history/profit-loss/user/:userId`,
    profitLossStaff: `${ADMIN_USER}/history/profit-loss/staff/:staffId`,
  },

  /**
   * Manual deposits.
   *
   * Legacy had TWO surfaces over the same `fiat_deposits` table —
   * `/api/deposit/*` and `/api/deposits/*` — and the singular one had no
   * middleware at all: its approve handler took the approver from an
   * `x-staff-id` REQUEST HEADER, so `x-staff-id: 1` approved any pending
   * deposit and credited the player.
   */
  deposits: {
    list: `${ADMIN_USER}/deposits/fiat/`,
    pending: `${ADMIN_USER}/deposits/fiat/pending`,
    approve: `${ADMIN_USER}/deposits/fiat/:depositId/approve`,
    reject: `${ADMIN_USER}/deposits/fiat/:depositId/reject`,
    screenshot: `${ADMIN_USER}/deposits/fiat/:depositId/screenshot`,
  },

  /**
   * Withdrawal review.
   *
   * `POST /updateWithdrawStatus` was `UPDATE withdrawals SET status = $1 WHERE
   * id = $2` — unauthenticated, no state machine, no refund. The replacement
   * puts the id in the path and takes a status from an enum.
   */
  withdrawals: {
    crypto: `${ADMIN_USER}/withdrawals/crypto/`,
    cryptoSummary: `${ADMIN_USER}/withdrawals/crypto/summary`,
    cryptoForUser: `${ADMIN_USER}/withdrawals/crypto/user/:userId`,
    decision: `${ADMIN_USER}/withdrawals/crypto/:withdrawalId/decision`,
    fiat: `${ADMIN_USER}/withdrawals/fiat/`,
    fiatStatus: `${ADMIN_USER}/withdrawals/fiat/status`,
  },

  kyc: {
    applications: `${ADMIN_USER}/kyc/applications`,
    review: `${ADMIN_USER}/kyc/review`,
    document: `${ADMIN_USER}/kyc/documents/:kycId/:field`,
  },

  /**
   * P2P trading.
   *
   * NEVER MOUNTED IN LEGACY, and not one of its 21 routes had a middleware.
   * Thirteen were under `/admin/p2p/`, including three that move real money:
   * release credits crypto, sell-cancel refunds it — repeatedly, because it
   * checked only for RELEASED, so cancelling a CANCELLED order refunded again.
   *
   * `DELETE /admin/p2p/order/:id` is deliberately absent: it destroyed the
   * record that crypto was paid out while the ledger row survived with nothing
   * to reconcile against. Cancelling refunds correctly.
   */
  p2p: {
    paymentTypes: `${ADMIN_USER}/p2p/payment-types`,
    paymentAccounts: `${ADMIN_USER}/p2p/payment-accounts`,
    offers: `${ADMIN_USER}/p2p/offers`,
    offerStatus: `${ADMIN_USER}/p2p/offers/:offerId/status`,
    orders: `${ADMIN_USER}/p2p/orders`,
    orderStatus: `${ADMIN_USER}/p2p/orders/:orderId/status`,
    releaseOrder: `${ADMIN_USER}/p2p/orders/:orderId/release`,
    cancelOrder: `${ADMIN_USER}/p2p/orders/:orderId/cancel`,
    orderProof: `${ADMIN_USER}/p2p/orders/:orderId/proof`,
    sellOrders: `${ADMIN_USER}/p2p/sell-orders`,
    releaseSellOrder: `${ADMIN_USER}/p2p/sell-orders/:orderId/release`,
    cancelSellOrder: `${ADMIN_USER}/p2p/sell-orders/:orderId/cancel`,
    sellOrderProof: `${ADMIN_USER}/p2p/sell-orders/:orderId/proof`,
    sellOrderQr: `${ADMIN_USER}/p2p/sell-orders/:orderId/qr`,
    disputes: `${ADMIN_USER}/p2p/disputes`,
    disputeStatus: `${ADMIN_USER}/p2p/disputes/:disputeId/status`,
    disputeScreenshot: `${ADMIN_USER}/p2p/disputes/:disputeId/screenshot`,
  },

  vault: {
    users: `${ADMIN_USER}/vault/users`,
    stats: `${ADMIN_USER}/vault/stats`,
    interest: `${ADMIN_USER}/vault/interest`,
    lockPeriods: `${ADMIN_USER}/vault/lock-periods`,
    lockPeriodRate: `${ADMIN_USER}/vault/lock-periods/rate`,
  },

  /**
   * Bonuses.
   *
   * Legacy authenticated these with a shared static `role-key` HEADER — one key
   * per role, committed in the client bundle — and named the player with a
   * `userid` query parameter.
   */
  bonus: {
    records: `${ADMIN_USER}/bonus/records`,
    games: `${ADMIN_USER}/bonus/games`,
    events: `${ADMIN_USER}/bonus/events`,
    event: `${ADMIN_USER}/bonus/events/:id`,
    codes: `${ADMIN_USER}/bonus/codes`,
    users: `${ADMIN_USER}/bonus/users`,
    userBonus: `${ADMIN_USER}/bonus/users/:userId`,
    awards: `${ADMIN_USER}/bonus/awards`,
    dashboard: `${ADMIN_USER}/bonus/dashboard`,
  },

  giftCards: {
    list: `${ADMIN_USER}/gift-cards/`,
    create: `${ADMIN_USER}/gift-cards/`,
    remove: `${ADMIN_USER}/gift-cards/:id`,
    analytics: `${ADMIN_USER}/gift-cards/analytics`,
    records: `${ADMIN_USER}/gift-cards/records`,
    search: `${ADMIN_USER}/gift-cards/search`,
  },

  spinWheel: {
    config: `${ADMIN_USER}/spin-wheel/config`,
    slices: `${ADMIN_USER}/spin-wheel/slices`,
    slice: `${ADMIN_USER}/spin-wheel/slices/:id`,
    slicesBulk: `${ADMIN_USER}/spin-wheel/slices-bulk`,
    claims: `${ADMIN_USER}/spin-wheel/claims`,
  },

  /**
   * The wagering race — a daily and a weekly leaderboard paid from a prize pool.
   *
   * ── THE CONFIG IS THE PROMOTION ─────────────────────────────────────────
   *
   * The multipliers decide who wins and the pool decides what that is worth, so
   * `PUT /config/:type` is audited on the server and gated on `config:write`.
   * Reads are `reports:read`.
   *
   * ── WHAT A SAVE ACTUALLY DOES ───────────────────────────────────────────
   *
   * The rank-by-rank prize curve is computed SERVER-SIDE on save and stored on
   * the config row; every reader afterwards — this screen and the player's
   * leaderboard — uses that stored array. Do not recompute it here to preview a
   * change: the implementation this was ported from did exactly that, in the
   * browser and on the server from different inputs, and the table an operator
   * approved could disagree with the "Reward" column a player saw with nothing
   * saying which was right. Save, then read back what the server computed.
   *
   * Switching a race ON also opens its current window immediately, so the
   * promotion is live rather than waiting for the next midnight roll.
   */
  race: {
    /** One race type's full configuration, including the stored prize curve. */
    config: `${ADMIN_USER}/race/config/:type`,
    /** Past and current windows. `type?`, `limit`, `offset`. */
    races: `${ADMIN_USER}/race/races`,
    /**
     * Settle a window by hand — writes the prizes and closes it.
     *
     * Safe to re-run: `UNIQUE (race_id, user_id)` absorbs a repeat, so a
     * settlement that failed half way completes rather than throwing.
     */
    settle: `${ADMIN_USER}/race/races/:id/settle`,
    /** Every prize. `type?`, `userId?`, `claimed?` (`'true'`/`'false'`). */
    rewards: `${ADMIN_USER}/race/rewards`,
    /**
     * Decorative leaderboard entries ("booked seats").
     *
     * They occupy a rank on the BOARD and never receive a prize — they are not
     * players and `race_rewards` has no id to write for them. The reference
     * gave them fake user ids at 900001+, which meant settlement wrote prizes
     * against accounts that exist in no table: money budgeted, unclaimable by
     * anyone, and a large share of every pool.
     */
    boats: `${ADMIN_USER}/race/boats`,
    boat: `${ADMIN_USER}/race/boats/:id`,
  },

  affiliate: {
    teams: `${ADMIN_USER}/affiliate/teams`,
    teamMembers: `${ADMIN_USER}/affiliate/teams/:owner/members`,
    members: `${ADMIN_USER}/affiliate/members`,
    stats: `${ADMIN_USER}/affiliate/stats`,
    rewards: `${ADMIN_USER}/affiliate/rewards`,
    top: `${ADMIN_USER}/affiliate/top`,
    unlock: `${ADMIN_USER}/affiliate/unlock`,
  },

  clubs: {
    list: `${ADMIN_USER}/clubs/`,
    get: `${ADMIN_USER}/clubs/:clubId`,
    update: `${ADMIN_USER}/clubs/:clubId`,
    remove: `${ADMIN_USER}/clubs/:clubId`,
    members: `${ADMIN_USER}/clubs/:clubId/members`,
    earnings: `${ADMIN_USER}/clubs/:clubId/earnings`,
    earningsConfig: `${ADMIN_USER}/clubs/:clubId/earnings-config`,
    byOwner: `${ADMIN_USER}/clubs/owner/:ownerId`,
  },

  /**
   * Exchange rates.
   *
   * READING is the PUBLIC route — the rate table is not staff data, and the
   * admin router deliberately has no GET. Writing needs `config:write`.
   * Pointing a read at the admin path returns 404, not 403, which is the
   * confusing failure this split avoids.
   */
  exchangeRate: {
    read: `/api/v1/user/exchange-rate/rates`,
    readOne: `/api/v1/user/exchange-rate/rates/:currency`,
    create: `${ADMIN_USER}/exchange-rate/rates`,
    update: `${ADMIN_USER}/exchange-rate/rates/:currency`,
    remove: `${ADMIN_USER}/exchange-rate/rates/:currency`,
  },

  swap: {
    history: `${ADMIN_USER}/swap/history`,
    userHistory: `${ADMIN_USER}/swap/history/:userId`,
  },

  wager: {
    list: `${ADMIN_USER}/wager/`,
    common: `${ADMIN_USER}/wager/common`,
    forUser: `${ADMIN_USER}/wager/:userId`,
    setForUser: `${ADMIN_USER}/wager/:userId`,
    lock: `${ADMIN_USER}/wager/:userId/lock`,
    bulkMultiplier: `${ADMIN_USER}/wager/bulk/multiplier`,
  },

  bankDetails: {
    list: `${ADMIN_USER}/bank-details/:coin_type`,
    create: `${ADMIN_USER}/bank-details/:coin_type`,
    update: `${ADMIN_USER}/bank-details/:coin_type/:id`,
    remove: `${ADMIN_USER}/bank-details/:coin_type/:id`,
  },

  email: {
    send: `${ADMIN_USER}/email/send`,
    bulk: `${ADMIN_USER}/email/bulk`,
  },

  crypto: {
    inrDeposits: `${ADMIN_USER}/crypto/inr-deposits`,
  },

  payments: {
    utrRepair: `${ADMIN_USER}/payments/utr-repair`,
    userOrders: `${ADMIN_USER}/payments/users/:userId/orders`,
    pspStatus: `${ADMIN_USER}/psp/:provider/status/:reference`,
  },

  /* ══ the staff view of casino-service ══════════════════════════════════*/

  casinoGames: {
    vendors: `${ADMIN_CASINO}/games/vendors`,
    vendorSearch: `${ADMIN_CASINO}/games/vendor-search`,
    types: `${ADMIN_CASINO}/games/types`,
    typeSearch: `${ADMIN_CASINO}/games/type-search`,
    catalogueSearch: `${ADMIN_CASINO}/games/catalogue/search`,
    image: `${ADMIN_CASINO}/games/catalogue/:uuid/image`,
    collection: `${ADMIN_CASINO}/games/collections/:collection`,
    vendorPriority: `${ADMIN_CASINO}/games/priority/:vendor`,
    typePriority: `${ADMIN_CASINO}/games/type-priority/:type`,
    providers: `${ADMIN_CASINO}/games/providers`,
  },

  /**
   * The house counters.
   *
   * `house` is NOT a display table: it is read on every bet in sixteen games,
   * and when `current >= max` a winning roll is discarded and replaced with a
   * losing number — while the hash of the DISCARDED roll is published.
   *
   * `/win-house` and `/reset-house` were GETs with `UPDATE house SET …` and NO
   * WHERE CLAUSE — every row at once. They are POSTs here, so a browser
   * prefetch or a crawler cannot fire one.
   */
  casinoHouse: {
    get: `${ADMIN_CASINO}/house/`,
    update: `${ADMIN_CASINO}/house/`,
    bulk: `${ADMIN_CASINO}/house/bulk`,
    ticker: `${ADMIN_CASINO}/house/ticker`,
    clock: `${ADMIN_CASINO}/house/clock`,
  },

  casinoBetHistory: {
    transactions: `${ADMIN_CASINO}/bet-history/transactions`,
    stats: `${ADMIN_CASINO}/bet-history/stats`,
    analytics: `${ADMIN_CASINO}/bet-history/analytics`,
    luckysports: `${ADMIN_CASINO}/bet-history/luckysports`,
    forUser: `${ADMIN_CASINO}/bet-history/transactions/user/:userId`,
    betWinCount: `${ADMIN_CASINO}/bet-history/user/:userId/bet-win-count`,
    houseTable: `${ADMIN_CASINO}/bet-history/house/:table`,
    rawTable: `${ADMIN_CASINO}/bet-history/transactions/raw/:table`,
  },

  casinoGis: {
    freespins: `${ADMIN_CASINO}/gis/freespins`,
    cancelFreespins: `${ADMIN_CASINO}/gis/freespins/cancel`,
    vouchers: `${ADMIN_CASINO}/gis/vouchers`,
    cancelVouchers: `${ADMIN_CASINO}/gis/vouchers/cancel`,
    selfValidate: `${ADMIN_CASINO}/gis/self-validate`,
    syncGames: `${ADMIN_CASINO}/gis/sync/games`,
    syncProviders: `${ADMIN_CASINO}/gis/sync/providers`,
  },

  casinoCatalogue: {
    syncImages: `${ADMIN_CASINO}/catalogue/images/sync`,
  },

  casinoJsGames: {
    v1Transfer: `${ADMIN_CASINO}/js-games/v1/transfer`,
    v1Transactions: `${ADMIN_CASINO}/js-games/v1/transactions`,
    v2History: `${ADMIN_CASINO}/js-games/v2/history`,
  },

  /**
   * Curation over the catalogue the site ACTUALLY RENDERS.
   *
   * ── `casinoGames` ORDERS A CATALOGUE NO PLAYER SEES ──────────────────
   *
   * There are two game tables. `casinoGames` above writes against
   * `gisgamesnew` — the Slotegrator aggregator sync, 2,818 rows, addressed by
   * `uuid`. The site lists `js_games` (2,002 rows, addressed by `game_uid`)
   * and launches through `js-games/v2/launch`, which takes a `game_uid` and
   * cannot open an aggregator uuid at all. See `useCasinoCatalogue` in the
   * site: "`jsgames` LISTS, `jsgamesv2` LAUNCHES".
   *
   * So every list an operator built on the old screens was applied to rows
   * nobody renders, naming games nothing can open. These endpoints are the
   * same operations against the catalogue on screen, and they are what the
   * priority and trending pages use.
   *
   * `:scope` is `vendor` | `type` | `collection`; `:key` is the vendor name,
   * the game type, or the collection slug (`trending`, `hot`, `live-casino`,
   * `popular-slots`, `crash`, `indian`).
   */
  casinoJsCuration: {
    vendors: `${ADMIN_CASINO}/js-games/v1/vendors`,
    types: `${ADMIN_CASINO}/js-games/v1/types`,
    collections: `${ADMIN_CASINO}/js-games/v1/collections`,
    /** GET reads the ordered list; PUT replaces it with `{gameUids}`. */
    curation: `${ADMIN_CASINO}/js-games/v1/curation/:scope/:key`,
    search: `${ADMIN_CASINO}/js-games/v1/catalogue/search`,
    icon: `${ADMIN_CASINO}/js-games/v1/catalogue/:gameUid/icon`,
  },

  /* ══ the staff view of sports-service ══════════════════════════════════*/

  /**
   * Every legacy sports report was scoped by an `x-staff-id` REQUEST HEADER —
   * the caller sets it, and `x-staff-id: 1` is the platform owner. The two lock
   * toggles had no scoping and no authentication at all.
   */
  sportsBetAdmin: {
    bets: `${ADMIN_SPORTS}/bet-admin/bets`,
    ticker: `${ADMIN_SPORTS}/bet-admin/bets/ticker`,
    byUser: `${ADMIN_SPORTS}/bet-admin/bets/by-user`,
    exposure: `${ADMIN_SPORTS}/bet-admin/exposure`,
    exposureByMatch: `${ADMIN_SPORTS}/bet-admin/exposure/match/:matchId`,
    userLocks: `${ADMIN_SPORTS}/bet-admin/locks/users`,
    staffLocks: `${ADMIN_SPORTS}/bet-admin/locks/staff`,
    gameReport: `${ADMIN_SPORTS}/bet-admin/reports/game`,
  },

  /**
   * Manual settlement.
   *
   * `admin_fancy_control` — the table five of the catalogue routes read and
   * write — was never created, so all five returned 500 from the day they were
   * written. Migration 024 creates it.
   */
  sportsSettlement: {
    moMatches: `${ADMIN_SPORTS}/settlement/mo-matches`,
    fancyMatches: `${ADMIN_SPORTS}/settlement/fancy-matches`,
    openBets: `${ADMIN_SPORTS}/settlement/open-bets`,
    settledBets: `${ADMIN_SPORTS}/settlement/settled-bets`,
    settledMarkets: `${ADMIN_SPORTS}/settlement/settled-markets`,
    declareResult: `${ADMIN_SPORTS}/settlement/declare-result`,
    voidMarket: `${ADMIN_SPORTS}/settlement/void-market`,
    voidBet: `${ADMIN_SPORTS}/settlement/void-bet`,
    voidMarketPostSettlement: `${ADMIN_SPORTS}/settlement/void-market/post-settlement`,
    voidBetPostSettlement: `${ADMIN_SPORTS}/settlement/void-bet/post-settlement`,
  },

  sportsCatalogue: {
    sports: `${ADMIN_SPORTS}/catalogue/sports`,
    sport: `${ADMIN_SPORTS}/catalogue/sports/:id`,
    fancy: `${ADMIN_SPORTS}/catalogue/fancy`,
    fancyByEvent: `${ADMIN_SPORTS}/catalogue/fancy/event/:eventId`,
    fancyBulk: `${ADMIN_SPORTS}/catalogue/fancy/bulk`,
    fancyControl: `${ADMIN_SPORTS}/catalogue/fancy/:marketId`,
  },

  sportsResults: {
    markets: `${ADMIN_SPORTS}/results/markets`,
    fancy: `${ADMIN_SPORTS}/results/fancy`,
    marketsForUser: `${ADMIN_SPORTS}/results/markets/user/:userId`,
  },
} as const;

export default ENDPOINTS;
