'use strict';

const test = require('node:test');
const assert = require('node:assert');

const db = require('@ibitplay/db');
const { createLogger, money, bucketFor } = require('@ibitplay/common');

const { buildRankPrizes } = require('../race.prizes');
const { windowFor } = require('../race.window');
const { RaceService } = require('../race.service');
const { MIN_REWARD } = require('../race.constants');

/**
 * The wagering race.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * The maths and the window arithmetic are pure, and are tested without a
 * database — they are also where the ported implementation's arithmetic bugs
 * lived, so they are worth testing everywhere rather than only where a
 * PostgreSQL happens to be reachable.
 *
 * The claim needs the real wallet and the real constraints, so those cases
 * skip when there is no test database. That is the same split the other money
 * modules use.
 * ═════════════════════════════════════════════════════════════════════════
 */

const TEST_DB = process.env.TEST_DB_NAME || 'ibitplay_test';
const IST = 'Asia/Kolkata';

// ══════════════════════════════════════════════════════════════════════
//  The prize curve
// ══════════════════════════════════════════════════════════════════════

test('the prize curve', async (t) => {
  await t.test('the parts add up to exactly the net pool', () => {
    const { netPool, ranks } = buildRankPrizes({
      prizePool: '100', winnerCount: 25, platformFeePercent: 15, top3Percentage: 61,
    });

    assert.strictEqual(netPool, '85.00000000');
    // Not "close to". A taper that leaves dust unassigned is a discrepancy
    // that grows by a few satoshi a day for as long as the race runs.
    assert.strictEqual(money.toDecimalString(money.sum(ranks.map((r) => r.amount))), netPool);
  });

  await t.test('the podium tapers by half and the tail by four fifths', () => {
    const { ranks } = buildRankPrizes({
      prizePool: '100', winnerCount: 25, platformFeePercent: 15, top3Percentage: 61,
    });

    assert.strictEqual(ranks[0].amount, '29.62857142');
    assert.strictEqual(ranks[1].amount, '14.81428571');
    assert.strictEqual(ranks[2].amount, '7.40714287');
    // Strictly decreasing, all the way down: a rank that pays more than the one
    // above it is the single most visible way this can be wrong.
    for (let i = 1; i < ranks.length; i += 1) {
      assert.ok(money.lte(ranks[i].amount, ranks[i - 1].amount), `rank ${i + 1} pays more than rank ${i}`);
    }
  });

  await t.test('with three or fewer winners the podium takes the whole pool', () => {
    // Otherwise a race with 3 winners and a 60% podium share quietly pays out
    // 60% of its pool and keeps the rest with nobody to give it to.
    const { ranks } = buildRankPrizes({
      prizePool: '100', winnerCount: 3, platformFeePercent: 0, top3Percentage: 60,
    });
    assert.strictEqual(money.toDecimalString(money.sum(ranks.map((r) => r.amount))), '100.00000000');
  });

  await t.test('percentages are shares of the NET pool and total 100', () => {
    const { ranks } = buildRankPrizes({
      prizePool: '3000', winnerCount: 50, platformFeePercent: 10, top3Percentage: 60,
    });
    const total = ranks.reduce((sum, r) => sum + r.percentage, 0);
    assert.ok(Math.abs(total - 100) < 0.01, `percentages total ${total}`);
  });

  await t.test('no winners, or an empty pool, is an empty curve rather than a crash', () => {
    assert.deepStrictEqual(buildRankPrizes({ prizePool: '100', winnerCount: 0, platformFeePercent: 0, top3Percentage: 60 }).ranks, []);
    assert.deepStrictEqual(buildRankPrizes({ prizePool: '0', winnerCount: 10, platformFeePercent: 0, top3Percentage: 60 }).ranks, []);
  });

  await t.test('a 100% platform fee leaves nothing to pay out', () => {
    const { netPool, ranks } = buildRankPrizes({
      prizePool: '100', winnerCount: 10, platformFeePercent: 100, top3Percentage: 60,
    });
    assert.strictEqual(netPool, '0.00000000');
    assert.deepStrictEqual(ranks, []);
  });

  await t.test('a long tail reaches amounts below the minimum reward', () => {
    // Settlement stops at MIN_REWARD rather than writing rows that cost a claim
    // each and credit nothing. This asserts the tail really does get there, so
    // that guard is exercised rather than theoretical.
    const { ranks } = buildRankPrizes({
      prizePool: '100', winnerCount: 200, platformFeePercent: 0, top3Percentage: 60,
    });
    assert.ok(money.lt(ranks[ranks.length - 1].amount, MIN_REWARD));
  });
});

// ══════════════════════════════════════════════════════════════════════
//  Windows
// ══════════════════════════════════════════════════════════════════════

