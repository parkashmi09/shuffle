import React from 'react';
import { makeStakeCurrency } from '../../utils/exchange/stakeCurrency';

/**
 * stake: the exchange is INR only here, so stakes and every figure are rupees whatever the header
 * wallet is (on exchange pages the header shows the INR wallet, TopBar.jsx). hash converts
 * to the header coin; on INR its `makeStakeCurrency` is the identity, which is what this returns.
 */
export function useExchangeCurrency() {
  return React.useMemo(() => makeStakeCurrency({ currencyName: 'INR', alias: 'INR' }), []);
}
