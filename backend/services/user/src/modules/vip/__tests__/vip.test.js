'use strict';

const test = require('node:test');
const assert = require('node:assert');

const db = require('@ibitplay/db');
const { createLogger, money, vipRewards, vipLevelFor } = require('@ibitplay/common');

const { VipService } = require('../vip.service');
const { BonusService } = require('../../bonus/bonus.service');
const { RakebackService } = require('../../rakeback/rakeback.service');

/**
 * VIP end-to-end: rate sync, level-up credit, periodic awards, claim.
 */

const TEST_DB = process.env.TEST_DB_NAME || 'ibitplay_test';

let connection;

let nextUid = 950_000_000 + Math.floor(process.pid % 100_000) * 1000;
const newUid = () => (nextUid += 1);

test('vip', async (t) => {
  const logger = createLogger({ name: 'vip-test', level: 'silent' });

  await t.test('the reward schedule covers every card on the ladder', async () => {
    for (const band of require('@ibitplay/common').VIP_LEVELS) {
      assert.ok(vipRewards.CARD_REWARDS[band.card], `missing schedule for ${band.card}`);
    }
    assert.equal(vipRewards.rakebackRateForCard('bronze'), '0.002');
  });

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

  t.after(async () => {
    if (connection) await connection.close();
  });

  const deps = {
    models: connection.models,
    db: connection,
    logger,
    config: { SERVICE_NAME: 'user-service' },
  };
  const vip = new VipService(deps);
  const bonus = new BonusService(deps);
  const rakeback = new RakebackService(deps);

  const seed = async (uid, { wager = '0' } = {}) => {
    await connection.models.BonusClaim.destroy({ where: { userid: uid } });
    await connection.models.Userbonus.destroy({ where: { userid: uid } });
    await connection.models.Userwager.destroy({ where: { uid } });
    await connection.models.CreditsLedger.destroy({ where: { user_id: String(uid) } }).catch(() => {});
    await connection.models.Credits.destroy({ where: { uid } });
    await connection.models.Users.destroy({ where: { id: uid } });

    await connection.models.Users.create({
      id: uid,
      name: `vip-${uid}`,
      password: 'x',
      status: 'active',
      rakeback: '0',
      rakeamount: '0',
    });
    await connection.models.Credits.create({ uid, bjb: '0', usdt: '0' });
    if (wager && wager !== '0') {
      await connection.models.Userwager.create({ uid, wager });
    }
  };

  const bjb = async (uid) => {
    const row = await connection.models.Credits.findOne({ where: { uid }, raw: true });
    return money.toDecimalString(money.toMinor(row?.bjb ?? '0'));
  };

  await t.test('on-wager syncs the rakeback rate to the player card', async () => {
    const uid = newUid();
    await seed(uid);

    const result = await vip.onWager({
      userId: uid,
      previousWager: '0',
      newWager: '1500',
    });

    assert.equal(result.vip.level, 2);
    assert.equal(result.vip.card, 'bronze');
    assert.equal(result.rate, '0.002');

    const user = await connection.models.Users.findByPk(uid, { attributes: ['rakeback'], raw: true });
    assert.equal(String(user.rakeback), '0.002');
  });

  await t.test('crossing a band auto-credits a level-up bonus', async () => {
    const uid = newUid();
    await seed(uid);

    await vip.onWager({ userId: uid, previousWager: '0', newWager: '500' });

    assert.equal(await bjb(uid), '0.50000000'); // wood levelUp
    const again = await vip.onWager({ userId: uid, previousWager: '500', newWager: '600' });
    assert.equal(again.granted.length, 0, 'same level does not pay again');
    assert.equal(await bjb(uid), '0.50000000');
  });

  await t.test('crossing into a new card also credits a rank-up bonus', async () => {
    const uid = newUid();
    await seed(uid);

    // Jump straight past Wood into Bronze 1.
    const result = await vip.onWager({
      userId: uid,
      previousWager: '0',
      newWager: '1000',
    });

    const kinds = result.granted.map((g) => g.kind);
    assert.ok(kinds.includes('level_up'));
    assert.ok(kinds.includes('rank_up'));
    assert.ok(money.gt(await bjb(uid), '0'));
  });

  await t.test('awardPeriodic creates claimable daily/weekly rows for Bronze+', async () => {
    const uid = newUid();
    await seed(uid, { wager: '1500' });
    assert.equal(vipLevelFor('1500').level, 2);

    const first = await vip.awardPeriodic({ userId: uid });
    assert.ok(first.awarded >= 2, `expected daily+weekly, got ${first.awarded}`);

    const overview = await bonus.overview({ userId: uid });
    assert.equal(overview.types.daily.eligible, true);
    assert.equal(overview.types.daily.claimable, true);
    assert.equal(overview.types.weekly.claimable, true);
    assert.ok(overview.types.daily.award?.amount);
    assert.equal(overview.types.monthly.eligible, false);

    const claimed = await bonus.claim({ userId: uid, type: 'daily' });
    assert.ok(money.gt(claimed.amount, '0'));
    assert.ok(money.gt(await bjb(uid), '0'));

    // Same period — no second award.
    const second = await vip.awardPeriodic({ userId: uid });
    assert.equal(second.awarded, 0);
  });

  await t.test('overview materialises due awards when wager is set without a worker tick', async () => {
    // Setting `userwager` alone unlocks eligibility; claimable rows used to
    // wait for the hourly worker. Opening the VIP rewards page must create
    // them so Claim is enabled immediately.
    const uid = newUid();
    await seed(uid, { wager: '1500' });

    const overview = await bonus.overview({ userId: uid });
    assert.equal(overview.types.daily.eligible, true);
    assert.equal(overview.types.daily.claimable, true);
    assert.equal(overview.types.weekly.claimable, true);
    assert.ok(overview.types.daily.award?.amount);

    const claimed = await bonus.claim({ userId: uid, type: 'daily' });
    assert.ok(money.gt(claimed.amount, '0'));
  });

  await t.test('overview exposes nextClaimAt after a claim', async () => {
    const uid = newUid();
    await seed(uid, { wager: '1500' });
    await vip.awardPeriodic({ userId: uid });
    await bonus.claim({ userId: uid, type: 'daily' });

    const overview = await bonus.overview({ userId: uid });
    assert.equal(overview.types.daily.claimable, false);
    assert.ok(overview.types.daily.nextClaimAt, 'cooldown timestamp present');
    assert.ok(new Date(overview.types.daily.nextClaimAt) > new Date());
  });

  await t.test('rakeback accrue applies users.rakeback to stakeUsd', async () => {
    const uid = newUid();
    await seed(uid);
    await connection.models.Users.update({ rakeback: '0.002' }, { where: { id: uid } });

    const result = await rakeback.accrue({
      userId: uid,
      stakeUsd: '50',
      source: 'vip-test',
      ref: `ref-${uid}`,
    });

    assert.equal(result.amount, '0.10000000');
    const view = await rakeback.amount({ userId: uid });
    assert.equal(view.amount, '0.10000000');
    assert.equal(view.rate, '0.002');
  });
});