test('race windows', async (t) => {
  await t.test('a daily race runs local midnight to local midnight', () => {
    const { startsAt, endsAt } = windowFor('daily', new Date('2026-09-14T10:00:00Z'), IST);
    // IST is UTC+5:30, so local midnight is 18:30 the previous UTC day.
    assert.strictEqual(startsAt.toISOString(), '2026-09-13T18:30:00.000Z');
    assert.strictEqual(endsAt.toISOString(), '2026-09-14T18:30:00.000Z');
  });

  await t.test('the boundary belongs to exactly one race', () => {
    // Half-open. `BETWEEN`, which the ported implementation used, is closed at
    // both ends — a bet at the stroke of midnight scored in two races.
    const before = windowFor('daily', new Date('2026-09-13T18:29:59Z'), IST);
    const after = windowFor('daily', new Date('2026-09-13T18:30:00Z'), IST);
    assert.strictEqual(before.endsAt.toISOString(), after.startsAt.toISOString());
    assert.notStrictEqual(before.startsAt.toISOString(), after.startsAt.toISOString());
  });

  await t.test('a weekly race runs Monday to Monday in local time', () => {
    // 2026-09-16 is a Wednesday; its week began on Monday the 14th.
    const { startsAt, endsAt } = windowFor('weekly', new Date('2026-09-16T09:00:00Z'), IST);
    assert.strictEqual(startsAt.toISOString(), '2026-09-13T18:30:00.000Z');
    assert.strictEqual(endsAt.toISOString(), '2026-09-20T18:30:00.000Z');
  });

  await t.test('a Monday just after midnight starts a NEW week', () => {
    // The off-by-one that makes a weekly race eight days long.
    const { startsAt } = windowFor('weekly', new Date('2026-09-13T18:31:00Z'), IST);
    assert.strictEqual(startsAt.toISOString(), '2026-09-13T18:30:00.000Z');
  });

  await t.test('a daylight-saving day is 23 hours, not 24', () => {
    /**
     * The ported implementation added a fixed +330 minutes and a fixed 24
     * hours. In a zone that observes DST that leaves a one-hour gap between
     * consecutive races twice a year — an hour of bets scoring in no race at
     * all, or in two.
     */
    const { startsAt, endsAt } = windowFor('daily', new Date('2026-03-08T12:00:00Z'), 'America/New_York');
    assert.strictEqual((endsAt - startsAt) / 3_600_000, 23);
  });

  await t.test('consecutive windows meet exactly, with no gap', () => {
    let cursor = new Date('2026-10-28T12:00:00Z');
    for (let i = 0; i < 10; i += 1) {
      const current = windowFor('daily', cursor, 'Europe/London');
      const next = windowFor('daily', new Date(current.endsAt.getTime() + 1000), 'Europe/London');
      assert.strictEqual(current.endsAt.toISOString(), next.startsAt.toISOString());
      cursor = new Date(current.endsAt.getTime() + 1000);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
//  Bucketing
// ══════════════════════════════════════════════════════════════════════

test('game buckets', async (t) => {
  await t.test('an unclassified game lands in `other`, not in slots', () => {
    /**
     * THE bug this exists to prevent. The ported implementation's `CASE` ended
     * `ELSE slot_point`, and the live configuration had the slot multiplier at
     * zero — so roulette, table games and every row with an empty game type
     * scored exactly nothing while appearing to be counted.
     */
    for (const type of ['Casual', 'Table Game', '', null, undefined, 'Something New']) {
      assert.notStrictEqual(bucketFor(type), 'slot', `${JSON.stringify(type)} must not be bucketed as a slot`);
    }
    assert.strictEqual(bucketFor('Casual'), 'other');
    assert.strictEqual(bucketFor(''), 'other');
  });

  await t.test('the arms are ordered, so an ambiguous name resolves the same way twice', () => {
    // "Casino Crash" matches both `casino` and `crash`. Which one wins has to
    // be a decision, and it has to be the same decision in SQL and in JS.
    assert.strictEqual(bucketFor('Casino Crash'), 'crash');
  });

  await t.test('the real game types on this platform classify sensibly', () => {
    assert.strictEqual(bucketFor('CasinoTable'), 'casino');
    assert.strictEqual(bucketFor('CasinoLive'), 'casino');
    assert.strictEqual(bucketFor('Crash Game'), 'crash');
    assert.strictEqual(bucketFor('Video Slot'), 'slot');
    assert.strictEqual(bucketFor('sports'), 'sports');
  });
});

// ══════════════════════════════════════════════════════════════════════
//  The claim — needs the real wallet and the real constraints
// ══════════════════════════════════════════════════════════════════════

test('race rewards', async (t) => {
  const logger = createLogger({ name: 'race-test', level: 'silent' });

  let connection;
  try {
    connection = await db.connect({
      config: {
        DB_HOST: process.env.DB_HOST || '127.0.0.1',
        DB_PORT: Number(process.env.DB_PORT || 5432),
        DB_NAME: TEST_DB,
        DB_USER: process.env.DB_USER || 'postgres',
        DB_PASSWORD: process.env.DB_PASSWORD || 'postgres',
        DB_SCHEMA: 'public',
      },
      logger,
      service: 'user-service',
    });
    await connection.ping();
  } catch (error) {
    t.skip(`No test database reachable (${error.message})`);
    return;
  }

  const { models } = connection;
  const userId = 920_000_000 + (process.pid % 100_000);
  const created = { races: [], rewards: [] };

  t.after(async () => {
    await models.RaceReward.destroy({ where: { user_id: userId } });
    if (created.races.length) await models.Race.destroy({ where: { id: created.races } });
    await models.CreditsLedger.destroy({ where: { user_id: String(userId) } });
    await models.Credits.destroy({ where: { uid: userId } });
    await models.Users.destroy({ where: { id: userId } });
  });
  t.after(async () => connection.close());

  await models.Users.findOrCreate({
    where: { id: userId },
    defaults: { id: userId, name: `race-test-${userId}`, password: 'x', status: 'active' },
  });

  const service = new RaceService({
    models,
    db: connection,
    logger,
    config: { SERVICE_NAME: 'user-service', RACE_TIMEZONE: IST },
    clients: {},
  });

  const race = await models.Race.create({
    type: 'daily',
    starts_at: new Date('2026-01-01T00:00:00Z'),
    ends_at: new Date('2026-01-02T00:00:00Z'),
    status: 'settled',
    settled_at: new Date(),
  });
  created.races.push(race.id);

  const reward = await models.RaceReward.create({
    race_id: race.id, user_id: userId, type: 'daily', rank: 1,
    points: '100', currency: 'USDT', amount: '5',
  });

  await t.test('claiming credits the wallet once', async () => {
    const result = await service.claim({ userId, rewardId: reward.id });
    assert.strictEqual(result.amount, '5.00000000');
    assert.strictEqual(result.currency, 'USDT');

    const row = await models.RaceReward.findByPk(reward.id, { raw: true });
    assert.strictEqual(row.claimed, true);
    assert.ok(row.claimed_at);
  });

  await t.test('claiming again is refused, not paid', async () => {
    await assert.rejects(
      () => service.claim({ userId, rewardId: reward.id }),
      (error) => error.code === 'RACE_ALREADY_CLAIMED'
    );
  });

  await t.test('two simultaneous claims pay exactly one of them', async () => {
    /**
     * The defect this replaces: the ported claim ran `BEGIN` on a `pg.Client`
     * shared by the whole process, so the `FOR UPDATE` in the middle provided
     * no isolation and both callers were paid.
     */
    const second = await models.RaceReward.create({
      race_id: race.id, user_id: userId + 1, type: 'daily', rank: 2,
      points: '90', currency: 'USDT', amount: '3',
    });
    await models.Users.findOrCreate({
      where: { id: userId + 1 },
      defaults: { id: userId + 1, name: `race-test-${userId + 1}`, password: 'x', status: 'active' },
    });

    const outcomes = await Promise.allSettled([
      service.claim({ userId: userId + 1, rewardId: second.id }),
      service.claim({ userId: userId + 1, rewardId: second.id }),
    ]);

    assert.strictEqual(outcomes.filter((o) => o.status === 'fulfilled').length, 1);

    await models.RaceReward.destroy({ where: { id: second.id } });
    await models.CreditsLedger.destroy({ where: { user_id: String(userId + 1) } });
    await models.Credits.destroy({ where: { uid: userId + 1 } });
    await models.Users.destroy({ where: { id: userId + 1 } });
  });

  await t.test("someone else's reward is a 404, not a 403", async () => {
    // A 403 would confirm the id exists, which is all an id-guessing probe needs.
    await assert.rejects(
      () => service.claim({ userId: userId + 99, rewardId: reward.id }),
      (error) => error.code === 'RACE_REWARD_NOT_FOUND'
    );
  });

  await t.test('one open race per type is enforced by the database', async () => {
    const open = await models.Race.create({
      type: 'weekly', starts_at: new Date('2026-01-05T00:00:00Z'),
      ends_at: new Date('2026-01-12T00:00:00Z'), status: 'open',
    });
    created.races.push(open.id);

    await assert.rejects(
      () => models.Race.create({
        type: 'weekly', starts_at: new Date('2026-01-12T00:00:00Z'),
        ends_at: new Date('2026-01-19T00:00:00Z'), status: 'open',
      }),
      (error) => error.name === 'SequelizeUniqueConstraintError'
    );
  });
});
