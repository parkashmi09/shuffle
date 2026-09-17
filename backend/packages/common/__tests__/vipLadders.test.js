'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { VIP_LADDERS, vipLadderFor, resolveVipLadder, vipLevelFor, VIP_LEVELS, PLATFORM_LADDER } = require('../src');

/**
 * Two ladders, one arithmetic, and the site's `vip` variant picking between them.
 */
test('vip ladders', async (t) => {
  await t.test('every ladder covers every wager without gaps', () => {
    for (const ladder of Object.values(VIP_LADDERS)) {
      const bands = ladder.levels;
      for (let i = 0; i < bands.length - 1; i += 1) {
        assert.equal(Number(bands[i + 1].minXp), Number(bands[i].maxXp) + 1, `${ladder.key}: gap after level ${bands[i].level}`);
        assert.equal(bands[i + 1].level, bands[i].level + 1, `${ladder.key}: levels must be consecutive`);
      }
    }
  });

  await t.test('the platform ladder is the default and unchanged', () => {
    assert.equal(vipLadderFor(undefined), PLATFORM_LADDER);
    assert.equal(vipLadderFor('stake'), PLATFORM_LADDER);
    assert.equal(vipLadderFor('none'), PLATFORM_LADDER);
    assert.equal(PLATFORM_LADDER.levels.length, 41);
    assert.deepEqual(PLATFORM_LADDER.levels, VIP_LEVELS);
    // The documented example: 120,000 wagered is level 12, Gold 1.
    assert.deepEqual([vipLevelFor('120000').level, vipLevelFor('120000').name], [12, 'Gold 1']);
    assert.equal(vipLevelFor('499').level, 0);
    assert.equal(vipLevelFor('500').name, 'Wood');
  });

  await t.test("addaplay is the reference's 75 bands, named VIP 01 … VIP 75", () => {
    const a = vipLadderFor('addaplay');
    assert.equal(a.key, 'addaplay');
    assert.equal(a.levels.length, 75);
    assert.equal(a.levels[0].name, 'VIP 01');
    assert.equal(a.top.name, 'VIP 75');
    assert.deepEqual(a.levels.map((b) => b.card).filter((c, i, all) => all.indexOf(c) === i), ['brownz', 'silver', 'gold', 'platinum', 'diamond']);
    // Boundaries as legacy had them.
    assert.equal(a.levelFor('99').level, 1);
    assert.equal(a.levelFor('100').level, 2);
    assert.equal(a.levelFor('120000').name, 'VIP 30');
    assert.equal(a.levelFor('15058625000').level, 75);
  });

  await t.test('the same player ranks differently on each ladder — and neither falls off the ends', () => {
    const a = VIP_LADDERS.addaplay;
    // Below the first band: level 0, distance to the first band, not its floor.
    assert.deepEqual([a.levelFor('0').level, a.levelFor('0').name, a.levelFor('0').wagerToNextLevel], [0, 'VIP 00', '1']);
    assert.equal(PLATFORM_LADDER.levelFor('300').wagerToNextLevel, '200');
    // Above the top: stays at the top, open-ended.
    const whale = a.levelFor('999999999999999');
    assert.deepEqual([whale.level, whale.nextLevel, whale.progressPct], [75, null, '100.00']);
    // The published form hides the top band's ceiling.
    const published = a.publish();
    assert.equal(published.length, 75);
    assert.equal(published[74].maxXp, null);
    assert.equal(published[0].minXp, '1');
  });

  await t.test('each ladder carries its own bonus gates', () => {
    assert.deepEqual(PLATFORM_LADDER.bonusGates, { daily: 2, weekly: 2, monthly: 7 });
    assert.deepEqual(VIP_LADDERS.addaplay.bonusGates, { daily: 20, weekly: 25, monthly: 30 });
    // 1,000 wagered clears the platform daily gate; on addaplay it takes 29,000.
    assert.ok(PLATFORM_LADDER.levelFor('1000').level >= PLATFORM_LADDER.bonusGates.daily);
    assert.ok(VIP_LADDERS.addaplay.levelFor('1000').level < VIP_LADDERS.addaplay.bonusGates.daily);
    assert.ok(VIP_LADDERS.addaplay.levelFor('29000').level >= VIP_LADDERS.addaplay.bonusGates.daily);
  });

  await t.test("resolveVipLadder reads the site's vip variant, and never throws", async () => {
    const withRow = (variant) => ({ SiteFeature: { findByPk: async (pk) => (pk === 'vip' && variant != null ? { variant } : null) } });
    assert.equal((await resolveVipLadder(withRow('addaplay'))).key, 'addaplay');
    assert.equal((await resolveVipLadder(withRow('stake'))).key, 'platform');
    assert.equal((await resolveVipLadder(withRow(null))).key, 'platform');
    // No SiteFeature model on this service: platform.
    assert.equal((await resolveVipLadder({})).key, 'platform');
    assert.equal((await resolveVipLadder(undefined)).key, 'platform');
    // A failing read degrades to the platform ladder and is logged, not thrown.
    const warned = [];
    const broken = { SiteFeature: { findByPk: async () => { throw new Error('db down'); } } };
    assert.equal((await resolveVipLadder(broken, { logger: { warn: (...a) => warned.push(a) } })).key, 'platform');
    assert.equal(warned.length, 1);
  });
});
