/**
 * The published SHFL figures the token dashboard prints.
 *
 * ── WHY THESE ARE LITERALS ───────────────────────────────────────────────
 *
 * Every number on this page describes a token traded on a public market:
 * price, market cap, TVL, holder count, circulating and burnt supply, the
 * lottery prize pool. **None of them exists anywhere on this backend.**
 * `GET /user/exchange-rate/rates` carries 25 currencies and SHFL is not among
 * them, there is no token module in any of the four services, and no price
 * feed is configured.
 *
 * So they are the reference's own published figures, read off the live
 * dashboard in one pass so they agree with each other, and they are STALE BY
 * CONSTRUCTION — a price is true for about a minute. They are here so the page
 * has the right shape and the right typography, exactly as
 * `docs/MISSING-AND-UNWIRED.md` describes for the rest of the unwired screens.
 *
 * `asOf` is not decoration. A figure with no timestamp reads as live; this one
 * says when it was true, and the supply card renders it. Wire a feed and
 * delete this file — nothing outside it knows these numbers.
 */

export const SHFL = {
  /** When this whole snapshot was read off shuffle.com. */
  asOf: "2026-09-09",

  symbol: "SHFL",
  name: "Shuffle",
  contract: "0x8881562783028F5c1BCB985d2283D5E170D88888",

  price: "$0.3071",
  /** Positive drives `TokenPercentageText_positive`, negative the other. */
  change24h: 1.55,

  holders: "95,288",
  tvl: "$92,994,686",
  marketCap: "$146,070,021",

  wagerVolume: "$198,474.00",
  wagerVolumeShfl: "645,555",

  maxSupply: "1,000,000,000 SHFL",
  /** Circulating + burnt + locked. The three bars on the supply card. */
  supply: [
    { label: "Circulating", amount: "475,647,372 SHFL", pct: 47.56, cls: "TokenGraphs_circulatingSupplyBar", icon: "/icons/circulate.svg" },
    { label: "Burnt", amount: "79,695,999 SHFL", pct: 7.97, cls: "TokenGraphs_burntSupplyBar", icon: "/icons/burn.svg" },
    { label: "Locked", amount: "444,656,629 SHFL", pct: 44.47, cls: "TokenGraphs_lockedSupplyBar", icon: "/icons/lock-token.svg" },
  ],

  lotteryPrizePool: "$3,094,443 Prize Pool",
  lotteryTotalStake: "302,675,750 Total Stake",
  lotteryPrizePoolPlain: "3,094,443 USDC",

  /** What the "USD in extra bonuses" link block prints. */
  extraBonusesUsd: "24,645,897",
};

/** Where the header's Learn More and the link blocks point. */
export const LINKS = {
  docs: "https://shfl.shuffle.com",
  lottery: "https://shfl.shuffle.com/shuffle-token-shfl/tokenomics/shfl-lottery",
  vipRewards: "https://shfl.shuffle.com/shuffle-token-shfl/token-utility/vip-rewards",
  etherscan: "https://etherscan.io/token/0x8881562783028F5c1BCB985d2283D5E170D88888",
  coingecko: "https://www.coingecko.com/en/coins/shuffle",
  uniswap:
    "https://app.uniswap.org/explore/tokens/ethereum/0x8881562783028f5c1bcb985d2283d5e170d88888",
  coinMarketCap: "https://coinmarketcap.com/currencies/shuffle/",
};

/** The four external market links, in the reference's order. */
export const EXTERNAL_LINKS = [
  { key: "etherscan", icon: "/icons/token/etherscan.svg", href: LINKS.etherscan, label: "Etherscan" },
  { key: "coingecko", icon: "/icons/token/coingecko.svg", href: LINKS.coingecko, label: "CoinGecko" },
  { key: "uniswap", icon: "/icons/token/uniswap.svg", href: LINKS.uniswap, label: "Uniswap" },
  { key: "coinMarketCap", icon: "/icons/token/coinMarketCap.svg", href: LINKS.coinMarketCap, label: "CoinMarketCap" },
];

/**
 * The hero, which is not the same banner for everyone.
 *
 * Signed out the reference sells the airdrop to a visitor who has no account;
 * signed in it tells a player the current round is running. Same
 * `HeroBanner_*` markup, different copy and a different call to action.
 */
export const HERO = {
  signedOut: {
    heading: "START EARNING SHFL AIRDROPS NOW!",
    body: "We've given away more than 100M SHFL. Sign up and start earning free SHFL.",
    cta: "Learn More",
  },
  signedIn: {
    heading: "AIRDROP 3 IS HERE!",
    body: "Start wagering and earning points to climb the leaderboard for the next airdrop!",
    cta: "Learn More",
  },
};
