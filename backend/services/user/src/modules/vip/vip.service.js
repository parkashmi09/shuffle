'use strict';

const { Op } = require('sequelize');
const { resolveVipLadder, vipRewards, money } = require('@ibitplay/common');

const { WalletService } = require('../wallet/wallet.service');
const { REASON } = require('../wallet/wallet.constants');

const {
  PERIOD_MS,
  CLAIM_WINDOW_MS,
  periodicAmount,
  levelUpAmount,
  rankUpAmount,
  rakebackRateForCard,
} = vipRewards;

/**
 * The wallet VIP progression pays into.
 *
 * NOT the bonus currency. `bonus.service.js` claims settle in whatever
 * `rewardCurrencies.bonusCurrency()` resolves from siteconfig (USDT by
 * default); level-ups and rank-ups are BJB, which is what
 * `packages/common/src/vipRewards.js` documents against `levelUp` and
 * `rankUp` and what the operator's VIP reports read. Routing these through
 * the configurable currency would silently re-denominate the whole ladder.
 */
const PROGRESSION_CURRENCY = 'BJB';

/** The three recurring awards, in the order the ladder pays them. */
const PERIODS = ['daily', 'weekly', 'monthly'];

/**
 * Where a player stands on the ladder — THIS site's ladder.
 *
 * Both reads are thin on purpose: the arithmetic lives in
 * `packages/common/src/vipLadder.js` and the choice of ladder in
 * `vipLadders.js`, both shared with `bonus.service.js`, the profile socket
 * and the operator's reports. That is what keeps the level shown on the VIP
 * page, the level the bonus gates compare against and the level a support
 * agent reads from ever disagreeing.
 */
class VipService {
  constructor(deps) {
    const { models, db, logger } = deps;
    this.models = models;
    this.db = db;
    this.logger = logger;
    /* Built from the same deps every other money path uses, so a VIP credit
       and a bonus claim share one ledger, one idempotency table and one
       guarded UPDATE. */
    this.wallet = new WalletService(deps);
  }

