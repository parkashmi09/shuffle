'use strict';

/**
 * The three recurring bonuses, and the VIP level each requires.
 *
 * These thresholds were inline integers in `userBonusRoutes.js`
 * (`vipLevelNum >= 20`, `>= 25`, `>= 30`), repeated in the eligibility read and
 * absent from the claim path — so the API reported a player as ineligible while
 * the claim endpoint would happily pay them. Stated once, used by both.
 */
const BONUS_TYPES = Object.freeze({
  daily: { minVipLevel: 20, amountColumn: 'dailybonus', paidColumn: 'actualdailybonus' },
  weekly: { minVipLevel: 25, amountColumn: 'weeklybonus', paidColumn: 'actualweeklybonus' },
  monthly: { minVipLevel: 30, amountColumn: 'monthlybonus', paidColumn: 'actualmonthlybonus' },
});

const BONUS_TYPE_NAMES = Object.freeze(Object.keys(BONUS_TYPES));

/**
 * Which balance a bonus is paid into.
 *
 * `usdt` — the player's cash balance. Bonuses are paid in the same currency
 * they play and withdraw in, so a claimed bonus is spendable money rather than
 * a second number that has to be swapped before it is worth anything.
 *
 * It used to be `BJB`, a bonus-only balance held in its own `credits` column.
 * Two things came with that and are worth stating, because this change removes
 * both:
 *
 *   - A BJB balance was ring-fenced by virtue of being a different currency.
 *     A USDT bonus is not. Withdrawal is gated by the deposit-based wagering
 *     target in `../wager` and by nothing else, so a bonus is withdrawable as
 *     soon as that target is met.
 *   - Existing BJB balances are untouched by this. Nothing migrates them; they
 *     stay where they are and remain swappable at 0% (`swap.constants.js`).
 *
 * Legacy credited the bonus column directly with
 * `UPDATE credits SET bjb = COALESCE(bjb,0) + $1` and wrote no ledger row, so a
 * bonus payment appeared on no statement anywhere. Every payment below goes
 * through `wallet.credit` and lands in the ledger, whichever column it targets.
 */
const BONUS_CURRENCY = 'USDT';

/** Redeem code states, shared with the spin wheel. */
const CODE_STATUS = Object.freeze({
  ACTIVE: 'active',
  REDEEMED: 'redeemed',
  EXPIRED: 'expired',
  SUPERSEDED: 'superseded',
});

/**
 * The per-game bonus counters on `bonusgame`.
 *
 * One row per player, one column per source of bonus. Every legacy write to
 * this table was `COALESCE(col, 0) + $n` — they only ever go up, and they
 * record what has been GRANTED from each source, cumulatively.
 *
 * Named here rather than taken from a request because they are interpolated
 * into a SQL identifier position by the increment. A counter name that came
 * from a caller would be an injection point; a counter name that came from this
 * frozen list cannot be.
 */
const GAME_COUNTERS = Object.freeze([
  'luckyspin',
  'dailybonus',
  'weeklybonus',
  'monthlybonus',
  'depositbonus',
  'rollcompetitionbonus',
  'rakebackbonus',
]);

/**
 * `bonusgame` has NOT NULL columns with no database default.
 *
 * Every counter except `rakebackbonus` is NOT NULL, so an INSERT that omits one
 * fails rather than writing zero — the same trap as `BLANK_RECORD` on
 * `userbonus`. Listing them means a new NOT NULL counter breaks creation
 * loudly instead of at 3am.
 */
const BLANK_GAME_COUNTERS = Object.freeze(
  Object.fromEntries(GAME_COUNTERS.map((name) => [name, '0']))
);

module.exports = {
  BONUS_TYPES,
  BONUS_TYPE_NAMES,
  BONUS_CURRENCY,
  CODE_STATUS,
  GAME_COUNTERS,
  BLANK_GAME_COUNTERS,
};
