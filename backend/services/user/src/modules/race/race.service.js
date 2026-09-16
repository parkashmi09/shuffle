'use strict';

const { Op } = require('sequelize');
const { money } = require('@ibitplay/common');

const { WalletService } = require('../wallet/wallet.service');
const errors = require('./race.errors');
const { buildRankPrizes } = require('./race.prizes');
const { windowFor } = require('./race.window');
const {
  RACE_TYPES,
  RACE_STATUS,
  RACE_BUCKETS,
  BUCKET_COLUMN,
  PRIZE_CURRENCY,
  REASON,
  MIN_REWARD,
} = require('./race.constants');

/**
 * The wagering race.
 *
 * Every bet placed inside a window is converted to USD, multiplied by its game
 * bucket's points rate, and summed per player. The window closes, the top N are
 * paid out of a prize pool, and each prize sits as a claimable row until the
 * player takes it into their wallet.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THIS IS A PORT OF, AND WHAT CHANGED
 *
 * A module that had been running in production with four faults that each cost
 * money or credibility. They are fixed here, and each is commented where it
 * was:
 *
 *   THE CLAIM RAN `BEGIN` ON A SHARED CONNECTION. The reference wrapped its
 *   claim in `pg.query('BEGIN') … COMMIT` on a single long-lived `pg.Client`
 *   shared by the whole process — so every unrelated query issued by any other
 *   request while a claim was in flight joined that transaction, and rolled
 *   back with it. Two concurrent claims interleaved their BEGIN/COMMIT on the
 *   same connection with no isolation at all, which made the `FOR UPDATE` in
 *   the middle worthless. `claim()` below is a single conditional UPDATE.
 *
 *   THE "IS THIS RACE OVER" GUARD WAS DEAD CODE. It tested `race.end` against
 *   a SELECT that did not list that column, so the test was always against
 *   `undefined` and never fired. A settled race went on serving live standings
 *   for three days after its cron stopped. `#activeRace` filters on `status`
 *   in SQL, where it cannot be forgotten.
 *
 *   DECORATIVE ENTRIES WON REAL PRIZES. Settlement wrote a reward row for
 *   every board entry including the operator's fake ones, against user ids
 *   that exist in no table — unclaimable money, permanently occupying paid
 *   ranks. `settle()` ranks the board but pays only real players.
 *
 *   AN UNKNOWN CURRENCY SCORED AT 1:1. The points query did
 *   `COALESCE(er.usd_rate, 1)`, so a currency missing from `exchangerate` was
 *   treated as worth a dollar a unit. For a low-value currency that is a
 *   points multiplier of several thousand. `#toUsd` returns null and the row
 *   is excluded and counted, rather than silently winning the race.
 * ═════════════════════════════════════════════════════════════════════════
 */