  /**
   * A stored wager counter as a number this ladder can be measured against.
   *
   * Same defensive parse as `standing` — legacy wrote "1,234,567.89" into
   * `userwager.wager`, and `Number("1,234")` is NaN, which reads as VIP 0 for
   * the biggest player on the site. `onWager` takes its wagers as ARGUMENTS
   * from casino-service rather than from that column, but they originate
   * there, so they arrive with the same hazard.
   */
  #wager(value) {
    const cleaned = value == null ? '0' : String(value).replace(/,/g, '').trim();
    return /^-?\d+(\.\d+)?$/.test(cleaned) ? cleaned : '0';
  }

  #ladder() {
    return resolveVipLadder(this.models, { logger: this.logger });
  }

  /**
   * The ladder. Same for everyone on this site, no login.
   *
   * `maxXp` on the top band is `null` rather than its stored number:
   * `levelFor` treats the last band as OPEN-ENDED — that is the fix for
   * legacy's biggest-player-becomes-VIP-0 bug — so publishing a ceiling there
   * would describe behaviour the platform does not have.
   */
  async levels() {
    const ladder = await this.#ladder();
    return {
      ladder: ladder.key,
      label: ladder.label,
      unranked: ladder.unranked,
      bonusGates: ladder.bonusGates,
      levels: ladder.publish(),
    };
  }

  /**
   * This player's standing.
   *
   * ── `userwager.wager` IS TEXT, AND MAY CARRY THOUSANDS SEPARATORS ──────
   *
   * Legacy wrote "1,234,567.89" into it. `Number("1,234")` is NaN, so a missed
   * `replace` here silently makes every player VIP 0 — the same trap
   * `bonus.service.js`'s `#wagerAmount` documents, and the reason this parses
   * rather than casts. Anything that is not a plain decimal after the strip is
   * treated as no wager, which is the honest reading of an unparseable counter.
   */
  async standing(userId) {
    const [ladder, row] = await Promise.all([
      this.#ladder(),
      this.models.Userwager.findOne({ where: { uid: userId }, raw: true }),
    ]);

    const raw = row?.wager;
    const cleaned = raw == null ? '0' : String(raw).replace(/,/g, '').trim();
    const wager = /^-?\d+(\.\d+)?$/.test(cleaned) ? cleaned : '0';

    return { ...ladder.levelFor(wager), ladder: ladder.key, totalLevels: ladder.levels.length };
  }

  /**
   * casino-service calls this after every stake that moves `userwager`.
   *
   * Three things happen, in this order, and the order matters:
   *
   *   1. the player's rakeback RATE is synced to their current card;
   *   2. one `levelUp` credit per level gained;
   *   3. one `rankUp` credit per card climbed into.
   *
   * ── THE WAGERS ARE ARGUMENTS, NOT A READ ────────────────────────────────
   *
   * `previousWager` and `newWager` come from the caller because casino-service
   * has just written the new total and holds both sides of the move. Reading
   * `userwager` here instead would race that write and, worse, would make the
   * method unable to tell a level GAIN from a level the player already had —
   * and the difference between those two is whether money is paid.
   *
   * ── WHY THE RATE IS A GUARDED UPDATE ────────────────────────────────────
   *
   * This runs on every settled bet. `WHERE rakeback <> :rate` means the common
   * case — a player whose card has not moved — writes no row at all, instead
   * of one UPDATE per bet per player for a value that did not change.
   *
   * ── WHY NOTHING HERE PAYS TWICE ─────────────────────────────────────────
   *
   * Each credit carries an `idempotencyKey` naming the thing being paid for
   * rather than this call: `vip:level_up:<user>:<level>` and
   * `vip:rank_up:<user>:<card>`. A level can only be reached once, so a
   * retried call, a duplicated settlement, or two overlapping wagers that
   * cross the same band all collapse onto the same key and the wallet pays
   * once. That is the same mechanism `bonus.claim` uses (`bonus:<award id>`),
   * and it is stronger than checking the level first, because the check and
   * the credit cannot be made atomic from here.
   *
   * ── ENTERING THE LADDER IS NOT A RANK-UP ────────────────────────────────
   *
   * `unranked → wood` pays the Wood `levelUp` and nothing else; a rank-up is
   * a move from one RANKED card to another, so it is `wood → bronze` that
   * pays Bronze's `rankUp`. That is what `vip.test.js` pins: crossing into
   * Wood leaves exactly `0.50000000`, which is the Wood level-up alone, while
   * a jump to Bronze 1 must report both kinds. Paying Wood's `rankUp` on the
   * way in would make every new player's first bet worth an extra unit.
   */
  async onWager({ userId, previousWager, newWager }) {
    if (!userId) return { vip: null, rate: null, granted: [] };

    const ladder = await this.#ladder();
    const before = ladder.levelFor(this.#wager(previousWager));
    const after = ladder.levelFor(this.#wager(newWager));

    const rate = rakebackRateForCard(after.card);
    await this.models.Users.update(
      { rakeback: rate },
      { where: { id: userId, rakeback: { [Op.ne]: rate } } }
    );

    /* Wager went nowhere, or nowhere that crosses a band. Nothing is owed. */
    if (!(after.level > before.level)) {
      return { vip: after, rate, granted: [] };
    }

    /* The bands actually gained, in order — the ones that may pay. */
    const climbed = [];
    for (let level = before.level + 1; level <= after.level; level += 1) {
      const band = ladder.levels.find((b) => b.level === level);
      if (band) climbed.push(band);
    }

    /* Decide every payment before writing any, so the transaction is short. */
    const due = [];
    for (const band of climbed) {
      const amount = levelUpAmount(band.level);
      if (money.gt(amount, '0')) {
        due.push({
          kind: 'level_up',
          level: band.level,
          card: band.card,
          amount: money.toDecimalString(money.toMinor(amount)),
          idempotencyKey: `vip:level_up:${userId}:${band.level}`,
          description: `VIP ${band.name} level-up`,
          refId: String(band.level),
        });
      }
    }

    let fromCard = before.card;
    let fromLevel = before.level;
    for (const band of climbed) {
      if (band.card !== fromCard) {
        /* `fromLevel > 0` is the ranked test — level 0 is Unranked, and
           leaving it is getting ranked, not ranking up. */
        const amount = fromLevel > 0 ? rankUpAmount(band.card) : '0';
        if (money.gt(amount, '0')) {
          due.push({
            kind: 'rank_up',
            level: band.level,
            card: band.card,
            amount: money.toDecimalString(money.toMinor(amount)),
            idempotencyKey: `vip:rank_up:${userId}:${band.card}`,
            description: `VIP ${band.card} rank-up`,
            refId: band.card,
          });
        }
        fromCard = band.card;
      }
      fromLevel = band.level;
    }

    if (due.length === 0) return { vip: after, rate, granted: [] };

    const granted = await this.db.transaction(async (transaction) => {
      const paid = [];
      for (const award of due) {
        const movement = await this.wallet.credit(
          {
            userId,
            currency: PROGRESSION_CURRENCY,
            amount: award.amount,
            reason: REASON.BONUS,
            idempotencyKey: award.idempotencyKey,
            refType: award.kind === 'level_up' ? 'VIP_LEVEL_UP' : 'VIP_RANK_UP',
            refId: award.refId,
            description: award.description,
          },
          { sourceService: 'user-service', transaction }
        );

        paid.push({
          kind: award.kind,
          level: award.level,
          card: award.card,
          amount: award.amount,
          currency: PROGRESSION_CURRENCY,
          /* A replay reports the grant but flags that no new money moved, so
             a caller can tell "paid now" from "already paid". The wallet
             names this `replayed` — see `#describeReplay`, which returns the
             ORIGINAL ledger row rather than writing a second one. */
          replayed: Boolean(movement?.replayed),
        });
      }
      return paid;
    });

    this.logger?.info(
      { userId: String(userId), from: before.level, to: after.level, granted: granted.length },
      'VIP progression credited'
    );

    return { vip: after, rate, granted };
  }

  /**
   * The most recent award of each recurring type, as rows.
   *
   * One query for all three rather than three — `bonus_history` is the whole
   * platform's award table and a per-type round trip on every `/user/bonus`
   * read is three index scans where one does.
   */
  async #latestAwards(userId) {
    const rows = await this.models.BonusClaim.findAll({
      where: { userid: userId, bonus_type: { [Op.in]: PERIODS } },
      order: [['created_at', 'DESC']],
      raw: true,
    });

    const latest = {};
    for (const row of rows) {
      if (!latest[row.bonus_type]) latest[row.bonus_type] = row;
    }
    return latest;
  }

  /**
   * When each recurring award next becomes due.
   *
   * `{ daily, weekly, monthly }` of ISO timestamps, or `null` per type where
   * nothing has been awarded yet — the card then reads "Wager to Unlock"
   * rather than counting down to a date that was never set. Null is also the
   * answer for a type this player's card does not pay at all.
   *
   * A READ. It reports what the award rows already say; `awardPeriodic` is the
   * only thing that writes them.
   */
  async nextClaimTimes({ userId, vip }) {
    const latest = await this.#latestAwards(userId);
    const card = vip?.card;

    const out = {};
    for (const type of PERIODS) {
      const pays = card && periodicAmount(card, type) !== '0';
      const last = latest[type]?.created_at;
      out[type] = pays && last ? new Date(new Date(last).getTime() + PERIOD_MS[type]).toISOString() : null;
    }
    return out;
  }

  /**
   * Write any recurring award that has come due for this player.
   *
   * ── WHAT "DUE" MEANS ────────────────────────────────────────────────────
   *
   * One award per period per type. The last row of that type is the clock: if
   * it was written less than `PERIOD_MS[type]` ago the period has not rolled,
   * so nothing is written. With no row at all the first award is due now,
   * which is how a player who has just reached a paying card gets their first
   * one without waiting a full period for it.
   *
   * The amount comes from the player's CURRENT card — `vipRewards.CARD_REWARDS`
   * — so a card that pays nothing for a period (every card for `monthly` below
   * Silver, say) writes nothing rather than a zero-value row a player could
   * "claim" for nothing.
   *
   * ── IT IS CALLED FROM A READ, SO IT HAS TO BE CHEAP AND IDEMPOTENT ──────
   *
   * `bonus.service.js#overview` calls this before it reports, which is what
   * makes the cards correct on a page load rather than only after a worker
   * has run. Two overlapping reads must not produce two awards: the insert is
   * guarded by the same period check inside a transaction that locks the
   * player's rows of that type, so the second read finds the first's row.
   */
  async awardPeriodic({ userId }) {
    if (!userId) return { awarded: 0, rows: [] };

    const vip = await this.standing(userId);
    if (!vip?.card) return { awarded: 0, rows: [] };

    const rows = [];
    const now = Date.now();

    for (const type of PERIODS) {
      const amount = periodicAmount(vip.card, type);
      if (!amount || amount === '0') continue;

      try {
        await this.models.BonusClaim.sequelize.transaction(async (transaction) => {
          const last = await this.models.BonusClaim.findOne({
            where: { userid: userId, bonus_type: type },
            order: [['created_at', 'DESC']],
            transaction,
            lock: transaction.LOCK.UPDATE,
          });

          if (last && now - new Date(last.created_at).getTime() < PERIOD_MS[type]) return;

          await this.models.BonusClaim.create(
            {
              userid: userId,
              bonus_type: type,
              bonus_amount: amount,
              wager_change: '0',
              claim_deadline: new Date(now + CLAIM_WINDOW_MS[type]),
              is_claimed: false,
              is_unclaimable: false,
            },
            { transaction }
          );

          rows.push({ type, amount });
        });
      } catch (error) {
        /*
         * A failed award must not fail the read that triggered it. The player
         * sees the cards they already had; the next read tries again.
         */
        this.logger?.warn({ err: error, userId: String(userId), type }, 'Periodic VIP award failed');
      }
    }

    /*
     * `awarded` is a COUNT, not the rows — that is the contract every caller
     * was already written against: `vip.test.js` asserts `awarded >= 2` on the
     * first sweep and `awarded === 0` on the second, and an array satisfies
     * neither (`[obj, obj] >= 2` is a NaN comparison, so it is quietly false).
     * The rows ride along under their own key for the internal route, which
     * returns this body straight to an operator who wants to see WHICH awards
     * landed; both `bonus.service.js` call sites discard the value entirely.
     */
    return { awarded: rows.length, rows };
  }

  /**
   * Write every recurring award that has come due, for every player.
   *
   * ── WHY THIS EXISTS WHEN `overview` ALREADY MATERIALISES AWARDS ─────────
   *
   * `bonus.service.js#overview` calls `awardPeriodic` for the player doing the
   * reading, which is what makes the cards correct the moment somebody opens
   * the VIP page. That covers everyone who LOOKS. It does not cover the player
   * who stops visiting for a fortnight and comes back expecting the daily
   * awards they were owed, and it does not cover the operator's reports, which
   * read `bonus_history` rather than calling anything.
   *
   * `internal.routes.js` has described this as "the same work the worker runs
   * on an interval" since the module was written, and no worker ran it — the
   * manifest declared no jobs at all. This is that work.
   *
   * ── IT SKIPS THE MAJORITY WITHOUT ASKING THE DATABASE ABOUT THEM ────────
   *
   * Only Bronze and above are paid anything: every period on `unranked` and
   * `wood` is '0'. So the band is computed here from the wager row already in
   * hand and non-paying players are dropped before `awardPeriodic` — which
   * would otherwise spend a `standing` query per player to reach the same
   * conclusion. On a real book that is the difference between a handful of
   * writes and one query per account per tick.
   *
   * `limit` caps the PAYING players visited in one tick, not the rows scanned,
   * so a slow sweep cannot pile ticks on top of each other. The count is a
   * ceiling rather than a cursor: awards are idempotent per period, so the
   * next tick redoing the same players costs an indexed read each and reaches
   * the ones it missed as soon as the earlier ones stop being due.
   */
  async sweepPeriodic({ limit = 500, batchSize = 200 } = {}) {
    const ladder = await this.#ladder();
    const pays = (card) => PERIODS.some((type) => periodicAmount(card, type) !== '0');

    let scanned = 0;
    let eligible = 0;
    let awarded = 0;
    let offset = 0;

    while (eligible < limit) {
      const rows = await this.models.Userwager.findAll({
        order: [['uid', 'ASC']],
        limit: batchSize,
        offset,
        raw: true,
      });
      if (!rows.length) break;
      offset += rows.length;

      for (const row of rows) {
        scanned += 1;
        if (!pays(ladder.levelFor(this.#wager(row.wager)).card)) continue;

        eligible += 1;
        const result = await this.awardPeriodic({ userId: row.uid });
        awarded += result.awarded;
        if (eligible >= limit) break;
      }
    }

    if (awarded) {
      this.logger?.info({ scanned, eligible, awarded }, 'Periodic VIP awards swept');
    }
    return { scanned, eligible, awarded };
  }
}

module.exports = { VipService };
