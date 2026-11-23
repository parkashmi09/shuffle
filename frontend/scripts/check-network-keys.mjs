// Self-check: the wallet's network picker sends the backend's network keys (COIN_NETWORKS),
// never names the backend refuses with NETWORK_UNAVAILABLE (MATIC, BASE, RHC, TRX, BSC…).
// Run: node scripts/check-network-keys.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const here = new URL('.', import.meta.url);
const { COIN_NETWORKS } = createRequire(here)('../../backend/services/user/src/modules/crypto/crypto.constants.js');
// networks.js without its imports: only the hook uses them, and it is not called here.
const src = readFileSync(new URL('../src/lib/networks.js', here), 'utf8').replace(/^import .*$/gm, '');
const { networksFor, networkOptions } = await import(`data:text/javascript,${encodeURIComponent(src)}`);

for (const coin of Object.keys(COIN_NETWORKS)) {
  for (const { value } of networksFor(coin)) assert.ok(COIN_NETWORKS[coin].includes(value), `${coin}: ${value} is not a backend key`);
}
const live = [{ coin: 'USDT', networks: [{ key: 'TRC20', name: 'Tron' }] }];
assert.deepEqual(networkOptions('USDT', live, null), [{ value: 'TRC20', label: 'Tron' }]);
assert.equal(networkOptions('USDT', null, null)[1].value, 'TRC20');
console.log('network keys ok');
