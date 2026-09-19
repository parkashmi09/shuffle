'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { createRewardCurrencyResolver, DEFAULTS } = require('../rewardCurrencies');
const { BONUS_CURRENCY } = require('../bonus.constants');
const { RAKEBACK_CURRENCY } = require('../../rakeback/rakeback.constants');

test('rewardCurrencies', async (t) => {
  await t.test('returns admin values when the internal route answers', async () => {
    const resolver = createRewardCurrencyResolver({
      clients: {
        admin: {
          get: async () => ({ bonusCurrency: 'USDT', rakebackCurrency: 'BJB' }),
        },
      },
    });

    assert.equal(await resolver.bonusCurrency(), 'USDT');
    assert.equal(await resolver.rakebackCurrency(), 'BJB');
  });

  await t.test('falls back to constants when admin is unreachable', async () => {
    const resolver = createRewardCurrencyResolver({
      logger: { warn: () => {} },
      clients: {
        admin: {
          get: async () => {
            throw new Error('down');
          },
        },
      },
    });

    assert.equal(await resolver.bonusCurrency(), DEFAULTS.bonusCurrency);
    assert.equal(await resolver.rakebackCurrency(), DEFAULTS.rakebackCurrency);
    assert.equal(DEFAULTS.bonusCurrency, BONUS_CURRENCY);
    assert.equal(DEFAULTS.rakebackCurrency, RAKEBACK_CURRENCY);
  });

  await t.test('uses defaults when no admin client is wired', async () => {
    const resolver = createRewardCurrencyResolver({});
    assert.equal(await resolver.bonusCurrency(), BONUS_CURRENCY);
    assert.equal(await resolver.rakebackCurrency(), RAKEBACK_CURRENCY);
  });
});
