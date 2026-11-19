import React from 'react';
import { useSession } from '../../lib/sessionContext';
import { useGate } from '../../../lib/gates';
import { exchangeCode, makeStakeCurrency } from '../../utils/exchange/stakeCurrency';

/* The rate table may carry no row for these; they are the dollar itself (backend helper/toInr.mjs). */
const ONE_USD = ['USD', 'USDT'];

/** USD per 1 unit of `code` from the platform's rate table; 0 when it has no rate. */
const usdPriceOf = (rates, code) =>
  Number(rates?.find?.((r) => String(r.currency).toUpperCase() === code)?.usdRate) || (ONE_USD.includes(code) ? 1 : 0);

/** The coin the exchange pages work in. A signed-out visitor and an agent's player are INR only. */
export const exchangeCoin = ({ signedIn, agent, currency }) => (signedIn && !agent ? exchangeCode(currency) : 'INR');

/**
 * The header wallet's currency for the exchange pages (utils/exchange/stakeCurrency.js): stakes
 * are typed in it and every INR figure mssports sends is printed in it. INR is the identity, and
 * a coin with no rate (or rates not loaded yet) falls back to INR.
 */
export function useExchangeCurrency() {
  const { signedIn, currency, rates } = useSession();
  const { agentPlayer } = useGate();
  const code = exchangeCoin({ signedIn, agent: agentPlayer, currency });
  const usdPrice = usdPriceOf(rates, code);
  const inrUsdPrice = usdPriceOf(rates, 'INR');
  return React.useMemo(
    () => makeStakeCurrency({ currencyName: code, usdPrice, inrUsdPrice, alias: code }),
    [code, usdPrice, inrUsdPrice],
  );
}

/* Self-check, dev only: what /place receives is rupees, whatever coin the stake was typed in. */
if (import.meta.env.DEV) {
  const rates = [{ currency: 'INR', usdRate: '0.012' }, { currency: 'BTC', usdRate: '60000' }];
  const usdt = makeStakeCurrency({ currencyName: 'USDT', usdPrice: usdPriceOf(rates, 'USDT'), inrUsdPrice: usdPriceOf(rates, 'INR') });
  console.assert(usdt.stakeToInr('10') === '833.33' && usdt.formatInr(833.33) === '10.00', 'exchange: USDT converts at the platform rate');
  const unpriced = makeStakeCurrency({ currencyName: 'XYZ', usdPrice: usdPriceOf(rates, 'XYZ'), inrUsdPrice: usdPriceOf(rates, 'INR') });
  console.assert(unpriced.isInr && unpriced.fallback, 'exchange: a coin with no rate falls back to INR');
  console.assert(exchangeCoin({ signedIn: true, agent: true, currency: 'USDT' }) === 'INR', 'exchange: an agent player stays INR');
  console.assert(exchangeCoin({ signedIn: false, agent: false, currency: 'USDT' }) === 'INR', 'exchange: signed out reads INR');
  console.assert(exchangeCoin({ signedIn: true, agent: false, currency: 'BTC' }) === 'BTC', 'exchange: the header coin');
}
