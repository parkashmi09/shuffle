/**
 * The operator flags, grouped for the screen. Keys are the platform's
 * `siteconfig` columns — see backend services/admin/src/modules/site-config.
 * A key the backend returns that is not listed here still renders, under
 * "Other", so a new column never goes invisible.
 */
export const FLAG_GROUPS: { title: string; description: string; keys: string[] }[] = [
  {
    title: 'Products',
    description: 'Whole sections of the site. Off hides the section and its navigation.',
    keys: ['casino', 'sports', 'lotto', 'vipclub', 'clubmembership', 'bonus', 'affiliate', 'giftcards', 'welcomepack', 'wheelspin', 'provablyfair']
  },
  {
    title: 'Game categories',
    description: 'Casino lobby tabs.',
    keys: ['crash', 'originals', 'livegames', 'slotsgames', 'alllivegames', 'allslotsgames', 'lotterygames', 'indiangames', 'cards', 'instantgames']
  },
  {
    title: 'Providers',
    description: 'Third-party game providers offered in the lobby.',
    keys: ['spribe', 'evolution', 'pragmaticslots', 'pragmaticlive', 'ideal', 'microgaming', 'pgsoft', 'hacksawgaming', 'jili', 'jilli', 'netent']
  },
  {
    title: 'Fiat currencies',
    description: 'Wallet currencies a player may hold.',
    keys: ['inr', 'mvr', 'aed', 'pkr', 'bdt', 'npr', 'eur']
  },
  {
    title: 'Crypto currencies',
    description: 'Master switch first, then each coin.',
    keys: ['cryptocoin', 'btc', 'eth', 'ltc', 'bch', 'usdt', 'trx', 'doge', 'ada', 'xrp', 'bnb', 'usdp', 'nexo', 'mkr', 'tusd', 'usdc', 'busd', 'shib', 'matic', 'nc', 'sc', 'bjb']
  },
  {
    title: 'Home page sections',
    description: 'Blocks on the landing page, top to bottom.',
    keys: [
      'home_heroSection',
      'home_welcomebanner',
      'home_latestwins',
      'home_livecasino',
      'home_livesports',
      'home_gamingcards',
      'home_popularslots',
      'home_bonus500banner',
      'home_crashgames',
      'home_paymentbanner',
      'home_leaderboard',
      'home_promocards'
    ]
  }
]

export const FLAG_LABELS: Record<string, string> = {
  casino: 'Casino',
  sports: 'Sportsbook (kill switch)',
  lotto: 'Lottery',
  vipclub: 'VIP club',
  clubmembership: 'Club membership',
  bonus: 'Bonus programme',
  affiliate: 'Affiliate / referral',
  giftcards: 'Gift cards',
  welcomepack: 'Welcome pack',
  wheelspin: 'Spin wheel',
  provablyfair: 'Provably fair',
  crash: 'Crash games',
  originals: 'Originals (in-house)',
  livegames: 'Live games',
  slotsgames: 'Slots',
  alllivegames: 'All live games tab',
  allslotsgames: 'All slots tab',
  lotterygames: 'Lottery games',
  indiangames: 'Indian games',
  cards: 'Card games',
  instantgames: 'Instant games',
  pragmaticslots: 'Pragmatic (slots)',
  pragmaticlive: 'Pragmatic (live)',
  hacksawgaming: 'Hacksaw Gaming',
  pgsoft: 'PG Soft',
  cryptocoin: 'Crypto wallets (master)',
  home_heroSection: 'Hero carousel',
  home_welcomebanner: 'Welcome banner',
  home_latestwins: 'Latest wins ticker',
  home_livecasino: 'Live casino row',
  home_livesports: 'Live sports row',
  home_gamingcards: 'Gaming cards',
  home_popularslots: 'Popular slots row',
  home_bonus500banner: 'Bonus banner',
  home_crashgames: 'Crash games row',
  home_paymentbanner: 'Payment methods banner',
  home_leaderboard: 'Leaderboard',
  home_promocards: 'Promo cards'
}

export const flagLabel = (key: string) => FLAG_LABELS[key] ?? key.replace(/^home_/, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
