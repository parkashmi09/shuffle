import ExchangeRail from './ExchangeRail';
import { Notice } from '../../components/exchange/stakeKit';
import { useExchangeCurrency } from '../../hooks/exchange';
import { useSession } from '../../lib/sessionContext';
import '../../styles/shuffle-exchange.css';

/**
 * The exchange books and settles in INR (₹) whatever the header wallet is; these pages show and
 * take every amount in the header wallet's coin and convert at the platform's rate
 * (utils/exchange/stakeCurrency.js). Non-INR wallets only, so the player knows the figures are
 * converted and what the rate is. A coin with no rate falls back to INR, and says so.
 */
export function ExchangeCurrencyNote({ className = 'mt-3' }) {
  const cur = useExchangeCurrency();
  const { currency, rates } = useSession();
  if (cur.fallback) {
    // Rates still loading is not "no rate".
    if (!rates?.length) return null;
    return (
      <Notice type="warning" className={className}>
        No exchange rate for {currency} right now, so sports exchange amounts on these pages are shown in INR (₹).
      </Notice>
    );
  }
  if (cur.isInr) return null;
  const rate = cur.inrPerUnit.toLocaleString('en-US', { maximumFractionDigits: cur.inrPerUnit >= 100 ? 0 : 2 });
  return (
    <Notice type="info" className={className}>
      Sports exchange bets settle in INR. Stakes, profit, liability and exposure here are in {cur.label}, converted
      at 1 {cur.label} ≈ ₹{rate}.
    </Notice>
  );
}

/**
 * The exchange's page frame: the sports rail across the top, then the page.
 * stake: `rb-exch` scopes the exchange stylesheet; the page sits in stake's content column.
 */
export default function ExchangeFrame({ children }) {
  return (
    <div className="rb-exch RbExch_page px-4 pb-4 lg:px-12">
      <ExchangeRail />
      <ExchangeCurrencyNote />
      {children}
    </div>
  );
}

/**
 * My Bets / Statement: the exchange frame and a heading.
 * stake: one layout at every width (hash uses its MenuPageLayout from `lg` up; stake has none).
 * The rail already carries the three destinations and the tools, so the heading has no ExchangeTools.
 */
export function ExchangeAccountPage({ title, children }) {
  return (
    <ExchangeFrame>
      <h1 className="pb-3 pt-4 text-lg font-extrabold leading-8">{title}</h1>
      {children}
    </ExchangeFrame>
  );
}