class RaceService {
  constructor(deps) {
    const { models, db, logger, config, clients } = deps;
    this.models = models;
    this.db = db;
    this.logger = logger;
    this.config = config;
    this.clients = clients;
    this.wallet = deps.wallet ?? new WalletService(deps);
    this.timeZone = config?.RACE_TIMEZONE || 'Asia/Kolkata';
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Configuration
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Both races, as a player's client needs them.
   *
   * One request for the whole feature's on/off state, so a front end has a
   * single source of truth for whether to render any of this at all. The
   * multipliers come with it because the "how it works" copy should be read
   * from the configuration rather than typed into the page — the reference's
   * marketing text promised "Sports 3.0x, Slots 4.0x" against a live config of
   * 2.5 and ZERO, and there was no mechanism by which it could ever have been
   * right.
   */
  async listConfigs() {
    const rows = await this.models.RaceConfig.findAll({ order: [['type', 'ASC']], raw: true });
    const byType = new Map(rows.map((r) => [r.type, r]));

    return RACE_TYPES.map((type) => {
      const row = byType.get(type);
      // A type with no row is OFF, not "on by default". The reference treated a
      // missing `enabled` as enabled, which meant a half-applied migration
      // opened a promotion nobody had configured.
      if (!row) return { type, enabled: false, configured: false };
      return { ...this.#shapeConfig(row), configured: true };
    });
  }

  /** @returns the config row, or null. */
  async getConfig({ type }) {
    const row = await this.models.RaceConfig.findOne({ where: { type }, raw: true });
    return row ? this.#shapeConfig(row) : null;
  }

  /**
   * Save one race's configuration.
   *
   * The prize curve is recomputed here and stored. Every reader afterwards uses
   * the stored array — see `race.prizes.js` for why computing it twice was the
   * reference's bug rather than its design.
   */
  async updateConfig({ type, ...input }) {
    const existing = await this.models.RaceConfig.findOne({ where: { type } });
    if (!existing) throw errors.NOT_CONFIGURED({ type });

    const patch = {};
    const assign = (field, column, transform = (v) => v) => {
      if (input[field] !== undefined) patch[column] = transform(input[field]);
    };

    assign('enabled', 'enabled');
    assign('sportsPoints', 'sports_points', String);
    assign('casinoPoints', 'casino_points', String);
    assign('slotPoints', 'slot_points', String);
    assign('crashPoints', 'crash_points', String);
    assign('otherPoints', 'other_points', String);
    assign('prizePool', 'prize_pool');
    assign('platformFeePercent', 'platform_fee_percent', String);
    assign('winnerCount', 'winner_count');
    assign('top3Percentage', 'top3_percentage', String);
    assign('minPoints', 'min_points');
    assign('bookedSeatsEnabled', 'booked_seats_enabled');

    const merged = { ...existing.get({ plain: true }), ...patch };

    /**
     * Seats above the winner count can never be filled — the board is capped at
     * the paid ranks — so keeping them would leave the placement loop looking
     * for a rank that does not exist. Normalised on write, once, rather than
     * defensively re-parsed by every reader (the reference had two independent
     * parsers for this field, in two languages, that had to be kept in step).
     */
    if (input.bookedSeats !== undefined) {
      patch.booked_seats = [...new Set(input.bookedSeats)]
        .filter((r) => Number.isInteger(r) && r >= 1 && r <= Number(merged.winner_count))
        .sort((a, b) => a - b);
      merged.booked_seats = patch.booked_seats;
    }

    const { ranks } = buildRankPrizes({
      prizePool: merged.prize_pool,
      winnerCount: merged.winner_count,
      platformFeePercent: merged.platform_fee_percent,
      top3Percentage: merged.top3_percentage,
    });
    patch.rank_percentage = ranks;

    await this.models.RaceConfig.update(patch, { where: { type } });
    const row = await this.models.RaceConfig.findOne({ where: { type }, raw: true });

    /**
     * Switching a race ON opens its window immediately.
     *
     * Without this the promotion is live on the site but has no race to point
     * at until the next midnight — which reads to a player as a broken feature
     * and to an operator as a change that did not take.
     */
    if (patch.enabled === true) await this.openWindow({ type }).catch((error) => {
      this.logger?.error({ err: error, type }, 'Could not open a race window after enabling');
    });

    this.logger?.info({ type, changed: Object.keys(patch) }, 'Race configuration updated');
    return this.#shapeConfig(row);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  The board
  // ══════════════════════════════════════════════════════════════════════

  /**
   * The current standings for one race.
   *
   * @param {object} options
   * @param {'daily'|'weekly'} options.type
   * @param {number|null} [options.userId]  when present, the caller's own row is
   *   resolved even if it falls below the payout line — a player wants to know
   *   where they are, not only whether they are winning.
   */
  async leaderboard({ type, userId = null }) {
    const config = await this.getConfig({ type });
    if (!config) throw errors.NOT_CONFIGURED({ type });
    if (!config.enabled) throw errors.NOT_RUNNING({ type });

    const race = await this.#activeRace(type);
    if (!race) throw errors.NO_ACTIVE_RACE({ type });

    const { entries, unrated } = await this.#standings(race, config);

    const board = await this.#applyBookedSeats(entries, config, type);
    const paid = board.slice(0, config.winnerCount);

    const prizeByRank = new Map(config.rankPrizes.map((r) => [r.rank, r]));

    const rows = paid.map((entry, index) => {
      const rank = index + 1;
      const prize = prizeByRank.get(rank);
      return {
        rank,
        // Null for a decorative entry: it is not a player and has no id a
        // client could look up. `isBoat` says what it is instead.
        userId: entry.isBoat ? null : entry.userId,
        name: entry.name,
        points: entry.points,
        usdWagered: entry.usdWagered,
        bets: entry.bets,
        /**
         * A decorative entry is marked ON THE WIRE. The reference marked them
         * only in the operator's own console, so the player-facing board
         * rendered them identically to real people and no client could have
         * told the difference even if it wanted to.
         */
        isBoat: Boolean(entry.isBoat),
        reward: entry.isBoat ? '0' : (prize?.amount ?? '0'),
        percentage: prize?.percentage ?? 0,
      };
    });

    /** The caller's own standing, wherever it falls. */
    const meIndex = userId ? board.findIndex((e) => !e.isBoat && String(e.userId) === String(userId)) : -1;

    return {
      raceId: race.id,
      type,
      startsAt: race.starts_at,
      endsAt: race.ends_at,
      /**
       * GROSS and NET, both. The reference returned only the gross pool as
       * `prize_pool` while computing every rank's reward from the net — so the
       * headline said $100 and the ranks added up to $85, with nothing on the
       * wire to explain the gap.
       */
      prizePool: config.prizePool,
      netPrizePool: config.netPrizePool,
      currency: config.currency,
      multipliers: config.multipliers,
      winnerCount: config.winnerCount,
      leaderboard: rows,
      me:
        meIndex >= 0
          ? {
              rank: meIndex + 1,
              points: board[meIndex].points,
              usdWagered: board[meIndex].usdWagered,
              inPrizes: meIndex < config.winnerCount,
              reward: prizeByRank.get(meIndex + 1)?.amount ?? '0',
            }
          : null,
      /**
       * Turnover that could not be priced, rather than silently counted at 1:1.
       * Zero on a healthy platform; anything else is a currency missing from
       * `exchangerate` and a leaderboard that is quietly incomplete.
       */
      unratedCurrencies: unrated,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Windows
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Make sure the window containing `at` exists and is open.
   *
   * Idempotent by construction: `uq_races_window` means a second caller for the
   * same window gets a unique violation rather than a duplicate, and a second
   * OPEN race of the same type is refused by `uq_races_open`. The reference
   * expressed both as follow-up UPDATE statements with nothing enforcing them.
   */
  async openWindow({ type, at = new Date() }) {
    const config = await this.getConfig({ type });
    if (!config?.enabled) return null;

    const { startsAt, endsAt } = windowFor(type, at, this.timeZone);

    const existing = await this.models.Race.findOne({ where: { type, starts_at: startsAt }, raw: true });
    if (existing) return existing;

    try {
      const created = await this.models.Race.create({
        type,
        starts_at: startsAt,
        ends_at: endsAt,
        status: RACE_STATUS.OPEN,
      });
      this.logger?.info({ type, raceId: created.id, startsAt, endsAt }, 'Race window opened');
      return created.get({ plain: true });
    } catch (error) {
      /**
       * Either index can reject this, and both mean the same thing: somebody
       * else opened this window first. That is the correct outcome of two
       * workers racing, not an error to propagate.
       */
      if (error?.name === 'SequelizeUniqueConstraintError') {
        return this.models.Race.findOne({ where: { type, status: RACE_STATUS.OPEN }, raw: true });
      }
      throw error;
    }
  }

  /**
   * Close a finished window, write its prizes, and open the next.
   *
   * ── THE ORDER MATTERS ────────────────────────────────────────────────
   *
   * The next window is opened whether or not settlement succeeded. A race that
   * fails to settle must not also stop the promotion: the reference got this
   * right and it is worth keeping — an operator can re-run a settlement, but
   * nobody can retroactively give players back a day of racing.
   */
  async settleDue({ type, at = new Date() }) {
    const config = await this.getConfig({ type });
    if (!config?.enabled) return { settled: null, opened: null };

    const due = await this.models.Race.findOne({
      where: { type, status: RACE_STATUS.OPEN, ends_at: { [Op.lte]: at } },
      raw: true,
    });

    let settled = null;
    if (due) {
      try {
        settled = await this.settle({ raceId: due.id });
      } catch (error) {
        this.logger?.error({ err: error, type, raceId: due.id }, 'Race settlement failed — opening the next window anyway');
      }
    }

    const opened = await this.openWindow({ type, at });
    return { settled, opened };
  }

  /**
   * Settle one race: rank the board, write the prizes, close the window.
   *
   * ── ONE STATEMENT FOR EVERY REWARD ───────────────────────────────────
   *
   * The reference inserted rewards one row at a time, outside any transaction,
   * with `console.error` as the failure handler. Given `UNIQUE (race_id,
   * user_id)`, a run that died half way threw on every row it had already
   * written when retried — and because its re-entry check only asked whether
   * ANY reward existed for the race, a partial settlement could never be
   * completed. One `bulkCreate` with `ignoreDuplicates`, inside the same
   * transaction that closes the window.
   */
  async settle({ raceId }) {
    const race = await this.models.Race.findByPk(raceId, { raw: true });
    if (!race) throw errors.NO_ACTIVE_RACE({ raceId });

    const config = await this.getConfig({ type: race.type });
    if (!config) throw errors.NOT_CONFIGURED({ type: race.type });

    const { entries } = await this.#standings(race, config);

    /**
     * The board is ranked WITH decorative entries and paid WITHOUT them.
     *
     * A booked seat displaces a real player on the board, which is its whole
     * purpose. It must not displace them in the prizes — that is what produced
     * unclaimable reward rows against non-existent accounts in the reference,
     * with a large share of every pool written to them. So the payout list is
     * the real players in order, and rank N's prize goes to the Nth real
     * player.
     */
    const payable = entries
      .filter((e) => !e.isBoat && money.gte(e.points, config.minPoints))
      .slice(0, config.winnerCount);

    const prizeByRank = new Map(config.rankPrizes.map((r) => [r.rank, r]));

    const rewards = [];
    for (let i = 0; i < payable.length; i += 1) {
      const prize = prizeByRank.get(i + 1);
      // A taper across hundreds of ranks reaches amounts below a cent. Those
      // rows cost a claim each and credit nothing.
      if (!prize || money.lt(prize.amount, MIN_REWARD)) break;

      rewards.push({
        race_id: race.id,
        user_id: payable[i].userId,
        type: race.type,
        rank: i + 1,
        points: payable[i].points,
        currency: config.currency,
        amount: prize.amount,
      });
    }

    const totalAwarded = money.toDecimalString(money.sum(rewards.map((r) => r.amount)));

    await this.db.transaction(async (transaction) => {
      if (rewards.length) {
        await this.models.RaceReward.bulkCreate(rewards, { transaction, ignoreDuplicates: true });
      }

      await this.models.Race.update(
        {
          status: RACE_STATUS.SETTLED,
          settled_at: new Date(),
          /**
           * The configuration AS IT WAS. Changing the multipliers tomorrow must
           * not rewrite what this race paid, and a support desk asked "why did
           * rank 4 get $6.68" needs the answer that applied then.
           */
          snapshot: {
            multipliers: config.multipliers,
            top3Percentage: config.top3Percentage,
            minPoints: config.minPoints,
            rankPrizes: config.rankPrizes,
            bookedSeats: config.bookedSeatsEnabled ? config.bookedSeats : [],
          },
          prize_pool: config.prizePool,
          platform_fee_percent: config.platformFeePercent,
          winner_count: config.winnerCount,
          total_awarded: totalAwarded,
        },
        { where: { id: race.id }, transaction }
      );

      /** Decorative entries reset with the race they were placed in. */
      if (config.bookedSeatsEnabled) {
        await this.models.RaceBoat.update(
          race.type === 'daily'
            ? { daily_points: '0', daily_rank: null }
            : { weekly_points: '0', weekly_rank: null },
          { where: {}, transaction }
        );
      }
    });

    this.logger?.info(
      { raceId: race.id, type: race.type, winners: rewards.length, totalAwarded },
      'Race settled'
    );

    return { raceId: race.id, type: race.type, winners: rewards.length, totalAwarded };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Prizes
  // ══════════════════════════════════════════════════════════════════════

  /** A player's own prizes, claimed and not. */
  async myRewards({ userId, type, claimed, limit = 50, offset = 0 }) {
    const where = { user_id: userId };
    if (type) where.type = type;
    if (claimed !== undefined) where.claimed = claimed === 'true' || claimed === true;

    const { rows, count } = await this.models.RaceReward.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
      raw: true,
    });

    const races = await this.#racesByIds(rows.map((r) => r.race_id));

    /**
     * The unclaimed total, alongside the page.
     *
     * A client showing "you have prizes waiting" cannot compute that from one
     * page of rows, and the reference made it fetch every reward it had in
     * order to add them up.
     */
    const pending = await this.models.RaceReward.findAll({
      where: { user_id: userId, claimed: false },
      attributes: ['amount', 'currency'],
      raw: true,
    });

    return {
      total: count,
      unclaimedTotal: money.toDecimalString(money.sum(pending.map((p) => p.amount))),
      unclaimedCount: pending.length,
      currency: PRIZE_CURRENCY,
      rows: rows.map((r) => this.#shapeReward(r, races.get(String(r.race_id)))),
    };
  }

  /**
   * Take a prize into the wallet.
   *
   * ═══════════════════════════════════════════════════════════════════════
   * ONE CONDITIONAL UPDATE, NOT A TRANSACTION ON A SHARED CONNECTION
   *
   * The reference did this:
   *
   *     await pg.query('BEGIN');
   *     … SELECT … FOR UPDATE … UPDATE credits … UPDATE race_rewards …
   *     await pg.query('COMMIT');
   *
   * on a single `pg.Client` shared by every module in the process. That opens
   * a transaction across the WHOLE PROCESS: any unrelated query issued by any
   * other request while a claim was in flight silently joined it, and rolled
   * back with it if the claim failed. Two claims arriving together interleaved
   * their BEGIN and COMMIT on the same connection, so there was no isolation
   * for the `FOR UPDATE` to provide.
   *
   * `UPDATE … WHERE id = ? AND claimed = false RETURNING *` decides the race in
   * Postgres, in one statement. Exactly one caller gets a row back; everyone
   * else gets zero and is refused. The wallet credit then runs through the one
   * code path on this platform that takes a row lock, writes a ledger row and
   * carries an idempotency key.
   *
   * ── AND THE FLAG IS SET BEFORE THE MONEY MOVES ─────────────────────────
   *
   * Deliberately. If the credit then fails, the prize is marked claimed and
   * unpaid — visible, and recoverable by an operator. The other order fails the
   * other way: paid and still claimable, which pays again on every retry. The
   * idempotency key makes the double-credit impossible anyway; this makes the
   * remaining failure the one that does not cost money.
   * ═══════════════════════════════════════════════════════════════════════
   */
  async claim({ userId, rewardId }) {
    const reward = await this.models.RaceReward.findOne({
      where: { id: rewardId, user_id: userId },
      raw: true,
    });

    // Scoped to the caller, so a reward belonging to someone else is a 404 and
    // not a 403 — an id-guessing probe learns nothing from the difference.
    if (!reward) throw errors.REWARD_NOT_FOUND({ rewardId });
    if (reward.claimed) throw errors.ALREADY_CLAIMED({ rewardId });

    const claimedAt = new Date();
    const [affected] = await this.models.RaceReward.update(
      { claimed: true, claimed_at: claimedAt },
      { where: { id: rewardId, user_id: userId, claimed: false } }
    );

    if (affected !== 1) throw errors.ALREADY_CLAIMED({ rewardId });

    const movement = await this.wallet.credit(
      {
        userId,
        currency: reward.currency || PRIZE_CURRENCY,
        amount: String(reward.amount),
        reason: REASON.CLAIM,
        /**
         * The reward's own id. Unlike a rakeback accrual — which has no
         * identity once consumed and has to bucket its key by the minute — a
         * race prize is a row, so the key is exact: a replay returns the
         * original movement no matter how much later it arrives.
         */
        idempotencyKey: `race-reward:${reward.id}`,
        refType: 'RACE_REWARD',
        refId: String(reward.id),
        description: `${reward.type === 'weekly' ? 'Weekly' : 'Daily'} race — rank ${reward.rank}`,
      },
      { sourceService: 'user-service' }
    );

    /** Recorded on the row so a support desk can see the movement without a join. */
    await this.models.RaceReward.update(
      { balance_before: movement.previousBalance ?? null, balance_after: movement.newBalance ?? null },
      { where: { id: reward.id } }
    );

    this.logger?.info(
      { userId: String(userId), rewardId: reward.id, amount: String(reward.amount), ledgerId: movement.ledgerId },
      'Race reward claimed'
    );

    return {
      rewardId: reward.id,
      type: reward.type,
      rank: reward.rank,
      amount: money.toDecimalString(money.toMinor(reward.amount)),
      currency: reward.currency || PRIZE_CURRENCY,
      newBalance: movement.newBalance,
      claimedAt,
    };
  }

  /** Every prize, for the operator's console. */
  async listRewards({ type, userId, claimed, limit = 50, offset = 0 }) {
    const where = {};
    if (type) where.type = type;
    if (userId) where.user_id = userId;
    if (claimed !== undefined) where.claimed = claimed === 'true' || claimed === true;

    const { rows, count } = await this.models.RaceReward.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
      raw: true,
    });

    const races = await this.#racesByIds(rows.map((r) => r.race_id));
    const names = await this.#namesFor(rows.map((r) => r.user_id));

    return {
      total: count,
      rows: rows.map((r) => ({
        ...this.#shapeReward(r, races.get(String(r.race_id))),
        userId: String(r.user_id),
        // A rewards list keyed only by numeric id cannot be read by a person.
        username: names.get(String(r.user_id)) ?? null,
      })),
    };
  }

  /** Past races, newest first. */
  async listRaces({ type, limit = 20, offset = 0 }) {
    const { rows, count } = await this.models.Race.findAndCountAll({
      where: type ? { type } : {},
      order: [['starts_at', 'DESC']],
      limit,
      offset,
      raw: true,
    });

    return {
      total: count,
      rows: rows.map((r) => ({
        id: r.id,
        type: r.type,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        status: r.status,
        settledAt: r.settled_at,
        prizePool: money.toDecimalString(money.toMinor(r.prize_pool ?? '0')),
        winnerCount: r.winner_count,
        totalAwarded: money.toDecimalString(money.toMinor(r.total_awarded ?? '0')),
      })),
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Decorative entries
  // ══════════════════════════════════════════════════════════════════════

  async listBoats() {
    const rows = await this.models.RaceBoat.findAll({ order: [['id', 'ASC']], raw: true });
    return rows.map((r) => this.#shapeBoat(r));
  }

  async addBoat({ name, isActive = true }) {
    const row = await this.models.RaceBoat.create({ name, is_active: isActive });
    return this.#shapeBoat(row.get({ plain: true }));
  }

  async updateBoat({ id, ...input }) {
    const patch = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.isActive !== undefined) patch.is_active = input.isActive;

    const [affected] = await this.models.RaceBoat.update(patch, { where: { id } });
    if (!affected) throw errors.REWARD_NOT_FOUND({ id });

    const row = await this.models.RaceBoat.findByPk(id, { raw: true });
    return this.#shapeBoat(row);
  }

  async removeBoat({ id }) {
    const deleted = await this.models.RaceBoat.destroy({ where: { id } });
    if (!deleted) throw errors.REWARD_NOT_FOUND({ id });
    return { id, deleted: true };
  }

  /**
   * Park a decorative entry just above whoever holds each booked rank.
   *
   * Runs on a timer, so the placements track the real board as it moves. Walks
   * the booked ranks ASCENDING and re-sorts after each placement, because
   * placing a seat at rank 3 changes who is at rank 5.
   */
  async syncBoats({ type }) {
    const config = await this.getConfig({ type });
    if (!config?.enabled || !config.bookedSeatsEnabled || !config.bookedSeats.length) return { placed: 0 };

    const race = await this.#activeRace(type);
    if (!race) return { placed: 0 };

    const { entries } = await this.#standings(race, config);
    const pointsField = type === 'daily' ? 'daily_points' : 'weekly_points';
    const rankField = type === 'daily' ? 'daily_rank' : 'weekly_rank';

    const boats = await this.models.RaceBoat.findAll({
      where: { is_active: true },
      order: [['id', 'ASC']],
      raw: true,
    });

    /**
     * Placement starts from the REAL board every tick.
     *
     * `#standings` returns players only, so there is never a decorative entry
     * already sitting at a booked rank to leave alone — the reference carried a
     * "is this seat already taken by one of ours" branch, and against a board
     * built the same way it could not fire. Recomputing is also the correct
     * behaviour rather than merely the simpler one: a seat is a position
     * relative to live players, and players move.
     */
    const board = [...entries].sort((a, b) => money.compare(b.points, a.points));
    const used = new Set();
    const writes = [];

    for (const seat of config.bookedSeats) {
      // A seat above the payout line can never be filled: the board is capped
      // at `winner_count`. Saved configs are already filtered, so this catches
      // a winner count that was lowered afterwards.
      if (seat > config.winnerCount) continue;

      const occupant = board[seat - 1];
      const boat = boats.find((b) => !used.has(String(b.id)));
      if (!boat) {
        // Loud: the board silently stops honouring booked seats past this
        // point, which looks like the feature not working rather than a
        // shortage of rows to work with.
        this.logger?.warn({ type, seat }, 'Not enough race boats for the booked seats — add more');
        break;
      }
      used.add(String(boat.id));

      const points = this.#boostPoints(occupant?.points ?? '0', board[seat - 2]?.points ?? null);

      writes.push({ id: boat.id, points, rank: seat });
      board.splice(seat - 1, 0, {
        userId: null, boatId: boat.id, name: boat.name, points, usdWagered: points, bets: 0, isBoat: true,
      });
    }

    for (const write of writes) {
      await this.models.RaceBoat.update(
        { [pointsField]: write.points, [rankField]: write.rank },
        { where: { id: write.id } }
      );
    }

    /** Anything not placed this pass drops off the board rather than lingering. */
    const idle = boats.filter((b) => !used.has(String(b.id))).map((b) => b.id);
    if (idle.length) {
      await this.models.RaceBoat.update(
        { [pointsField]: '0', [rankField]: null },
        { where: { id: idle } }
      );
    }

    return { placed: writes.length };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Internals
  // ══════════════════════════════════════════════════════════════════════

  /**
   * The open race of a type, if there is one.
   *
   * `status` is in the WHERE clause, not tested in JavaScript against a column
   * somebody might forget to select. That omission is exactly what left the
   * reference serving a three-day-old race as if it were live.
   */
  async #activeRace(type) {
    return this.models.Race.findOne({
      where: { type, status: RACE_STATUS.OPEN },
      order: [['starts_at', 'DESC']],
      raw: true,
    });
  }

  /**
   * Every player's points for a race, ranked.
   *
   * Casino and sports each report their own turnover for the window; this
   * converts to USD, applies the operator's per-bucket multipliers, and sums.
   */
  async #standings(race, config) {
    const window = { from: new Date(race.starts_at).toISOString(), to: new Date(race.ends_at).toISOString() };

    /**
     * Both services in parallel, and NEITHER is allowed to fail quietly.
     *
     * A leaderboard missing one source is not a smaller leaderboard, it is a
     * wrong one — the players who only bet on sports simply vanish. So a
     * failure propagates and the endpoint errors, rather than rendering a board
     * that looks complete.
     */
    const [casino, sports] = await Promise.all([
      this.clients.casino.get('/internal/casino/wager/race-points', { query: window }),
      this.clients.sports.get('/internal/sports/wager/race-points', { query: window }),
    ]);

    const rates = await this.#usdRates();
    const totals = new Map();
    const unrated = new Map();

    const add = (userId, usd, bucket, bets) => {
      const multiplier = config.multipliers[bucket] ?? '0';
      const key = String(userId);
      const current = totals.get(key) ?? { userId: key, usdWagered: 0n, points: 0n, bets: 0 };
      current.usdWagered += money.toMinor(usd);
      current.points += money.multiply(usd, multiplier);
      current.bets += bets;
      totals.set(key, current);
    };

    for (const row of casino?.rows ?? []) {
      const usd = this.#toUsd(row.amount, row.currency, rates);
      if (usd === null) {
        // Counted, not guessed. The reference's `COALESCE(usd_rate, 1)` treated
        // an unpriced currency as a dollar a unit, which for a low-value
        // currency is a points multiplier in the thousands.
        unrated.set(row.currency, (unrated.get(row.currency) ?? 0) + row.bets);
        continue;
      }
      add(row.userId, usd, row.bucket, row.bets);
    }

    // Sports is already priced — converted at stake time by the service that
    // placed the bet. See its `racePoints`.
    for (const row of sports?.rows ?? []) add(row.userId, row.usd, 'sports', row.bets);

    const names = await this.#namesFor([...totals.keys()]);

    const entries = [...totals.values()]
      .map((t) => ({
        userId: t.userId,
        name: names.get(t.userId) ?? null,
        points: money.toDecimalString(t.points),
        usdWagered: money.toDecimalString(t.usdWagered),
        bets: t.bets,
        isBoat: false,
      }))
      .filter((e) => money.gt(e.points, '0'))
      .sort((a, b) => money.compare(b.points, a.points) || Number(a.userId) - Number(b.userId));

    return {
      entries,
      unrated: [...unrated.entries()].map(([currency, bets]) => ({ currency, bets })),
    };
  }

  /**
   * Merge the currently-placed decorative entries into a ranked board.
   *
   * Reads their points from `race_boats` rather than recomputing a placement,
   * so what a player sees is what `syncBoats` last decided — two callers
   * computing a placement independently is how a board ends up showing a
   * different order to two people looking at the same race.
   */
  async #applyBookedSeats(entries, config, type) {
    if (!config.bookedSeatsEnabled) return entries;

    const pointsField = type === 'daily' ? 'daily_points' : 'weekly_points';
    const rankField = type === 'daily' ? 'daily_rank' : 'weekly_rank';

    const placed = await this.models.RaceBoat.findAll({
      where: { is_active: true, [rankField]: { [Op.ne]: null } },
      order: [[rankField, 'ASC']],
      raw: true,
    });

    const board = [...entries];

    for (const row of placed) {
      const boat = { id: row.id, name: row.name, points: money.toDecimalString(money.toMinor(row[pointsField] ?? '0')) };
      if (money.lte(boat.points, '0')) continue;
      board.push({
        userId: null,
        boatId: boat.id,
        name: boat.name,
        points: boat.points,
        // A decorative entry has no bets behind it. Reporting its points as
        // turnover — which the reference did — invents a wagering figure.
        usdWagered: '0',
        bets: 0,
        isBoat: true,
      });
    }

    return board.sort((a, b) => money.compare(b.points, a.points));
  }

  /** `usd_rate` is USD per 1 unit of the currency. */
  async #usdRates() {
    const rows = await this.models.Exchangerate.findAll({ raw: true });
    const rates = new Map();
    for (const row of rows) {
      const rate = Number(row.usd_rate);
      if (Number.isFinite(rate) && rate > 0) rates.set(String(row.currency).toUpperCase(), String(row.usd_rate));
    }
    return rates;
  }

  /** Null when the currency has no rate — the caller decides what that means. */
  #toUsd(amount, currency, rates) {
    const upper = String(currency).toUpperCase();
    if (upper === 'USD' || upper === 'USDT') return money.toDecimalString(money.toMinor(amount));

    const rate = rates.get(upper);
    if (!rate) return null;
    return money.toDecimalString(money.multiply(amount, rate));
  }

  /**
   * Where to place a decorative entry so it sits at a given rank.
   *
   * Between the rank above and the player it is displacing, so the ordering is
   * strict and the entry does not tie with anyone. With nobody above, a small
   * margin over the displaced player.
   */
  #boostPoints(realPoints, upperPoints) {
    const real = money.toMinor(realPoints ?? '0');

    if (upperPoints !== null && money.gt(upperPoints, realPoints)) {
      return money.toDecimalString((real + money.toMinor(upperPoints)) / 2n);
    }

    // A board where nobody has scored yet: any positive number ranks first.
    if (real <= 0n) return money.toDecimalString(money.toMinor('1'));

    const margin = money.percentOf(real, 5);
    return money.toDecimalString(real + (margin > 0n ? margin : 1n));
  }

