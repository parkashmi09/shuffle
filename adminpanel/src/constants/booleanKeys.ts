/* Canonical list of siteconfig boolean toggles.
 * Mirrors backend siteconfig/migration.js → SITECONFIG_COLUMNS exactly.
 * Only flags for sections actually rendered in the jackopot sidebar + home
 * page are listed — see frontend MenuContent.jsx and Home.jsx. */
export const BOOLEAN_KEYS = [
  /* sidebar / top-level features */
  "casino", "wheelspin", "welcomepack", "provablyfair", "vipclub",
  "bonus", "affiliate", "giftcards",

  /* sports module toggles */
  "sports", "home_livesports",

  /* home page sections */
  "home_heroSection",
  "home_welcomebanner",
  "home_latestwins",
  "home_livecasino",
  "home_gamingcards",
  "home_popularslots",
  "home_bonus500banner",
  "home_crashgames",
  "home_paymentbanner",
  "home_leaderboard",
  "home_promocards",
] as const;