  async #namesFor(userIds) {
    const ids = [...new Set(userIds.map(String))].filter(Boolean);
    if (!ids.length) return new Map();

    const users = await this.models.Users.findAll({
      where: { id: ids },
      attributes: ['id', 'name'],
      raw: true,
    });
    return new Map(users.map((u) => [String(u.id), u.name ?? null]));
  }

  async #racesByIds(raceIds) {
    const ids = [...new Set(raceIds.map(String))].filter(Boolean);
    if (!ids.length) return new Map();

    const rows = await this.models.Race.findAll({
      where: { id: ids },
      attributes: ['id', 'type', 'starts_at', 'ends_at'],
      raw: true,
    });
    return new Map(rows.map((r) => [String(r.id), r]));
  }

  #shapeConfig(row) {
    const prizePool = money.toDecimalString(money.toMinor(row.prize_pool ?? '0'));
    const fee = String(row.platform_fee_percent ?? '0');

    const stored = Array.isArray(row.rank_percentage) ? row.rank_percentage : [];
    /**
     * The STORED curve is the one that pays.
     *
     * It is recomputed here only when the column is empty — a row seeded by the
     * migration, before an operator has ever saved. Recomputing it on every
     * read is what let the reference's operator console and its player-facing
     * board disagree about the same race.
     */
    const rankPrizes = stored.length
      ? stored
      : buildRankPrizes({
          prizePool,
          winnerCount: row.winner_count,
          platformFeePercent: fee,
          top3Percentage: row.top3_percentage,
        }).ranks;

    return {
      type: row.type,
      enabled: Boolean(row.enabled),
      multipliers: Object.fromEntries(
        RACE_BUCKETS.map((bucket) => [bucket, String(row[BUCKET_COLUMN[bucket]] ?? '0')])
      ),
      prizePool,
      // What the ranks actually add up to. Both, so a headline and a prize
      // table cannot be presented as the same number.
      netPrizePool: money.toDecimalString(money.subtract(prizePool, money.percentOf(prizePool, fee))),
      currency: row.currency || PRIZE_CURRENCY,
      platformFeePercent: fee,
      winnerCount: Number(row.winner_count ?? 0),
      top3Percentage: String(row.top3_percentage ?? '0'),
      minPoints: money.toDecimalString(money.toMinor(row.min_points ?? '0')),
      rankPrizes,
      bookedSeatsEnabled: Boolean(row.booked_seats_enabled),
      bookedSeats: Array.isArray(row.booked_seats) ? row.booked_seats : [],
    };
  }

  #shapeReward(row, race) {
    return {
      id: row.id,
      raceId: row.race_id,
      type: row.type,
      rank: row.rank,
      points: money.toDecimalString(money.toMinor(row.points ?? '0')),
      amount: money.toDecimalString(money.toMinor(row.amount ?? '0')),
      currency: row.currency || PRIZE_CURRENCY,
      claimed: Boolean(row.claimed),
      claimedAt: row.claimed_at,
      createdAt: row.created_at,
      raceStartsAt: race?.starts_at ?? null,
      raceEndsAt: race?.ends_at ?? null,
    };
  }

  #shapeBoat(row) {
    return {
      id: row.id,
      name: row.name,
      isActive: Boolean(row.is_active),
      dailyPoints: money.toDecimalString(money.toMinor(row.daily_points ?? '0')),
      weeklyPoints: money.toDecimalString(money.toMinor(row.weekly_points ?? '0')),
      dailyRank: row.daily_rank,
      weeklyRank: row.weekly_rank,
    };
  }
}

module.exports = { RaceService };
